import { eq, and, asc, desc, sql, inArray, isNotNull } from "drizzle-orm";
import { newId } from "@coding-cowboys/scorebrawl-util/id-util";
import type { DrizzleDB } from "../../db";
import { withTransaction } from "../../db";
import { user } from "../../db/schema/auth-schema";
import {
	gameSession,
	sessionPlayer,
	sessionMatch,
	sessionCoinToss,
	seasonPlayer,
	season,
	player,
	guest,
} from "../../db/schema/league-schema";
import { enforceAlwaysSplit } from "../../lib/session-rotation";

export function parseStringArray(json: string | null | undefined): string[] {
	if (!json) return [];
	try {
		const parsed = JSON.parse(json);
		if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) {
			return parsed;
		}
		return [];
	} catch {
		return [];
	}
}

function fisherYatesShuffle<T>(arr: T[]): T[] {
	const result = [...arr];
	for (let i = result.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[result[i], result[j]] = [result[j], result[i]];
	}
	return result;
}

export function parseProposedLineup(json: string | null | undefined): {
	homePlayerIds: string[];
	awayPlayerIds: string[];
	rotatedOut: string[];
	coinTossNeeded: { conflictType: string; candidates: string[] } | null;
	selectedHomePlayerIds?: string[];
	selectedAwayPlayerIds?: string[];
} | null {
	if (!json) return null;
	try {
		const parsed = JSON.parse(json);
		if (
			typeof parsed === "object" &&
			parsed !== null &&
			Array.isArray(parsed.homePlayerIds) &&
			Array.isArray(parsed.awayPlayerIds) &&
			Array.isArray(parsed.rotatedOut) &&
			(parsed.coinTossNeeded === null ||
				(typeof parsed.coinTossNeeded === "object" &&
					typeof parsed.coinTossNeeded.conflictType === "string" &&
					Array.isArray(parsed.coinTossNeeded.candidates)))
		) {
			return {
				homePlayerIds: parsed.homePlayerIds,
				awayPlayerIds: parsed.awayPlayerIds,
				rotatedOut: parsed.rotatedOut,
				coinTossNeeded: parsed.coinTossNeeded,
				selectedHomePlayerIds: Array.isArray(parsed.selectedHomePlayerIds)
					? parsed.selectedHomePlayerIds
					: undefined,
				selectedAwayPlayerIds: Array.isArray(parsed.selectedAwayPlayerIds)
					? parsed.selectedAwayPlayerIds
					: undefined,
			};
		}
		return null;
	} catch {
		return null;
	}
}

export function parseAlwaysSplit(json: string | null | undefined): [string, string][] {
	if (!json) return [];
	try {
		const parsed = JSON.parse(json);
		if (
			Array.isArray(parsed) &&
			parsed.every(
				(x) =>
					Array.isArray(x) && x.length === 2 && typeof x[0] === "string" && typeof x[1] === "string"
			)
		) {
			return parsed as [string, string][];
		}
		return [];
	} catch {
		return [];
	}
}

async function getSessionPlayersWithDetails(db: DrizzleDB, sessionId: string) {
	return db
		.select({
			id: sessionPlayer.id,
			sessionId: sessionPlayer.sessionId,
			seasonPlayerId: sessionPlayer.seasonPlayerId,
			status: sessionPlayer.status,
			queuePosition: sessionPlayer.queuePosition,
			gamesPlayedThisSession: sessionPlayer.gamesPlayedThisSession,
			consecutiveGames: sessionPlayer.consecutiveGames,
			joinedAt: sessionPlayer.joinedAt,
			createdAt: sessionPlayer.createdAt,
			updatedAt: sessionPlayer.updatedAt,
			displayName: sql<string>`COALESCE(${user.name}, ${guest.displayName})`.as("display_name"),
			playerImage: user.image,
			score: seasonPlayer.score,
			userId: player.userId,
		})
		.from(sessionPlayer)
		.innerJoin(seasonPlayer, eq(sessionPlayer.seasonPlayerId, seasonPlayer.id))
		.innerJoin(player, eq(seasonPlayer.playerId, player.id))
		.leftJoin(user, eq(player.userId, user.id))
		.leftJoin(guest, eq(player.guestId, guest.id))
		.where(eq(sessionPlayer.sessionId, sessionId))
		.orderBy(asc(sessionPlayer.queuePosition));
}

