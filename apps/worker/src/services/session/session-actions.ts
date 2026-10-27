import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { isSessionAutoCloseExpired } from "@coding-cowboys/scorebrawl-core/session";
import type { HonoEnv } from "../../middleware/context";
import type { DrizzleDB } from "../../db";
import {
	seasonPlayer,
	player,
	gameSession,
	sessionMatch,
	sessionPlayer,
} from "../../db/schema/league-schema";
import * as sessionRepository from "../../repositories/session";
import * as matchRepository from "../../repositories/match-repository";
import * as seasonRepository from "../../repositories/season-repository";
import { broadcastSeasonEvent } from "../../routes/sse-router";
import {
	recordResult as recordResultService,
	resolveCoinToss as resolveCoinTossService,
	recomputeProposedLineup as recomputeProposedLineupService,
	recomputeLineupAfterPlayerRemoval as recomputeLineupAfterPlayerRemovalService,
} from "./session-service";
import type { AchievementQueueMessage } from "../achievement-calculation";
import { buildStreakPushEvents, sessionStarted, teamsFormed } from "../notification-events";
import { sendLeaguePush, sendSessionPush } from "../push-notification";
import type { LineupNames } from "./session-service";

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

function sendTeamsFormedPush(
	ctx: SessionActionContext,
	session: { id: string; seasonSlug: string },
	lineupNames: LineupNames | null,
	actorId: string
) {
	if (!lineupNames) return;

	ctx.waitUntil(
		sendSessionPush({
			db: ctx.db,
			sessionId: session.id,
			events: [
				teamsFormed(
					{
						type: "session:teams",
						leagueSlug: ctx.organization.slug,
						seasonSlug: session.seasonSlug,
						sessionId: session.id,
					},
					{ ...lineupNames, actorId }
				),
			],
		})
	);
}

function assertSessionsAllowed(session: { scoreType: string }) {
	if (session.scoreType === "1-v-n-elo") {
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
): Promise<{ id: string; seasonId: string; seasonSlug: string; scoreType: string }> {
	if (sessionId) {
		const info = await sessionRepository.getSessionWithSeason({ db: ctx.db, sessionId });
		if (!info) {
			throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
		}
		if (info.leagueId !== leagueId) {
			throw new TRPCError({ code: "FORBIDDEN", message: "Session not in your league" });
		}
		return {
			id: info.sessionId,
			seasonId: info.sessionSeasonId,
			seasonSlug: info.seasonSlug,
			scoreType: info.seasonScoreType,
		};
	}

	const active = await sessionRepository.getActiveSessionsForLeague({ db: ctx.db, leagueId });
	if (active.length === 0) {
		throw new TRPCError({ code: "NOT_FOUND", message: "No active session" });
	}
	if (active.length > 1) {
		throw new TRPCError({ code: "CONFLICT", message: "Multiple active sessions" });
	}
	const session = active[0]!;
	return {
		id: session.id,
		seasonId: session.seasonId,
		seasonSlug: session.seasonSlug,
		scoreType: session.scoreType,
	};
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

async function resolveProposedLineup(
	ctx: SessionActionContext,
	sessionId: string
): Promise<{ home: string[]; away: string[] }> {
	const [row] = await ctx.db
		.select({ proposedLineup: gameSession.proposedLineup })
		.from(gameSession)
		.where(eq(gameSession.id, sessionId))
		.limit(1);

	const proposed = sessionRepository.parseProposedLineup(row?.proposedLineup);
	const homeSessionPlayerIds = proposed?.selectedHomePlayerIds?.length
		? proposed.selectedHomePlayerIds
		: (proposed?.homePlayerIds ?? []);
	const awaySessionPlayerIds = proposed?.selectedAwayPlayerIds?.length
		? proposed.selectedAwayPlayerIds
		: (proposed?.awayPlayerIds ?? []);

	const sessionPlayerIds = [...new Set([...homeSessionPlayerIds, ...awaySessionPlayerIds])];
	const sessionPlayers =
		sessionPlayerIds.length > 0
			? await ctx.db
					.select({
						id: sessionPlayer.id,
						seasonPlayerId: sessionPlayer.seasonPlayerId,
						status: sessionPlayer.status,
					})
					.from(sessionPlayer)
					.where(
						and(eq(sessionPlayer.sessionId, sessionId), inArray(sessionPlayer.id, sessionPlayerIds))
					)
			: [];

	const seasonPlayerIdBySessionPlayerId = new Map(
		sessionPlayers.filter((p) => p.status !== "out").map((p) => [p.id, p.seasonPlayerId])
	);
	const toSeasonPlayerIds = (ids: string[]) =>
		ids
			.map((id) => seasonPlayerIdBySessionPlayerId.get(id))
			.filter((id): id is string => id !== undefined);

	return {
		home: toSeasonPlayerIds(homeSessionPlayerIds),
		away: toSeasonPlayerIds(awaySessionPlayerIds),
	};
}

export async function startSession(ctx: SessionActionContext, input: StartSessionInput) {
	const season = await resolveSeasonBySlug(ctx, input.seasonSlug);

	if (season.scoreType === "1-v-n-elo") {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Sessions are not available for 1-v-n seasons",
		});
	}

	const activeSessions = await sessionRepository.getActiveSessionsForLeague({
		db: ctx.db,
		leagueId: ctx.organization.id,
	});

	const liveSession = activeSessions.find(
		(active) => !isSessionAutoCloseExpired(active.autoEndsAt)
	);
	if (liveSession) {
		throw new TRPCError({
			code: "CONFLICT",
			message: `A session is already active in "${liveSession.seasonName}"`,
		});
	}

	await Promise.all(
		activeSessions.map((active) =>
			endActiveSession(ctx, { id: active.id, seasonSlug: active.seasonSlug })
		)
	);

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

	return endActiveSession(ctx, session, ctx.user);
}

