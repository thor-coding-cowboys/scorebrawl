import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { seasonPlayer, player, sessionPlayer, sessionCoinToss } from "../../db/schema/league-schema";
import { leagueMemberProcedure } from "../trpc";
import * as sessionRepository from "../../repositories/session-repository";
import * as matchRepository from "../../repositories/match-repository";
import * as seasonRepository from "../../repositories/season-repository";
import { broadcastSeasonEvent } from "../../routes/sse-router";
import * as sessionService from "../../services/session";
import type { AchievementQueueMessage } from "../../services/achievement-calculation";

async function getSeasonBySlug(db: Parameters<typeof seasonRepository.getBySlug>[0]["db"], seasonSlug: string, organizationId: string) {
	try {
		return await seasonRepository.getBySlug({ db, seasonSlug, leagueId: organizationId });
	} catch (error) {
		if (error instanceof Error && error.message === "Season not found") {
			throw new TRPCError({ code: "NOT_FOUND", message: "Season not found" });
		}
		throw error;
	}
}

async function getSessionForOrg(db: Parameters<typeof sessionRepository.getSessionWithSeason>[0]["db"], sessionId: string, organizationId: string) {
	const info = await sessionRepository.getSessionWithSeason({ db, sessionId });
	if (!info) {
		throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
	}
	if (info.leagueId !== organizationId) {
		throw new TRPCError({ code: "FORBIDDEN", message: "Session not in your league" });
	}
	return info;
}

