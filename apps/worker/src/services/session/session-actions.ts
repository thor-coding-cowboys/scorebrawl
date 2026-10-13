import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import type { HonoEnv } from "../../middleware/context";
import type { DrizzleDB } from "../../db";
import { seasonPlayer, player, gameSession, sessionMatch } from "../../db/schema/league-schema";
import * as sessionRepository from "../../repositories/session";
import * as matchRepository from "../../repositories/match-repository";
import * as seasonRepository from "../../repositories/season-repository";
import { broadcastSeasonEvent } from "../../routes/sse-router";
import {
	recomputeLineupAfterPlayerRemoval,
	recordResult as recordResultService,
} from "./session-service";
import type { AchievementQueueMessage } from "../achievement-calculation";
import { buildStreakPushEvents, sessionStarted } from "../notification-events";
import { sendLeaguePush } from "../push-notification";

export type SessionActionContext = {
	db: DrizzleDB;
	env: HonoEnv["Bindings"];
	organization: { id: string; slug: string; name: string };
	user: { id: string; name: string };
	waitUntil: (promise: Promise<unknown>) => void;
};

export type StartSessionInput = {
	seasonSlug: string;
	rotationMode?: "winner-stays" | "manual";
	teamSize?: number;
	maxConsecutiveGames?: number | null;
	seasonPlayerIds?: string[];
	alwaysSplitConstraints?: [string, string][];
	autoCoinToss?: boolean;
	winnersTakePriority?: boolean;
	maxConsecutiveEnabled?: boolean;
	randomizerType?: "off" | "fisher-yates" | "diversity";
};

async function resolveSeasonBySlug(ctx: SessionActionContext, seasonSlug: string) {
	try {
		return await seasonRepository.getBySlug({
			db: ctx.db,
			seasonSlug,
			leagueId: ctx.organization.id,
		});
	} catch (error) {
		if (error instanceof Error && error.message === "Season not found") {
			throw new TRPCError({ code: "NOT_FOUND", message: "Season not found" });
		}
		throw error;
	}
}

async function assertSessionsAllowed(ctx: SessionActionContext, seasonId: string) {
	const season = await seasonRepository.getById({ db: ctx.db, seasonId });
	if (season.scoreType === "1-v-n-elo") {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Sessions are not available for 1-v-n seasons",
		});
	}
}

async function resolveSession(
	ctx: SessionActionContext,
	leagueId: string,
	sessionId?: string
): Promise<{ id: string; seasonId: string; seasonSlug: string }> {
	if (sessionId) {
		const info = await sessionRepository.getSessionWithSeason({ db: ctx.db, sessionId });
		if (!info) {
			throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
		}
		if (info.leagueId !== leagueId) {
			throw new TRPCError({ code: "FORBIDDEN", message: "Session not in your league" });
		}
		return { id: info.sessionId, seasonId: info.sessionSeasonId, seasonSlug: info.seasonSlug };
	}

	const active = await sessionRepository.getActiveSessionsForLeague({ db: ctx.db, leagueId });
	if (active.length === 0) {
		throw new TRPCError({ code: "NOT_FOUND", message: "No active session" });
	}
	if (active.length > 1) {
		throw new TRPCError({ code: "CONFLICT", message: "Multiple active sessions" });
	}
	const session = active[0]!;
	return { id: session.id, seasonId: session.seasonId, seasonSlug: session.seasonSlug };
}

async function resolveCurrentMatchId(
	ctx: SessionActionContext,
	sessionId: string,
	sessionMatchId?: string
) {
	if (sessionMatchId) return sessionMatchId;

	const [match] = await ctx.db
		.select({ id: sessionMatch.id })
		.from(sessionMatch)
		.where(and(eq(sessionMatch.sessionId, sessionId), isNull(sessionMatch.result)))
		.orderBy(desc(sessionMatch.matchNumber))
		.limit(1);

	if (!match) {
		throw new TRPCError({ code: "NOT_FOUND", message: "No in-progress match" });
	}
	return match.id;
}