export const createSession = async ({
	db,
	seasonId,
	createdBy,
	rotationMode,
	teamSize,
	maxConsecutiveGames,
	alwaysSplitConstraints,
	autoRandomize,
	autoCoinToss,
	seasonPlayerIds,
	winnersTakePriority,
	maxConsecutiveEnabled,
	randomizerType,
}: {
	db: DrizzleDB;
	seasonId: string;
	createdBy: string;
	rotationMode: "winner-stays" | "sequential" | "manual";
	teamSize: number;
	maxConsecutiveGames: number | null;
	alwaysSplitConstraints: [string, string][];
	autoRandomize: boolean;
	autoCoinToss: boolean;
	seasonPlayerIds: string[];
	winnersTakePriority: boolean;
	maxConsecutiveEnabled: boolean;
	randomizerType?: "fisher-yates" | "diversity";
}) => {
	return withTransaction(db, async (tx) => {
		const now = new Date();
		const sessionId = newId("gameSession");

		await tx.insert(gameSession).values({
			id: sessionId,
			seasonId,
			createdBy,
			status: "active",
			rotationMode,
			teamSize,
			maxConsecutiveGames,
			alwaysSplitConstraints: JSON.stringify(alwaysSplitConstraints),
			autoRandomize,
			autoCoinToss,
			winnersTakePriority,
			maxConsecutiveEnabled,
			randomizerType: randomizerType ?? "fisher-yates",
			createdAt: now,
			updatedAt: now,
		});

		const players = seasonPlayerIds.map((seasonPlayerId, index) => ({
			id: newId("sessionPlayer"),
			sessionId,
			seasonPlayerId,
			status: "waiting" as const,
			queuePosition: index,
			gamesPlayedThisSession: 0,
			consecutiveGames: 0,
			joinedAt: now,
			createdAt: now,
			updatedAt: now,
		}));

		await tx.insert(sessionPlayer).values(players);

		if (players.length >= teamSize * 2) {
			const shuffled = fisherYatesShuffle(players);
			const homePlayerIds = shuffled.slice(0, teamSize).map((p) => p.id);
			const awayPlayerIds = shuffled.slice(teamSize, teamSize * 2).map((p) => p.id);

			const playerStates = players.map((p) => ({
				id: p.id,
				seasonPlayerId: p.seasonPlayerId,
				status: p.status,
				queuePosition: p.queuePosition,
				gamesPlayedThisSession: p.gamesPlayedThisSession,
				consecutiveGames: p.consecutiveGames,
			}));

			const constrained = enforceAlwaysSplit(
				homePlayerIds,
				awayPlayerIds,
				alwaysSplitConstraints,
				playerStates
			);

			await tx
				.update(gameSession)
				.set({
					proposedLineup: JSON.stringify({
						homePlayerIds: constrained.homeIds,
						awayPlayerIds: constrained.awayIds,
						rotatedOut: [],
						coinTossNeeded: null,
						selectedHomePlayerIds: constrained.homeIds,
						selectedAwayPlayerIds: constrained.awayIds,
					}),
				})
				.where(eq(gameSession.id, sessionId));
		}

		const [session] = await tx.select().from(gameSession).where(eq(gameSession.id, sessionId));
		const sessionPlayers = await tx
			.select()
			.from(sessionPlayer)
			.where(eq(sessionPlayer.sessionId, sessionId))
			.orderBy(asc(sessionPlayer.queuePosition));

		return { ...session, players: sessionPlayers };
	});
};

export const getActiveSession = async ({ db, seasonId }: { db: DrizzleDB; seasonId: string }) => {
	const [session] = await db
		.select()
		.from(gameSession)
		.where(and(eq(gameSession.seasonId, seasonId), eq(gameSession.status, "active")))
		.limit(1);

	if (!session) return null;

	const players = await db
		.select()
		.from(sessionPlayer)
		.where(eq(sessionPlayer.sessionId, session.id))
		.orderBy(asc(sessionPlayer.queuePosition));

	return { ...session, players };
};

export const getActiveSessionFull = async ({
	db,
	seasonId,
}: {
	db: DrizzleDB;
	seasonId: string;
}) => {
	const [session] = await db
		.select()
		.from(gameSession)
		.where(and(eq(gameSession.seasonId, seasonId), eq(gameSession.status, "active")))
		.limit(1);

	if (!session) return null;

	const sessionId = session.id;

	const [players, matches, coinTosses] = await Promise.all([
		getSessionPlayersWithDetails(db, sessionId),
		db
			.select()
			.from(sessionMatch)
			.where(eq(sessionMatch.sessionId, sessionId))
			.orderBy(asc(sessionMatch.matchNumber)),
		db
			.select()
			.from(sessionCoinToss)
			.where(and(eq(sessionCoinToss.sessionId, sessionId), eq(sessionCoinToss.resolved, false))),
	]);

	return {
		...session,
		alwaysSplitConstraints: parseAlwaysSplit(session.alwaysSplitConstraints),
		proposedLineup: parseProposedLineup(session.proposedLineup),
		players,
		matches: matches.map((m) => ({
			...m,
			homePlayerIds: parseStringArray(m.homePlayerIds),
			awayPlayerIds: parseStringArray(m.awayPlayerIds),
			selectedHomePlayerIds: m.selectedHomePlayerIds
				? parseStringArray(m.selectedHomePlayerIds)
				: null,
			selectedAwayPlayerIds: m.selectedAwayPlayerIds
				? parseStringArray(m.selectedAwayPlayerIds)
				: null,
		})),
		pendingCoinTosses: coinTosses.map((ct) => ({
			...ct,
			candidates: parseStringArray(ct.candidates),
		})),
	};
};