type EndableSession = { id: string; seasonSlug: string };
type EndedSession = NonNullable<Awaited<ReturnType<typeof sessionRepository.endSession>>>;

function broadcastSessionEnd(
	ctx: SessionActionContext,
	seasonSlug: string,
	sessionRow: EndedSession,
	actor?: { id: string; name: string }
) {
	ctx.waitUntil(
		broadcastSeasonEvent(ctx.env, ctx.organization.slug, seasonSlug, {
			type: "session:end",
			data: { session: sessionRow },
			...(actor ? { user: actor } : {}),
		})
	);
}

async function endActiveSession(
	ctx: SessionActionContext,
	session: EndableSession,
	actor?: { id: string; name: string }
) {
	const ended = await sessionRepository.endSession({ db: ctx.db, sessionId: session.id });

	if (!ended) {
		const existing = await sessionRepository.getSessionById({ db: ctx.db, sessionId: session.id });
		if (!existing) {
			throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
		}
		return existing;
	}

	broadcastSessionEnd(ctx, session.seasonSlug, ended, actor);

	return ended;
}

export async function closeExpiredSession(
	ctx: SessionActionContext,
	leagueId: string,
	{ sessionId }: { sessionId: string }
) {
	const session = await resolveSession(ctx, leagueId, sessionId);
	const expired = await sessionRepository.findExpiredSession({
		db: ctx.db,
		sessionId: session.id,
		now: new Date(),
	});

	if (!expired) return null;

	return endActiveSession(ctx, session);
}

export async function closeExpiredSessionsForSeason(
	ctx: SessionActionContext,
	{ seasonId, seasonSlug }: { seasonId: string; seasonSlug: string }
) {
	const expired = await sessionRepository.findExpiredActiveSessions({
		db: ctx.db,
		seasonId,
		now: new Date(),
	});

	if (expired.length === 0) return [];

	const ended = await Promise.all(
		expired.map((session) => endActiveSession(ctx, { id: session.id, seasonSlug }))
	);

	return ended;
}

export async function extendSession(
	ctx: SessionActionContext,
	leagueId: string,
	input: { sessionId: string }
) {
	const session = await resolveSession(ctx, leagueId, input.sessionId);

	if (session.scoreType === "1-v-n-elo") {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Sessions are not available for 1-v-n seasons",
		});
	}

	const updated = await sessionRepository.extendSession({ db: ctx.db, sessionId: session.id });

	if (!updated) {
		throw new TRPCError({ code: "NOT_FOUND", message: "Active session not found" });
	}

	ctx.waitUntil(
		broadcastSeasonEvent(ctx.env, ctx.organization.slug, session.seasonSlug, {
			type: "session:update",
			data: { sessionId: session.id, autoEndsAt: updated.autoEndsAt },
			user: { id: ctx.user.id, name: ctx.user.name },
		})
	);

	return updated;
}