export async function startSession(ctx: SessionActionContext, input: StartSessionInput) {
	const season = await resolveSeasonBySlug(ctx, input.seasonSlug);

	if (season.scoreType === "1-v-n-elo") {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Sessions are not available for 1-v-n seasons",
		});
	}

	const active = await sessionRepository.getActiveSession({ db: ctx.db, seasonId: season.id });
	if (active) {
		throw new TRPCError({ code: "CONFLICT", message: "An active session already exists" });
	}

	const seasonPlayerIds =
		input.seasonPlayerIds ??
		(
			await ctx.db
				.select({ id: seasonPlayer.id })
				.from(seasonPlayer)
				.innerJoin(player, eq(seasonPlayer.playerId, player.id))
				.where(and(eq(seasonPlayer.seasonId, season.id), eq(seasonPlayer.disabled, false)))
		).map((p) => p.id);

	const session = await sessionRepository.createSession({
		db: ctx.db,
		seasonId: season.id,
		createdBy: ctx.user.id,
		rotationMode: input.rotationMode ?? "winner-stays",
		teamSize: input.teamSize ?? 1,
		maxConsecutiveGames: input.maxConsecutiveGames ?? null,
		alwaysSplitConstraints: input.alwaysSplitConstraints ?? [],
		autoCoinToss: input.autoCoinToss ?? false,
		seasonPlayerIds,
		winnersTakePriority: input.winnersTakePriority ?? false,
		maxConsecutiveEnabled: input.maxConsecutiveEnabled ?? false,
		randomizerType: input.randomizerType ?? "fisher-yates",
	});

	ctx.waitUntil(
		broadcastSeasonEvent(ctx.env, ctx.organization.slug, input.seasonSlug, {
			type: "session:start",
			data: { session },
			user: { id: ctx.user.id, name: ctx.user.name },
		})
	);

	ctx.waitUntil(
		sendLeaguePush({
			db: ctx.db,
			organizationId: ctx.organization.id,
			events: [
				sessionStarted(
					{
						type: "session:start",
						leagueSlug: ctx.organization.slug,
						seasonSlug: input.seasonSlug,
						sessionId: session.id,
					},
					{
						actorId: ctx.user.id,
						actorName: ctx.user.name,
						leagueName: ctx.organization.name,
					}
				),
			],
		})
	);

	return session;
}

export async function endSession(
	ctx: SessionActionContext,
	leagueId: string,
	input: { sessionId?: string } = {}
) {
	const session = await resolveSession(ctx, leagueId, input.sessionId);

	const ended = await sessionRepository.endSession({ db: ctx.db, sessionId: session.id });

	ctx.waitUntil(
		broadcastSeasonEvent(ctx.env, ctx.organization.slug, session.seasonSlug, {
			type: "session:end",
			data: { session: ended },
			user: { id: ctx.user.id, name: ctx.user.name },
		})
	);

	return ended;
}

export async function startNextMatch(
	ctx: SessionActionContext,
	leagueId: string,
	input: { sessionId?: string; home?: string[]; away?: string[]; sessionMatchId?: string }
) {
	const session = await resolveSession(ctx, leagueId, input.sessionId);
	await assertSessionsAllowed(ctx, session.seasonId);

	let home = input.home;
	let away = input.away;

	if (!home || !away) {
		const [row] = await ctx.db
			.select({ proposedLineup: gameSession.proposedLineup })
			.from(gameSession)
			.where(eq(gameSession.id, session.id))
			.limit(1);
		const proposed = sessionRepository.parseProposedLineup(row?.proposedLineup);
		home = home ?? proposed?.homePlayerIds ?? [];
		away = away ?? proposed?.awayPlayerIds ?? [];
	}

	const sessionMatchRow = await sessionRepository.startNextMatch({
		db: ctx.db,
		sessionId: session.id,
		homeSeasonPlayerIds: home,
		awaySeasonPlayerIds: away,
	});

	ctx.waitUntil(
		broadcastSeasonEvent(ctx.env, ctx.organization.slug, session.seasonSlug, {
			type: "session:update",
			data: { sessionId: session.id, match: sessionMatchRow },
			user: { id: ctx.user.id, name: ctx.user.name },
		})
	);

	return sessionMatchRow;
}