export const sessionRouter = {
	create: leagueMemberProcedure
		.input(
			z.object({
				seasonSlug: z.string(),
				teamSize: z.number().int().min(1).max(6),
				rotationMode: z.enum(["winner-stays", "manual"]),
				modeSettings: z.union([
					z.object({
						mode: z.literal("winner-stays"),
						maxConsecutiveGames: z.number().int().min(1).nullable(),
						winnersTakePriority: z.boolean(),
						autoRandomize: z.boolean(),
						randomizerType: z.enum(["fisher-yates", "diversity"]),
						autoCoinToss: z.boolean(),
						alwaysSplitConstraints: z.array(z.tuple([z.string(), z.string()])),
					}),
					z.object({
						mode: z.literal("manual"),
					}),
				]),
				playerSeasonIds: z.array(z.string()),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const season = await getSeasonBySlug(ctx.db, input.seasonSlug, ctx.organizationId);

			const active = await sessionRepository.getActiveSession({
				db: ctx.db,
				seasonId: season.id,
			});

			if (active) {
				throw new TRPCError({ code: "CONFLICT", message: "An active session already exists" });
			}

			const modeSettings =
				input.modeSettings.mode === "manual"
					? {
							maxConsecutiveGames: null,
							winnersTakePriority: false,
							autoRandomize: false,
							randomizerType: "fisher-yates" as const,
							autoCoinToss: false,
							alwaysSplitConstraints: [] as [string, string][],
						}
					: {
							maxConsecutiveGames: input.modeSettings.maxConsecutiveGames,
							winnersTakePriority: input.modeSettings.winnersTakePriority,
							autoRandomize: input.modeSettings.autoRandomize,
							randomizerType: input.modeSettings.randomizerType,
							autoCoinToss: input.modeSettings.autoCoinToss,
							alwaysSplitConstraints: input.modeSettings.alwaysSplitConstraints,
						};

			const session = await sessionService.createSession(ctx.db, {
				seasonId: season.id,
				createdBy: ctx.authentication.user.id,
				teamSize: input.teamSize,
				rotationMode: input.rotationMode,
				modeSettings,
				playerSeasonIds: input.playerSeasonIds,
			});

			ctx.waitUntil(
				broadcastSeasonEvent(ctx.env, ctx.organization.slug, input.seasonSlug, {
					type: "session:start",
					data: { session },
					user: { id: ctx.authentication.user.id, name: ctx.authentication.user.name },
				})
			);

			return session;
		}),

	getActive: leagueMemberProcedure
		.input(z.object({ seasonSlug: z.string() }))
		.query(async ({ ctx, input }) => {
			const s = await getSeasonBySlug(ctx.db, input.seasonSlug, ctx.organizationId);
			return sessionRepository.getActiveSession({ db: ctx.db, seasonId: s.id });
		}),

	getById: leagueMemberProcedure
		.input(z.object({ sessionId: z.string() }))
		.query(async ({ ctx, input }) => {
			await getSessionForOrg(ctx.db, input.sessionId, ctx.organizationId);
			const session = await sessionRepository.getSessionById({
				db: ctx.db,
				sessionId: input.sessionId,
			});
			if (!session) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
			}
			return session;
		}),

	joinSelf: leagueMemberProcedure
		.input(z.object({ sessionId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const sessionInfo = await sessionRepository.getSessionWithSeason({
				db: ctx.db,
				sessionId: input.sessionId,
			});

			if (!sessionInfo) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
			}

			if (sessionInfo.sessionStatus !== "active") {
				throw new TRPCError({ code: "BAD_REQUEST", message: "Session is not active" });
			}

			const [seasonPlayerRecord] = await ctx.db
				.select({ id: seasonPlayer.id })
				.from(seasonPlayer)
				.innerJoin(player, eq(seasonPlayer.playerId, player.id))
				.where(eq(player.userId, ctx.authentication.user.id))
				.limit(1);

			if (!seasonPlayerRecord) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "You are not a player in this season",
				});
			}

			const existingInSession = await ctx.db
				.select({ id: sessionPlayer.id })
				.from(sessionPlayer)
				.where(eq(sessionPlayer.sessionId, input.sessionId))
				.limit(1);

			if (existingInSession.length > 0) {
				throw new TRPCError({
					code: "CONFLICT",
					message: "You are already in this session",
				});
			}

			const newPlayer = await sessionService.addPlayer(ctx.db, input.sessionId, seasonPlayerRecord.id);

			ctx.waitUntil(
				broadcastSeasonEvent(ctx.env, ctx.organization.slug, sessionInfo.seasonSlug, {
					type: "session:update",
					data: { sessionId: input.sessionId, player: newPlayer },
					user: { id: ctx.authentication.user.id, name: ctx.authentication.user.name },
				})
			);

			return newPlayer;
		}),

	addPlayer: leagueMemberProcedure
		.input(z.object({ sessionId: z.string(), seasonPlayerId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const sessionInfo = await getSessionForOrg(ctx.db, input.sessionId, ctx.organizationId);

			const newPlayer = await sessionService.addPlayer(ctx.db, input.sessionId, input.seasonPlayerId);

			ctx.waitUntil(
				broadcastSeasonEvent(ctx.env, ctx.organization.slug, sessionInfo.seasonSlug, {
					type: "session:update",
					data: { sessionId: input.sessionId, player: newPlayer },
					user: { id: ctx.authentication.user.id, name: ctx.authentication.user.name },
				})
			);

			return newPlayer;
		}),

	removePlayer: leagueMemberProcedure
		.input(z.object({ sessionId: z.string(), sessionPlayerId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const sessionInfo = await getSessionForOrg(ctx.db, input.sessionId, ctx.organizationId);

			const result = await sessionService.removePlayer(ctx.db, input.sessionId, input.sessionPlayerId);

			ctx.waitUntil(
				broadcastSeasonEvent(ctx.env, ctx.organization.slug, sessionInfo.seasonSlug, {
					type: "session:update",
					data: { sessionId: input.sessionId, removedSessionPlayerId: input.sessionPlayerId },
					user: { id: ctx.authentication.user.id, name: ctx.authentication.user.name },
				})
			);

			return result;
		}),

	startNextMatch: leagueMemberProcedure
		.input(
			z.object({
				sessionId: z.string(),
				homeSeasonPlayerIds: z.array(z.string()),
				awaySeasonPlayerIds: z.array(z.string()),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const sessionInfo = await getSessionForOrg(ctx.db, input.sessionId, ctx.organizationId);

			const sessionMatch = await sessionService.startNextMatch(
				ctx.db,
				input.sessionId,
				input.homeSeasonPlayerIds,
				input.awaySeasonPlayerIds
			);

			ctx.waitUntil(
				broadcastSeasonEvent(ctx.env, ctx.organization.slug, sessionInfo.seasonSlug, {
					type: "session:update",
					data: { sessionId: input.sessionId, match: sessionMatch },
					user: { id: ctx.authentication.user.id, name: ctx.authentication.user.name },
				})
			);

			return sessionMatch;
		}),

	recordResult: leagueMemberProcedure
		.input(
			z.object({
				sessionId: z.string(),
				sessionMatchId: z.string(),
				homeScore: z.number().int().min(0),
				awayScore: z.number().int().min(0),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const sessionInfo = await getSessionForOrg(ctx.db, input.sessionId, ctx.organizationId);

			const result: "home" | "away" | "draw" =
				input.homeScore > input.awayScore ? "home" : input.awayScore > input.homeScore ? "away" : "draw";

			const serviceResult = await sessionService.recordResult(ctx.db, {
				sessionId: input.sessionId,
				sessionMatchId: input.sessionMatchId,
				result,
				homeScore: input.homeScore,
				awayScore: input.awayScore,
				seasonId: sessionInfo.sessionSeasonId,
				leagueId: ctx.organizationId,
			});

			await ctx.env.ACHIEVEMENT_QUEUE.send({
				seasonPlayerIds: serviceResult.streakData.homePlayerIds.concat(
					serviceResult.streakData.awayPlayerIds
				),
			} satisfies AchievementQueueMessage);

			ctx.waitUntil(
				broadcastSeasonEvent(ctx.env, ctx.organization.slug, sessionInfo.seasonSlug, {
					type: "session:update",
					data: {
						sessionId: input.sessionId,
						match: serviceResult.match,
						proposedLineup: serviceResult.proposedLineup,
					},
					user: { id: ctx.authentication.user.id, name: ctx.authentication.user.name },
				})
			);

			const streakCheckPromise = (async () => {
				const [streakPlayers, streakTeams] = await Promise.all([
					matchRepository.checkStreakThresholds({
						db: ctx.db,
						seasonPlayerIds: serviceResult.streakData.homePlayerIds.concat(
							serviceResult.streakData.awayPlayerIds
						),
					}),
					matchRepository.checkTeamStreakThresholds({
						db: ctx.db,
						matchId: serviceResult.streakData.matchId,
					}),
				]);

				const user = { id: ctx.authentication.user.id, name: ctx.authentication.user.name };
				const timestamp = Date.now();
				const streakEvents = [
					...streakPlayers.map((p) => ({
						type: "streak" as const,
						data: {
							playerId: p.playerId,
							playerName: p.playerName,
							playerImage: p.playerImage,
							streak: p.streak,
							timestamp,
						},
						user,
					})),
					...streakTeams.map((t) => ({
						type: "streak" as const,
						data: {
							playerId: t.seasonTeamId,
							playerName: t.teamName,
							playerImage: t.teamLogo,
							streak: t.streak,
							timestamp,
							isTeam: true,
						},
						user,
					})),
				];
				await Promise.all(
					streakEvents.map((event) =>
						broadcastSeasonEvent(ctx.env, ctx.organization.slug, sessionInfo.seasonSlug, event)
					)
				);
			})();

			if (process.env.NODE_ENV === "development") {
				await streakCheckPromise;
			} else {
				ctx.waitUntil(streakCheckPromise);
			}

			return {
				match: serviceResult.match,
				proposedLineup: serviceResult.proposedLineup,
				coinTossId: serviceResult.coinToss?.id ?? null,
			};
		}),

	resolveCoinToss: leagueMemberProcedure
		.input(z.object({ coinTossId: z.string(), resolvedWinnerIds: z.array(z.string()) }))
		.mutation(async ({ ctx, input }) => {
			const [coinToss] = await ctx.db
				.select()
				.from(sessionCoinToss)
				.where(eq(sessionCoinToss.id, input.coinTossId))
				.limit(1);

			if (!coinToss) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Coin toss not found" });
			}

			const sessionInfo = await getSessionForOrg(ctx.db, coinToss.sessionId, ctx.organizationId);

			const serviceResult = await sessionService.resolveCoinToss(ctx.db, {
				sessionId: coinToss.sessionId,
				coinTossId: input.coinTossId,
				winnerIds: input.resolvedWinnerIds,
			});

			ctx.waitUntil(
				broadcastSeasonEvent(ctx.env, ctx.organization.slug, sessionInfo.seasonSlug, {
					type: "session:update",
					data: {
						sessionId: coinToss.sessionId,
						resolvedCoinToss: serviceResult.resolved,
						proposedLineup: serviceResult.proposedLineup,
					},
					user: { id: ctx.authentication.user.id, name: ctx.authentication.user.name },
				})
			);

			return serviceResult;
		}),

	end: leagueMemberProcedure
		.input(z.object({ sessionId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const sessionInfo = await getSessionForOrg(ctx.db, input.sessionId, ctx.organizationId);

			const ended = await sessionService.endSession(ctx.db, input.sessionId);

			ctx.waitUntil(
				broadcastSeasonEvent(ctx.env, ctx.organization.slug, sessionInfo.seasonSlug, {
					type: "session:end",
					data: { session: ended },
					user: { id: ctx.authentication.user.id, name: ctx.authentication.user.name },
				})
			);

			return ended;
		}),

	listEnded: leagueMemberProcedure
		.input(
			z.object({
				seasonSlug: z.string(),
				limit: z.number().min(1).max(50).optional(),
			})
		)
		.query(async ({ ctx, input }) => {
			const s = await getSeasonBySlug(ctx.db, input.seasonSlug, ctx.organizationId);
			return sessionRepository.listEndedSessions({
				db: ctx.db,
				seasonId: s.id,
				limit: input.limit,
			});
		}),

	getSummary: leagueMemberProcedure
		.input(z.object({ sessionId: z.string() }))
		.query(async ({ ctx, input }) => {
			await getSessionForOrg(ctx.db, input.sessionId, ctx.organizationId);
			const summary = await sessionRepository.getSessionSummary({
				db: ctx.db,
				sessionId: input.sessionId,
			});
			if (!summary) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
			}
			return summary;
		}),

	cancelMatch: leagueMemberProcedure
		.input(z.object({ sessionId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const sessionInfo = await getSessionForOrg(ctx.db, input.sessionId, ctx.organizationId);

			const result = await sessionService.cancelMatch(ctx.db, input.sessionId);

			ctx.waitUntil(
				broadcastSeasonEvent(ctx.env, ctx.organization.slug, sessionInfo.seasonSlug, {
					type: "session:update",
					data: { sessionId: input.sessionId, players: result.players },
					user: { id: ctx.authentication.user.id, name: ctx.authentication.user.name },
				})
			);

			return result;
		}),

	deleteLastMatch: leagueMemberProcedure
		.input(z.object({ sessionId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const sessionInfo = await getSessionForOrg(ctx.db, input.sessionId, ctx.organizationId);

			const result = await sessionService.deleteLastMatch(ctx.db, input.sessionId);

			if (result.deletedMatch.matchId) {
				await matchRepository.remove({
					db: ctx.db,
					matchId: result.deletedMatch.matchId,
					seasonId: sessionInfo.sessionSeasonId,
				});
			}

			ctx.waitUntil(
				broadcastSeasonEvent(ctx.env, ctx.organization.slug, sessionInfo.seasonSlug, {
					type: "session:update",
					data: { sessionId: input.sessionId, players: result.players },
					user: { id: ctx.authentication.user.id, name: ctx.authentication.user.name },
				})
			);

			ctx.waitUntil(
				broadcastSeasonEvent(ctx.env, ctx.organization.slug, sessionInfo.seasonSlug, {
					type: "match:delete",
					data: { matchId: result.deletedMatch.matchId },
					user: { id: ctx.authentication.user.id, name: ctx.authentication.user.name },
				})
			);

			return result;
		}),

	updateMatchScore: leagueMemberProcedure
		.input(
			z.object({
				sessionId: z.string(),
				sessionMatchId: z.string(),
				homeScore: z.number().int().min(0),
				awayScore: z.number().int().min(0),
			})
		)
		.mutation(async ({ ctx, input }) => {
			await getSessionForOrg(ctx.db, input.sessionId, ctx.organizationId);
			return sessionService.updateMatchScore(ctx.db, {
				sessionId: input.sessionId,
				sessionMatchId: input.sessionMatchId,
				homeScore: input.homeScore,
				awayScore: input.awayScore,
			});
		}),

	updateTeamSelection: leagueMemberProcedure
		.input(
			z.object({
				sessionId: z.string(),
				sessionMatchId: z.string(),
				selectedHomePlayerIds: z.array(z.string()),
				selectedAwayPlayerIds: z.array(z.string()),
			})
		)
		.mutation(async ({ ctx, input }) => {
			await getSessionForOrg(ctx.db, input.sessionId, ctx.organizationId);
			return sessionService.updateTeamSelection(ctx.db, {
				sessionId: input.sessionId,
				sessionMatchId: input.sessionMatchId,
				selectedHomePlayerIds: input.selectedHomePlayerIds,
				selectedAwayPlayerIds: input.selectedAwayPlayerIds,
			});
		}),

	updateProposedLineup: leagueMemberProcedure
		.input(
			z.object({
				sessionId: z.string(),
				proposedLineup: z.object({
					homePlayerIds: z.array(z.string()),
					awayPlayerIds: z.array(z.string()),
					rotatedOut: z.array(z.string()),
					coinTossNeeded: z
						.object({
							conflictType: z.string(),
							candidates: z.array(z.string()),
						})
						.nullable(),
					selectedHomePlayerIds: z.array(z.string()),
					selectedAwayPlayerIds: z.array(z.string()),
				}),
			})
		)
		.mutation(async ({ ctx, input }) => {
			await getSessionForOrg(ctx.db, input.sessionId, ctx.organizationId);
			return sessionService.updateProposedLineup(ctx.db, {
				sessionId: input.sessionId,
				proposedLineup: input.proposedLineup,
			});
		}),
} satisfies TRPCRouterRecord;