export async function startNextMatch(
	ctx: SessionActionContext,
	leagueId: string,
	input: { sessionId?: string; home?: string[]; away?: string[]; sessionMatchId?: string }
) {
	const session = await resolveSession(ctx, leagueId, input.sessionId);
	assertSessionsAllowed(session);

	let home = input.home;
	let away = input.away;

	if (!home || !away) {
		const proposed = await resolveProposedLineup(ctx, session.id);
		home = home ?? proposed.home;
		away = away ?? proposed.away;
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
	assertSessionsAllowed(session);

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
	sendTeamsFormedPush(ctx, session, result.lineupNames, ctx.user.id);

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

async function mapSeasonPlayerIdsToSessionPlayerIds(
	ctx: SessionActionContext,
	sessionId: string,
	homeSeasonPlayerIds: string[],
	awaySeasonPlayerIds: string[]
): Promise<{ home: string[]; away: string[] }> {
	const playerIds = [...new Set([...homeSeasonPlayerIds, ...awaySeasonPlayerIds])];
	const sessionPlayerIdBySeasonPlayerId = new Map<string, string>();

	if (playerIds.length > 0) {
		const found = await ctx.db
			.select({ id: sessionPlayer.id, seasonPlayerId: sessionPlayer.seasonPlayerId })
			.from(sessionPlayer)
			.where(
				and(
					eq(sessionPlayer.sessionId, sessionId),
					inArray(sessionPlayer.seasonPlayerId, playerIds)
				)
			);
		if (found.length !== playerIds.length) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "Lineup contains players not in this session",
			});
		}
		for (const sessionPlayerRow of found) {
			sessionPlayerIdBySeasonPlayerId.set(sessionPlayerRow.seasonPlayerId, sessionPlayerRow.id);
		}
	}

	const toSessionPlayerIds = (seasonPlayerIds: string[]) =>
		seasonPlayerIds
			.map((id) => sessionPlayerIdBySeasonPlayerId.get(id))
			.filter((id): id is string => id !== undefined);

	return {
		home: toSessionPlayerIds(homeSeasonPlayerIds),
		away: toSessionPlayerIds(awaySeasonPlayerIds),
	};
}