export async function logMatch(
	ctx: SessionActionContext,
	leagueId: string,
	input: { sessionId?: string; home: number; away: number; sessionMatchId?: string }
) {
	const session = await resolveSession(ctx, leagueId, input.sessionId);
	await assertSessionsAllowed(ctx, session.seasonId);

	const hasExplicitMatch = input.sessionId !== undefined && input.sessionMatchId !== undefined;
	const sessionMatchId = hasExplicitMatch
		? input.sessionMatchId!
		: await resolveCurrentMatchId(ctx, session.id);

	const result = await recordResultService(ctx.db, {
		sessionId: session.id,
		sessionMatchId,
		homeScore: input.home,
		awayScore: input.away,
		seasonId: session.seasonId,
		userId: ctx.user.id,
	});

	ctx.waitUntil(
		ctx.env.ACHIEVEMENT_QUEUE.send({
			seasonPlayerIds: [
				...result.streakData.homeSeasonPlayerIds,
				...result.streakData.awaySeasonPlayerIds,
			],
			organizationId: ctx.organization.id,
			leagueSlug: ctx.organization.slug,
			seasonSlug: session.seasonSlug,
		} satisfies AchievementQueueMessage)
	);

	ctx.waitUntil(
		broadcastSeasonEvent(ctx.env, ctx.organization.slug, session.seasonSlug, {
			type: "session:update",
			data: {
				sessionId: session.id,
				match: result.match,
				players: result.players,
				proposedLineup: result.proposedLineup,
			},
			user: { id: ctx.user.id, name: ctx.user.name },
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

		const user = { id: ctx.user.id, name: ctx.user.name };
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
				broadcastSeasonEvent(ctx.env, ctx.organization.slug, session.seasonSlug, event)
			)
		);

		if (streakPlayers.length > 0) {
			await sendLeaguePush({
				db: ctx.db,
				organizationId: ctx.organization.id,
				events: buildStreakPushEvents(streakPlayers, {
					leagueSlug: ctx.organization.slug,
					seasonSlug: session.seasonSlug,
				}),
			});
		}
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
}

export async function setLineup(
	ctx: SessionActionContext,
	leagueId: string,
	input: { sessionId?: string; home: string[]; away: string[] }
) {
	const session = await resolveSession(ctx, leagueId, input.sessionId);

	const playerIds = [...new Set([...input.home, ...input.away])];
	if (playerIds.length > 0) {
		const found = await ctx.db
			.select({ id: seasonPlayer.id })
			.from(seasonPlayer)
			.where(and(eq(seasonPlayer.seasonId, session.seasonId), inArray(seasonPlayer.id, playerIds)));
		if (found.length !== playerIds.length) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "Lineup contains players not in this season",
			});
		}
	}

	const sessionMatchId = await resolveCurrentMatchId(ctx, session.id);

	const updated = await sessionRepository.updateTeamSelection({
		db: ctx.db,
		sessionId: session.id,
		sessionMatchId,
		selectedHomePlayerIds: input.home,
		selectedAwayPlayerIds: input.away,
	});

	ctx.waitUntil(
		broadcastSeasonEvent(ctx.env, ctx.organization.slug, session.seasonSlug, {
			type: "session:update",
			data: { sessionId: session.id, teamSelection: updated },
			user: { id: ctx.user.id, name: ctx.user.name },
		})
	);

	return updated;
}

export async function updateLiveScore(
	ctx: SessionActionContext,
	leagueId: string,
	input: { sessionId?: string; home: number; away: number }
) {
	const session = await resolveSession(ctx, leagueId, input.sessionId);
	await assertSessionsAllowed(ctx, session.seasonId);

	const sessionMatchId = await resolveCurrentMatchId(ctx, session.id);

	const updated = await sessionRepository.updateMatchScore({
		db: ctx.db,
		sessionId: session.id,
		sessionMatchId,
		homeScore: input.home,
		awayScore: input.away,
	});

	ctx.waitUntil(
		broadcastSeasonEvent(ctx.env, ctx.organization.slug, session.seasonSlug, {
			type: "session:update",
			data: { sessionId: session.id, match: updated },
			user: { id: ctx.user.id, name: ctx.user.name },
		})
	);

	return updated;
}

export async function cancelMatch(
	ctx: SessionActionContext,
	leagueId: string,
	input: { sessionId?: string } = {}
) {
	const session = await resolveSession(ctx, leagueId, input.sessionId);
	await assertSessionsAllowed(ctx, session.seasonId);

	const result = await sessionRepository.cancelCurrentMatch({
		db: ctx.db,
		sessionId: session.id,
	});

	const outPlayerIds = result.restoredProposedLineup
		? [
				...result.restoredProposedLineup.homePlayerIds,
				...result.restoredProposedLineup.awayPlayerIds,
			].filter((id) => result.players.find((p) => p.id === id)?.status === "out")
		: [];
	for (const removedSessionPlayerId of outPlayerIds) {
		await recomputeLineupAfterPlayerRemoval(ctx.db, {
			sessionId: session.id,
			removedSessionPlayerId,
		});
	}

	ctx.waitUntil(
		broadcastSeasonEvent(ctx.env, ctx.organization.slug, session.seasonSlug, {
			type: "session:update",
			data: { sessionId: session.id, players: result.players },
			user: { id: ctx.user.id, name: ctx.user.name },
		})
	);

	return {
		deletedMatch: result.deletedMatch,
		restoredProposedLineup: result.restoredProposedLineup,
	};
}