export const getSessionById = async ({ db, sessionId }: { db: DrizzleDB; sessionId: string }) => {
	const [session] = await db
		.select()
		.from(gameSession)
		.where(eq(gameSession.id, sessionId))
		.limit(1);

	if (!session) return null;

	const [players, matches, coinTosses] = await Promise.all([
		getSessionPlayersWithDetails(db, sessionId),
		db
			.select()
			.from(sessionMatch)
			.where(eq(sessionMatch.sessionId, sessionId))
			.orderBy(asc(sessionMatch.matchNumber)),
		db
			.select()
			.from(sessionCoinToss)
			.where(and(eq(sessionCoinToss.sessionId, sessionId), eq(sessionCoinToss.resolved, false))),
	]);

	return {
		...session,
		alwaysSplitConstraints: parseAlwaysSplit(session.alwaysSplitConstraints),
		proposedLineup: parseProposedLineup(session.proposedLineup),
		players,
		matches: matches.map((m) => ({
			...m,
			homePlayerIds: parseStringArray(m.homePlayerIds),
			awayPlayerIds: parseStringArray(m.awayPlayerIds),
			selectedHomePlayerIds: m.selectedHomePlayerIds
				? parseStringArray(m.selectedHomePlayerIds)
				: null,
			selectedAwayPlayerIds: m.selectedAwayPlayerIds
				? parseStringArray(m.selectedAwayPlayerIds)
				: null,
		})),
		pendingCoinTosses: coinTosses.map((ct) => ({
			...ct,
			candidates: parseStringArray(ct.candidates),
		})),
	};
};

export const updateProposedLineup = async ({
	db,
	sessionId,
	proposedLineup,
}: {
	db: DrizzleDB;
	sessionId: string;
	proposedLineup: {
		homePlayerIds: string[];
		awayPlayerIds: string[];
		rotatedOut: string[];
		coinTossNeeded: { conflictType: string; candidates: string[] } | null;
		selectedHomePlayerIds?: string[];
		selectedAwayPlayerIds?: string[];
	} | null;
}) => {
	const [updated] = await db
		.update(gameSession)
		.set({
			proposedLineup: proposedLineup ? JSON.stringify(proposedLineup) : null,
		})
		.where(eq(gameSession.id, sessionId))
		.returning({
			id: gameSession.id,
			proposedLineup: gameSession.proposedLineup,
		});

	return updated;
};

export const endSession = async ({ db, sessionId }: { db: DrizzleDB; sessionId: string }) => {
	const now = new Date();

	const [updated] = await db
		.update(gameSession)
		.set({ status: "ended", endedAt: now, updatedAt: now })
		.where(eq(gameSession.id, sessionId))
		.returning();

	return updated;
};

export const getSessionWithSeason = async ({
	db,
	sessionId,
}: {
	db: DrizzleDB;
	sessionId: string;
}) => {
	const [result] = await db
		.select({
			sessionId: gameSession.id,
			sessionSeasonId: gameSession.seasonId,
			seasonSlug: season.slug,
			leagueId: season.leagueId,
			sessionStatus: gameSession.status,
		})
		.from(gameSession)
		.innerJoin(season, eq(gameSession.seasonId, season.id))
		.where(eq(gameSession.id, sessionId))
		.limit(1);

	return result ?? null;
};

export const listEndedSessions = async ({
	db,
	seasonId,
	limit = 10,
}: {
	db: DrizzleDB;
	seasonId: string;
	limit?: number;
}) => {
	const sessions = await db
		.select({
			id: gameSession.id,
			rotationMode: gameSession.rotationMode,
			teamSize: gameSession.teamSize,
			createdAt: gameSession.createdAt,
			endedAt: gameSession.endedAt,
		})
		.from(gameSession)
		.where(and(eq(gameSession.seasonId, seasonId), eq(gameSession.status, "ended")))
		.orderBy(desc(gameSession.endedAt))
		.limit(limit);

	if (sessions.length === 0) return [];

	const sessionIds = sessions.map((s) => s.id);

	const matchCounts = await db
		.select({
			sessionId: sessionMatch.sessionId,
			count: sql<number>`COUNT(*)`.as("match_count"),
		})
		.from(sessionMatch)
		.where(and(inArray(sessionMatch.sessionId, sessionIds), isNotNull(sessionMatch.result)))
		.groupBy(sessionMatch.sessionId);

	const playerCounts = await db
		.select({
			sessionId: sessionPlayer.sessionId,
			count: sql<number>`COUNT(*)`.as("player_count"),
		})
		.from(sessionPlayer)
		.where(inArray(sessionPlayer.sessionId, sessionIds))
		.groupBy(sessionPlayer.sessionId);

	const matchMap = new Map(matchCounts.map((m) => [m.sessionId, m.count]));
	const playerMap = new Map(playerCounts.map((p) => [p.sessionId, p.count]));

	return sessions.map((s) => ({
		...s,
		totalMatches: matchMap.get(s.id) ?? 0,
		playerCount: playerMap.get(s.id) ?? 0,
	}));
};