export async function updateTeamSelection(
	ctx: SessionActionContext,
	leagueId: string,
	input: {
		sessionId?: string;
		sessionMatchId?: string;
		selectedHomePlayerIds: string[];
		selectedAwayPlayerIds: string[];
	}
) {
	const session = await resolveSession(ctx, leagueId, input.sessionId);
	const sessionMatchId = await resolveCurrentMatchId(ctx, session.id, input.sessionMatchId);

	const updated = await sessionRepository.updateTeamSelection({
		db: ctx.db,
		sessionId: session.id,
		sessionMatchId,
		selectedHomePlayerIds: input.selectedHomePlayerIds,
		selectedAwayPlayerIds: input.selectedAwayPlayerIds,
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

export async function setLineup(
	ctx: SessionActionContext,
	leagueId: string,
	input: { sessionId?: string; home: string[]; away: string[] }
) {
	const session = await resolveSession(ctx, leagueId, input.sessionId);
	const { home, away } = await mapSeasonPlayerIdsToSessionPlayerIds(
		ctx,
		session.id,
		input.home,
		input.away
	);

	return updateTeamSelection(ctx, leagueId, {
		sessionId: session.id,
		selectedHomePlayerIds: home,
		selectedAwayPlayerIds: away,
	});
}

export async function joinSelf(
	ctx: SessionActionContext,
	_leagueId: string,
	input: { sessionId: string }
) {
	const session = await sessionRepository.getSessionWithSeason({
		db: ctx.db,
		sessionId: input.sessionId,
	});

	if (!session) {
		throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
	}

	if (session.sessionStatus !== "active") {
		throw new TRPCError({ code: "BAD_REQUEST", message: "Session is not active" });
	}

	const [seasonPlayerRecord] = await ctx.db
		.select({
			id: seasonPlayer.id,
			alreadyInSession: sql<boolean>`EXISTS(
				SELECT 1 FROM ${sessionPlayer}
				WHERE ${sessionPlayer.sessionId} = ${session.sessionId}
				AND ${sessionPlayer.seasonPlayerId} = ${seasonPlayer.id}
			)`.as("already_in_session"),
		})
		.from(seasonPlayer)
		.innerJoin(player, eq(seasonPlayer.playerId, player.id))
		.where(and(eq(seasonPlayer.seasonId, session.sessionSeasonId), eq(player.userId, ctx.user.id)))
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
		sessionId: session.sessionId,
		seasonPlayerId: seasonPlayerRecord.id,
	});

	await recomputeProposedLineupService(ctx.db, session.sessionId);

	ctx.waitUntil(
		broadcastSeasonEvent(ctx.env, ctx.organization.slug, session.seasonSlug, {
			type: "session:update",
			data: { sessionId: session.sessionId, player: newPlayer },
			user: { id: ctx.user.id, name: ctx.user.name },
		})
	);

	return newPlayer;
}

export async function addPlayer(
	ctx: SessionActionContext,
	leagueId: string,
	input: { sessionId: string; seasonPlayerId: string }
) {
	const session = await resolveSession(ctx, leagueId, input.sessionId);

	const newPlayer = await sessionRepository.addPlayerToSession({
		db: ctx.db,
		sessionId: session.id,
		seasonPlayerId: input.seasonPlayerId,
	});

	await recomputeProposedLineupService(ctx.db, session.id);

	ctx.waitUntil(
		broadcastSeasonEvent(ctx.env, ctx.organization.slug, session.seasonSlug, {
			type: "session:update",
			data: { sessionId: session.id, player: newPlayer },
			user: { id: ctx.user.id, name: ctx.user.name },
		})
	);

	return newPlayer;
}

export async function removePlayer(
	ctx: SessionActionContext,
	leagueId: string,
	input: { sessionId: string; sessionPlayerId: string }
) {
	const session = await resolveSession(ctx, leagueId, input.sessionId);

	const removedPlayer = await sessionRepository.removePlayerFromSession({
		db: ctx.db,
		sessionId: session.id,
		sessionPlayerId: input.sessionPlayerId,
	});

	const fullSession = await sessionRepository.getSessionById({ db: ctx.db, sessionId: session.id });
	const hasActiveMatch = fullSession?.matches.some((m) => m.result === null) ?? false;

	if (!hasActiveMatch) {
		const lineupNames = await recomputeLineupAfterPlayerRemovalService(ctx.db, {
			sessionId: session.id,
			removedSessionPlayerId: removedPlayer.id,
		});
		sendTeamsFormedPush(ctx, session, lineupNames, ctx.user.id);
	}

	ctx.waitUntil(
		broadcastSeasonEvent(ctx.env, ctx.organization.slug, session.seasonSlug, {
			type: "session:update",
			data: { sessionId: session.id, removedSessionPlayerId: input.sessionPlayerId },
			user: { id: ctx.user.id, name: ctx.user.name },
		})
	);
}

export async function resolveCoinToss(
	ctx: SessionActionContext,
	leagueId: string,
	input: { coinTossId: string; resolvedWinnerIds: string[] }
) {
	const result = await resolveCoinTossService(ctx.db, {
		coinTossId: input.coinTossId,
		resolvedWinnerIds: input.resolvedWinnerIds,
	});

	const session = await resolveSession(ctx, leagueId, result.resolved.sessionId);
	sendTeamsFormedPush(ctx, session, result.lineupNames, ctx.user.id);

	ctx.waitUntil(
		broadcastSeasonEvent(ctx.env, ctx.organization.slug, session.seasonSlug, {
			type: "session:update",
			data: {
				sessionId: result.resolved.sessionId,
				resolvedCoinToss: result.resolved,
				proposedLineup: result.proposedLineup,
			},
			user: { id: ctx.user.id, name: ctx.user.name },
		})
	);

	return { resolved: result.resolved, proposedLineup: result.proposedLineup };
}

export async function cancelMatch(
	ctx: SessionActionContext,
	leagueId: string,
	input: { sessionId?: string } = {}
) {
	const session = await resolveSession(ctx, leagueId, input.sessionId);
	assertSessionsAllowed(session);

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
		await recomputeLineupAfterPlayerRemovalService(ctx.db, {
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
		players: result.players,
		restoredProposedLineup: result.restoredProposedLineup,
	};
}

export async function updateLiveScore(
	ctx: SessionActionContext,
	leagueId: string,
	input: { sessionId?: string; home: number; away: number }
) {
	const session = await resolveSession(ctx, leagueId, input.sessionId);
	assertSessionsAllowed(session);

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
			type: "session:score-update",
			data: {
				sessionId: session.id,
				sessionMatchId,
				homeScore: input.home,
				awayScore: input.away,
			},
			user: { id: ctx.user.id, name: ctx.user.name },
		})
	);

	return updated;
}

