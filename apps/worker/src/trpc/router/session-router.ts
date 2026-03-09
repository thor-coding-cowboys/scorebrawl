import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { leagueMemberProcedure } from "../trpc";
import * as sessionRepository from "../../repositories/session-repository";
import * as matchRepository from "../../repositories/match-repository";
import { broadcastSeasonEvent } from "../../routes/sse-router";
import { season, sessionCoinToss } from "../../db/schema/league-schema";
import { computeNextLineup } from "../../lib/session-rotation";
import type { AchievementQueueMessage } from "../../services/achievement-calculation";

type SessionDb = Parameters<typeof sessionRepository.getActiveSession>[0]["db"];

async function getSeasonBySlug(db: SessionDb, seasonSlug: string, organizationId: string) {
	const [s] = await db
		.select()
		.from(season)
		.where(and(eq(season.slug, seasonSlug), eq(season.leagueId, organizationId)))
		.limit(1);

	if (!s) {
		throw new TRPCError({ code: "NOT_FOUND", message: "Season not found" });
	}
	return s;
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
				rotationMode: z.enum(["winner-stays", "round-robin", "manual"]),
				teamSize: z.number().int().min(1).max(6),
				maxConsecutiveGames: z.number().int().min(1).nullable(),
				seasonPlayerIds: z.array(z.string()).min(2),
				alwaysSplitConstraints: z.array(z.tuple([z.string(), z.string()])).default([]),
				autoRandomize: z.boolean().default(false),
				autoCoinToss: z.boolean().default(false),
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
				autoRandomize: input.autoRandomize,
				autoCoinToss: input.autoCoinToss,
				seasonPlayerIds: input.seasonPlayerIds,
			});

			await broadcastSeasonEvent(ctx.env, ctx.organization.slug, input.seasonSlug, {
				type: "session:start",
				data: { session },
				user: { id: ctx.authentication.user.id, name: ctx.authentication.user.name },
			});

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

	addPlayer: leagueMemberProcedure
		.input(z.object({ sessionId: z.string(), seasonPlayerId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const sessionInfo = await getSessionForOrg(ctx.db, input.sessionId, ctx.organizationId);

			const newPlayer = await sessionRepository.addPlayerToSession({
				db: ctx.db,
				sessionId: input.sessionId,
				seasonPlayerId: input.seasonPlayerId,
			});

			await broadcastSeasonEvent(ctx.env, ctx.organization.slug, sessionInfo.seasonSlug, {
				type: "session:update",
				data: { sessionId: input.sessionId, player: newPlayer },
				user: { id: ctx.authentication.user.id, name: ctx.authentication.user.name },
			});

			return newPlayer;
		}),

	removePlayer: leagueMemberProcedure
		.input(z.object({ sessionId: z.string(), sessionPlayerId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const sessionInfo = await getSessionForOrg(ctx.db, input.sessionId, ctx.organizationId);

			await sessionRepository.removePlayerFromSession({
				db: ctx.db,
				sessionId: input.sessionId,
				sessionPlayerId: input.sessionPlayerId,
			});

			await broadcastSeasonEvent(ctx.env, ctx.organization.slug, sessionInfo.seasonSlug, {
				type: "session:update",
				data: { sessionId: input.sessionId, removedSessionPlayerId: input.sessionPlayerId },
				user: { id: ctx.authentication.user.id, name: ctx.authentication.user.name },
			});
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

			await broadcastSeasonEvent(ctx.env, ctx.organization.slug, sessionInfo.seasonSlug, {
				type: "session:update",
				data: { sessionId: input.sessionId, match: sessionMatch },
				user: { id: ctx.authentication.user.id, name: ctx.authentication.user.name },
			});

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

			const fullSession = await sessionRepository.getSessionById({
				db: ctx.db,
				sessionId: input.sessionId,
			});

			if (!fullSession) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
			}

			const sessionMatch = fullSession.matches.find((m) => m.id === input.sessionMatchId);
			if (!sessionMatch) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Session match not found" });
			}

			const homeSeasonPlayerIds: string[] = sessionMatch.homePlayerIds;
			const awaySeasonPlayerIds: string[] = sessionMatch.awayPlayerIds;

			const result: "home" | "away" | "draw" =
				input.homeScore > input.awayScore
					? "home"
					: input.awayScore > input.homeScore
						? "away"
						: "draw";

			const createdMatch = await matchRepository.create({
				db: ctx.db,
				input: {
					seasonId: sessionInfo.sessionSeasonId,
					homeScore: input.homeScore,
					awayScore: input.awayScore,
					homeTeamPlayerIds: homeSeasonPlayerIds,
					awayTeamPlayerIds: awaySeasonPlayerIds,
					userId: ctx.authentication.user.id,
				},
			});

			await ctx.env.ACHIEVEMENT_QUEUE.send({
				seasonPlayerIds: [...homeSeasonPlayerIds, ...awaySeasonPlayerIds],
			} satisfies AchievementQueueMessage);

			const { match: updatedMatch, players: updatedPlayers } =
				await sessionRepository.recordMatchResult({
					db: ctx.db,
					sessionId: input.sessionId,
					sessionMatchId: input.sessionMatchId,
					result,
					matchId: createdMatch.id,
				});

			const homeSessionPlayerIds = updatedPlayers
				.filter((p) => homeSeasonPlayerIds.includes(p.seasonPlayerId))
				.map((p) => p.id);
			const awaySessionPlayerIds = updatedPlayers
				.filter((p) => awaySeasonPlayerIds.includes(p.seasonPlayerId))
				.map((p) => p.id);

			let proposedLineup = computeNextLineup({
				mode: fullSession.rotationMode,
				teamSize: fullSession.teamSize,
				maxConsecutiveGames: fullSession.maxConsecutiveGames,
				alwaysSplitConstraints: fullSession.alwaysSplitConstraints,
				players: updatedPlayers.map((p) => ({
					id: p.id,
					seasonPlayerId: p.seasonPlayerId,
					status: p.status,
					queuePosition: p.queuePosition,
					gamesPlayedThisSession: p.gamesPlayedThisSession,
					consecutiveGames: p.consecutiveGames,
				})),
				lastResult: result,
				homePlayerIds: homeSessionPlayerIds,
				awayPlayerIds: awaySessionPlayerIds,
			});

			let coinTossId: string | null = null;
			let autoResolvedCoinToss: {
				winnerNames: string[];
				conflictType: string;
			} | null = null;

			if (proposedLineup.coinTossNeeded) {
				const { conflictType, candidates } = proposedLineup.coinTossNeeded;

				if (fullSession.autoCoinToss) {
					let resolvedWinnerIds: string[];
					if (conflictType === "draw-tiebreak") {
						resolvedWinnerIds = Math.random() < 0.5 ? homeSessionPlayerIds : awaySessionPlayerIds;
					} else {
						const shuffled = [...candidates];
						for (let i = shuffled.length - 1; i > 0; i--) {
							const j = Math.floor(Math.random() * (i + 1));
							[shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
						}
						const winnerCount = Math.ceil(candidates.length / 2);
						resolvedWinnerIds = shuffled.slice(0, winnerCount);
					}

					const coinToss = await sessionRepository.createCoinToss({
						db: ctx.db,
						sessionId: input.sessionId,
						sessionMatchId: input.sessionMatchId,
						conflictType,
						candidates,
					});
					await sessionRepository.resolveCoinToss({
						db: ctx.db,
						coinTossId: coinToss.id,
						resolvedWinnerIds,
					});

					proposedLineup = computeNextLineup({
						mode: fullSession.rotationMode,
						teamSize: fullSession.teamSize,
						maxConsecutiveGames: fullSession.maxConsecutiveGames,
						alwaysSplitConstraints: fullSession.alwaysSplitConstraints,
						players: updatedPlayers.map((p) => ({
							id: p.id,
							seasonPlayerId: p.seasonPlayerId,
							status: p.status,
							queuePosition: p.queuePosition,
							gamesPlayedThisSession: p.gamesPlayedThisSession,
							consecutiveGames: p.consecutiveGames,
						})),
						lastResult: result,
						homePlayerIds: homeSessionPlayerIds,
						awayPlayerIds: awaySessionPlayerIds,
						resolvedCoinTossWinnerIds: resolvedWinnerIds,
					});

					const winnerNames = resolvedWinnerIds
						.map((id) => fullSession.players.find((p) => p.id === id)?.displayName)
						.filter(Boolean) as string[];
					autoResolvedCoinToss = { winnerNames, conflictType };
				} else {
					const coinToss = await sessionRepository.createCoinToss({
						db: ctx.db,
						sessionId: input.sessionId,
						sessionMatchId: input.sessionMatchId,
						conflictType,
						candidates,
					});
					coinTossId = coinToss.id;
				}
			}

			await broadcastSeasonEvent(ctx.env, ctx.organization.slug, sessionInfo.seasonSlug, {
				type: "session:update",
				data: {
					sessionId: input.sessionId,
					match: updatedMatch,
					players: updatedPlayers,
					proposedLineup,
				},
				user: { id: ctx.authentication.user.id, name: ctx.authentication.user.name },
			});

			const [streakPlayers, streakTeams] = await Promise.all([
				matchRepository.checkStreakThresholds({
					db: ctx.db,
					seasonPlayerIds: [...homeSeasonPlayerIds, ...awaySeasonPlayerIds],
				}),
				matchRepository.checkTeamStreakThresholds({
					db: ctx.db,
					matchId: createdMatch.id,
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

			return {
				match: updatedMatch,
				players: updatedPlayers,
				proposedLineup,
				coinTossId,
				autoResolvedCoinToss,
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

			const resolved = await sessionRepository.resolveCoinToss({
				db: ctx.db,
				coinTossId: input.coinTossId,
				resolvedWinnerIds: input.resolvedWinnerIds,
			});

			if (!resolved) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Coin toss not found" });
			}

			const fullSession = await sessionRepository.getSessionById({
				db: ctx.db,
				sessionId: resolved.sessionId,
			});

			if (!fullSession) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
			}

			const resolvedWinnerIds = resolved.resolvedWinnerIds
				? sessionRepository.parseStringArray(resolved.resolvedWinnerIds)
				: [];

			const triggeringMatch = resolved.sessionMatchId
				? fullSession.matches.find((m) => m.id === resolved.sessionMatchId)
				: null;

			let proposedLineup = null;
			if (triggeringMatch?.result) {
				const homeSeasonPlayerIds: string[] = triggeringMatch.homePlayerIds;
				const awaySeasonPlayerIds: string[] = triggeringMatch.awayPlayerIds;

				proposedLineup = computeNextLineup({
					mode: fullSession.rotationMode,
					teamSize: fullSession.teamSize,
					maxConsecutiveGames: fullSession.maxConsecutiveGames,
					alwaysSplitConstraints: fullSession.alwaysSplitConstraints,
					players: fullSession.players.map((p) => ({
						id: p.id,
						seasonPlayerId: p.seasonPlayerId,
						status: p.status,
						queuePosition: p.queuePosition,
						gamesPlayedThisSession: p.gamesPlayedThisSession,
						consecutiveGames: p.consecutiveGames,
					})),
					lastResult: triggeringMatch.result,
					homePlayerIds: fullSession.players
						.filter((p) => homeSeasonPlayerIds.includes(p.seasonPlayerId))
						.map((p) => p.id),
					awayPlayerIds: fullSession.players
						.filter((p) => awaySeasonPlayerIds.includes(p.seasonPlayerId))
						.map((p) => p.id),
					resolvedCoinTossWinnerIds: resolvedWinnerIds,
				});
			}

			await broadcastSeasonEvent(ctx.env, ctx.organization.slug, sessionInfo.seasonSlug, {
				type: "session:update",
				data: {
					sessionId: resolved.sessionId,
					resolvedCoinToss: resolved,
					proposedLineup,
				},
				user: { id: ctx.authentication.user.id, name: ctx.authentication.user.name },
			});

			return { resolved, proposedLineup };
		}),

	end: leagueMemberProcedure
		.input(z.object({ sessionId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const sessionInfo = await getSessionForOrg(ctx.db, input.sessionId, ctx.organizationId);

			const ended = await sessionRepository.endSession({
				db: ctx.db,
				sessionId: input.sessionId,
			});

			await broadcastSeasonEvent(ctx.env, ctx.organization.slug, sessionInfo.seasonSlug, {
				type: "session:end",
				data: { session: ended },
				user: { id: ctx.authentication.user.id, name: ctx.authentication.user.name },
			});

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

			await broadcastSeasonEvent(ctx.env, ctx.organization.slug, sessionInfo.seasonSlug, {
				type: "session:update",
				data: { sessionId: input.sessionId, players: result.players },
				user: { id: ctx.authentication.user.id, name: ctx.authentication.user.name },
			});

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

			await broadcastSeasonEvent(ctx.env, ctx.organization.slug, sessionInfo.seasonSlug, {
				type: "session:update",
				data: { sessionId: input.sessionId, players: result.players },
				user: { id: ctx.authentication.user.id, name: ctx.authentication.user.name },
			});

			await broadcastSeasonEvent(ctx.env, ctx.organization.slug, sessionInfo.seasonSlug, {
				type: "match:delete",
				data: { matchId: result.deletedMatch.matchId },
				user: { id: ctx.authentication.user.id, name: ctx.authentication.user.name },
			});

			return result;
		}),
} satisfies TRPCRouterRecord;
