import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq, and, sql } from "drizzle-orm";
import { seasonPlayer, player, sessionPlayer } from "../../db/schema/league-schema";
import { leagueMemberProcedure } from "../trpc";
import * as sessionRepository from "../../repositories/session";
import * as matchRepository from "../../repositories/match-repository";
import * as seasonRepository from "../../repositories/season-repository";
import { broadcastSeasonEvent } from "../../routes/sse-router";
import * as sessionService from "../../services/session";
import type { AchievementQueueMessage } from "../../services/achievement-calculation";

type SessionDb = Parameters<typeof sessionRepository.getActiveSession>[0]["db"];

async function getSeasonBySlug(db: SessionDb, seasonSlug: string, organizationId: string) {
	try {
		return await seasonRepository.getBySlug({ db, seasonSlug, leagueId: organizationId });
	} catch (error) {
		if (error instanceof Error && error.message === "Season not found") {
			throw new TRPCError({ code: "NOT_FOUND", message: "Season not found" });
		}
		throw error;
	}
}

async function getSessionForOrg(db: SessionDb, sessionId: string, organizationId: string) {
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
				rotationMode: z.enum(["winner-stays", "manual"]),
				teamSize: z.number().int().min(1).max(6),
				maxConsecutiveGames: z.number().int().min(1).nullable(),
				seasonPlayerIds: z.array(z.string()).min(2),
				alwaysSplitConstraints: z.array(z.tuple([z.string(), z.string()])).default([]),
				autoCoinToss: z.boolean().default(false),
				winnersTakePriority: z.boolean().default(false),
				maxConsecutiveEnabled: z.boolean().default(false),
				randomizerType: z.enum(["off", "fisher-yates", "diversity"]).default("fisher-yates"),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const s = await getSeasonBySlug(ctx.db, input.seasonSlug, ctx.organizationId);

			const active = await sessionRepository.getActiveSession({
				db: ctx.db,
				seasonId: s.id,
			});

			if (active) {
				throw new TRPCError({ code: "CONFLICT", message: "An active session already exists" });
			}

			const session = await sessionRepository.createSession({
				db: ctx.db,
				seasonId: s.id,
				createdBy: ctx.authentication.user.id,
				rotationMode: input.rotationMode,
				teamSize: input.teamSize,
				maxConsecutiveGames: input.maxConsecutiveGames,
				alwaysSplitConstraints: input.alwaysSplitConstraints,
				autoCoinToss: input.autoCoinToss,
				seasonPlayerIds: input.seasonPlayerIds,
				winnersTakePriority: input.winnersTakePriority,
				maxConsecutiveEnabled: input.maxConsecutiveEnabled,
				randomizerType: input.randomizerType,
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
				.select({
					id: seasonPlayer.id,
					alreadyInSession: sql<boolean>`EXISTS(
					SELECT 1 FROM ${sessionPlayer}
					WHERE ${sessionPlayer.sessionId} = ${input.sessionId}
					AND ${sessionPlayer.seasonPlayerId} = ${seasonPlayer.id}
				)`.as("already_in_session"),
				})
				.from(seasonPlayer)
				.innerJoin(player, eq(seasonPlayer.playerId, player.id))
				.where(
					and(
						eq(seasonPlayer.seasonId, sessionInfo.sessionSeasonId),
						eq(player.userId, ctx.authentication.user.id)
					)
				)
				.limit(1);

			if (!seasonPlayerRecord) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "You are not a player in this season",
				});
			}

			if (seasonPlayerRecord.alreadyInSession) {
				throw new TRPCError({
					code: "CONFLICT",
					message: "You are already in this session",
				});
			}

			const newPlayer = await sessionRepository.addPlayerToSession({
				db: ctx.db,
				sessionId: input.sessionId,
				seasonPlayerId: seasonPlayerRecord.id,
			});

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

			const newPlayer = await sessionRepository.addPlayerToSession({
				db: ctx.db,
				sessionId: input.sessionId,
				seasonPlayerId: input.seasonPlayerId,
			});

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

			const removedPlayer = await sessionRepository.removePlayerFromSession({
				db: ctx.db,
				sessionId: input.sessionId,
				sessionPlayerId: input.sessionPlayerId,
			});

			const fullSession = await sessionRepository.getSessionById({
				db: ctx.db,
				sessionId: input.sessionId,
			});

			const hasActiveMatch = fullSession?.matches.some((m) => m.result === null) ?? false;

			if (!hasActiveMatch) {
				await sessionService.recomputeLineupAfterPlayerRemoval(ctx.db, {
					sessionId: input.sessionId,
					removedSessionPlayerId: removedPlayer.id,
				});
			}

			ctx.waitUntil(
				broadcastSeasonEvent(ctx.env, ctx.organization.slug, sessionInfo.seasonSlug, {
					type: "session:update",
					data: { sessionId: input.sessionId, removedSessionPlayerId: input.sessionPlayerId },
					user: { id: ctx.authentication.user.id, name: ctx.authentication.user.name },
				})
			);
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

			const sessionMatch = await sessionRepository.startNextMatch({
				db: ctx.db,
				sessionId: input.sessionId,
				homeSeasonPlayerIds: input.homeSeasonPlayerIds,
				awaySeasonPlayerIds: input.awaySeasonPlayerIds,
			});

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

			const result = await sessionService.recordResult(ctx.db, {
				sessionId: input.sessionId,
				sessionMatchId: input.sessionMatchId,
				homeScore: input.homeScore,
				awayScore: input.awayScore,
				seasonId: sessionInfo.sessionSeasonId,
				userId: ctx.authentication.user.id,
			});

			await ctx.env.ACHIEVEMENT_QUEUE.send({
				seasonPlayerIds: [
					...result.streakData.homeSeasonPlayerIds,
					...result.streakData.awaySeasonPlayerIds,
				],
				leagueSlug: ctx.organization.slug,
				seasonSlug: sessionInfo.seasonSlug,
			} satisfies AchievementQueueMessage);

			ctx.waitUntil(
				broadcastSeasonEvent(ctx.env, ctx.organization.slug, sessionInfo.seasonSlug, {
					type: "session:update",
					data: {
						sessionId: input.sessionId,
						match: result.match,
						players: result.players,
						proposedLineup: result.proposedLineup,
					},
					user: { id: ctx.authentication.user.id, name: ctx.authentication.user.name },
				})
			);

			const streakCheckPromise = (async () => {
				const [streakPlayers, streakTeams] = await Promise.all([
					matchRepository.checkStreakThresholds({
						db: ctx.db,
						seasonPlayerIds: [
							...result.streakData.homeSeasonPlayerIds,
							...result.streakData.awaySeasonPlayerIds,
						],
					}),
					matchRepository.checkTeamStreakThresholds({
						db: ctx.db,
						matchId: result.streakData.createdMatchId,
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
				match: result.match,
				players: result.players,
				proposedLineup: result.proposedLineup,
				coinTossId: result.coinTossId,
				autoResolvedCoinToss: result.autoResolvedCoinToss,
			};
		}),

	resolveCoinToss: leagueMemberProcedure
		.input(z.object({ coinTossId: z.string(), resolvedWinnerIds: z.array(z.string()) }))
		.mutation(async ({ ctx, input }) => {
			const result = await sessionService.resolveCoinToss(ctx.db, {
				coinTossId: input.coinTossId,
				resolvedWinnerIds: input.resolvedWinnerIds,
			});

			const sessionInfo = await getSessionForOrg(
				ctx.db,
				result.resolved.sessionId,
				ctx.organizationId
			);

			ctx.waitUntil(
				broadcastSeasonEvent(ctx.env, ctx.organization.slug, sessionInfo.seasonSlug, {
					type: "session:update",
					data: {
						sessionId: result.resolved.sessionId,
						resolvedCoinToss: result.resolved,
						proposedLineup: result.proposedLineup,
					},
					user: { id: ctx.authentication.user.id, name: ctx.authentication.user.name },
				})
			);

			return { resolved: result.resolved, proposedLineup: result.proposedLineup };
		}),

	end: leagueMemberProcedure
		.input(z.object({ sessionId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const sessionInfo = await getSessionForOrg(ctx.db, input.sessionId, ctx.organizationId);

			const ended = await sessionRepository.endSession({
				db: ctx.db,
				sessionId: input.sessionId,
			});

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
		.input(z.object({ seasonSlug: z.string(), limit: z.number().min(1).max(50).optional() }))
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

			const result = await sessionRepository.cancelCurrentMatch({
				db: ctx.db,
				sessionId: input.sessionId,
			});

			const outPlayerIds = result.restoredProposedLineup
				? [
						...result.restoredProposedLineup.homePlayerIds,
						...result.restoredProposedLineup.awayPlayerIds,
					].filter((id) => result.players.find((p) => p.id === id)?.status === "out")
				: [];

			for (const removedSessionPlayerId of outPlayerIds) {
				await sessionService.recomputeLineupAfterPlayerRemoval(ctx.db, {
					sessionId: input.sessionId,
					removedSessionPlayerId,
				});
			}

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

			const result = await sessionRepository.deleteLastMatch({
				db: ctx.db,
				sessionId: input.sessionId,
			});

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

			const updated = await sessionRepository.updateMatchScore({
				db: ctx.db,
				sessionId: input.sessionId,
				sessionMatchId: input.sessionMatchId,
				homeScore: input.homeScore,
				awayScore: input.awayScore,
			});

			return updated;
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

			const updated = await sessionRepository.updateTeamSelection({
				db: ctx.db,
				sessionId: input.sessionId,
				sessionMatchId: input.sessionMatchId,
				selectedHomePlayerIds: input.selectedHomePlayerIds,
				selectedAwayPlayerIds: input.selectedAwayPlayerIds,
			});

			return updated;
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

			const updated = await sessionRepository.updateProposedLineup({
				db: ctx.db,
				sessionId: input.sessionId,
				proposedLineup: input.proposedLineup,
			});

			return updated;
		}),
} satisfies TRPCRouterRecord;