export async function deleteLastMatch(
	ctx: SessionActionContext,
	leagueId: string,
	input: { sessionId: string }
) {
	const session = await resolveSession(ctx, leagueId, input.sessionId);

	const result = await sessionRepository.deleteLastMatch({
		db: ctx.db,
		sessionId: session.id,
	});

	if (result.deletedMatch.matchId) {
		await matchRepository.remove({
			db: ctx.db,
			matchId: result.deletedMatch.matchId,
			seasonId: session.seasonId,
		});
	}

	ctx.waitUntil(
		broadcastSeasonEvent(ctx.env, ctx.organization.slug, session.seasonSlug, {
			type: "session:update",
			data: { sessionId: session.id, players: result.players },
			user: { id: ctx.user.id, name: ctx.user.name },
		})
	);

	ctx.waitUntil(
		broadcastSeasonEvent(ctx.env, ctx.organization.slug, session.seasonSlug, {
			type: "match:delete",
			data: { matchId: result.deletedMatch.matchId },
			user: { id: ctx.user.id, name: ctx.user.name },
		})
	);

	return result;
}

export async function updateMatchScore(
	ctx: SessionActionContext,
	leagueId: string,
	input: { sessionId: string; sessionMatchId: string; homeScore: number; awayScore: number }
) {
	const session = await resolveSession(ctx, leagueId, input.sessionId);

	const updated = await sessionRepository.updateMatchScore({
		db: ctx.db,
		sessionId: session.id,
		sessionMatchId: input.sessionMatchId,
		homeScore: input.homeScore,
		awayScore: input.awayScore,
	});

	ctx.waitUntil(
		broadcastSeasonEvent(ctx.env, ctx.organization.slug, session.seasonSlug, {
			type: "session:score-update",
			data: {
				sessionId: session.id,
				sessionMatchId: input.sessionMatchId,
				homeScore: input.homeScore,
				awayScore: input.awayScore,
			},
			user: { id: ctx.user.id, name: ctx.user.name },
		})
	);

	return updated;
}

export async function updateProposedLineup(
	ctx: SessionActionContext,
	leagueId: string,
	input: {
		sessionId: string;
		proposedLineup: {
			homePlayerIds: string[];
			awayPlayerIds: string[];
			rotatedOut: string[];
			coinTossNeeded: { conflictType: string; candidates: string[] } | null;
			selectedHomePlayerIds?: string[];
			selectedAwayPlayerIds?: string[];
		};
	}
) {
	const session = await resolveSession(ctx, leagueId, input.sessionId);

	return sessionRepository.updateProposedLineup({
		db: ctx.db,
		sessionId: session.id,
		proposedLineup: input.proposedLineup,
	});
}

export async function updateSettings(
	ctx: SessionActionContext,
	leagueId: string,
	input: {
		sessionId: string;
		settings: {
			teamSize?: number;
			maxConsecutiveGames?: number | null;
			maxConsecutiveEnabled?: boolean;
			winnersTakePriority?: boolean;
			autoCoinToss?: boolean;
			randomizerType?: "off" | "fisher-yates" | "diversity";
			alwaysSplitConstraints?: [string, string][];
		};
	}
) {
	const session = await resolveSession(ctx, leagueId, input.sessionId);

	const updatedSession = await sessionRepository.updateSessionSettings({
		db: ctx.db,
		sessionId: session.id,
		settings: input.settings,
	});

	const shouldRecalcQueue =
		input.settings.winnersTakePriority !== undefined ||
		input.settings.maxConsecutiveEnabled !== undefined ||
		input.settings.maxConsecutiveGames !== undefined;

	if (shouldRecalcQueue) {
		await sessionRepository.recalcQueuePositions(ctx.db, session.id);
	}

	await recomputeProposedLineupService(ctx.db, session.id);

	ctx.waitUntil(
		broadcastSeasonEvent(ctx.env, ctx.organization.slug, session.seasonSlug, {
			type: "session:update",
			data: { sessionId: session.id, settings: updatedSession },
			user: { id: ctx.user.id, name: ctx.user.name },
		})
	);

	return updatedSession;
}
