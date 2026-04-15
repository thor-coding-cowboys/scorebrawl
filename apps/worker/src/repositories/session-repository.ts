import { eq, and, asc, desc, sql, inArray, not, gt, isNull, isNotNull } from "drizzle-orm";
import { newId } from "@coding-cowboys/scorebrawl-util/id-util";
import { TRPCError } from "@trpc/server";
import type { ModeSettings } from "../services/session/strategies/types";
import type { DrizzleDB, TransactionClient } from "../db";
import { withTransaction } from "../db";
import { user } from "../db/schema/auth-schema";
import {
	gameSession,
	sessionPlayer,
	sessionMatch,
	sessionCoinToss,
	seasonPlayer,
	season,
	player,
	guest,
	match,
	matchPlayer,
} from "../db/schema/league-schema";
import { enforceAlwaysSplit } from "../services/session/strategies/winner-stays";

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

function parseProposedLineup(json: string | null | undefined): {
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

function parseAlwaysSplit(json: string | null | undefined): [string, string][] {
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

export const createSession = async ({
	db,
	seasonId,
	createdBy,
	rotationMode,
	teamSize,
	modeSettings,
	seasonPlayerIds,
}: {
	db: DrizzleDB;
	seasonId: string;
	createdBy: string;
	rotationMode: "winner-stays" | "manual";
	teamSize: number;
	modeSettings: ModeSettings | undefined;
	seasonPlayerIds: string[];
}) => {
	const isWinnerStays = modeSettings?.mode === "winner-stays";
	const maxConsecutiveGames = isWinnerStays ? modeSettings.maxConsecutiveGames : null;
	const winnersTakePriority = isWinnerStays ? modeSettings.winnersTakePriority : false;
	const autoRandomize = isWinnerStays ? modeSettings.autoRandomize : false;
	const autoCoinToss = isWinnerStays ? modeSettings.autoCoinToss : false;
	const alwaysSplitConstraints = isWinnerStays ? modeSettings.alwaysSplitConstraints : [];
	const randomizerType = isWinnerStays ? modeSettings.randomizerType : "fisher-yates";
	const maxConsecutiveEnabled = maxConsecutiveGames !== null;

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
			randomizerType,
			modeSettings: modeSettings ? JSON.stringify(modeSettings) : null,
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
		db
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
			.orderBy(asc(sessionPlayer.queuePosition)),
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
		db
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
			.orderBy(asc(sessionPlayer.queuePosition)),
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

export const addPlayerToSession = async ({
	db,
	sessionId,
	seasonPlayerId,
}: {
	db: DrizzleDB;
	sessionId: string;
	seasonPlayerId: string;
}) => {
	const [existing] = await db
		.select()
		.from(sessionPlayer)
		.where(
			and(eq(sessionPlayer.sessionId, sessionId), eq(sessionPlayer.seasonPlayerId, seasonPlayerId))
		)
		.limit(1);

	const now = new Date();

	// If player exists and is active (waiting/playing), throw error
	if (existing && existing.status !== "out") {
		throw new TRPCError({ code: "CONFLICT", message: "Player already in session" });
	}

	// Shift all waiting players down by 1 to make room at position 0
	await db
		.update(sessionPlayer)
		.set({
			queuePosition: sql`${sessionPlayer.queuePosition} + 1`,
			updatedAt: now,
		})
		.where(and(eq(sessionPlayer.sessionId, sessionId), eq(sessionPlayer.status, "waiting")));

	// If player was previously removed (status="out"), reactivate them
	if (existing && existing.status === "out") {
		const [reactivatedPlayer] = await db
			.update(sessionPlayer)
			.set({
				status: "waiting",
				queuePosition: 0,
				gamesPlayedThisSession: 0,
				consecutiveGames: 0,
				updatedAt: now,
			})
			.where(eq(sessionPlayer.id, existing.id))
			.returning();
		return reactivatedPlayer;
	}

	// Create new player record
	const [newPlayer] = await db
		.insert(sessionPlayer)
		.values({
			id: newId("sessionPlayer"),
			sessionId,
			seasonPlayerId,
			status: "waiting",
			queuePosition: 0,
			gamesPlayedThisSession: 0,
			consecutiveGames: 0,
			joinedAt: now,
			createdAt: now,
			updatedAt: now,
		})
		.returning();

	return newPlayer;
};

export const removePlayerFromSession = async ({
	db,
	sessionId,
	sessionPlayerId,
}: {
	db: DrizzleDB;
	sessionId: string;
	sessionPlayerId: string;
}) => {
	const [target] = await db
		.select()
		.from(sessionPlayer)
		.where(and(eq(sessionPlayer.id, sessionPlayerId), eq(sessionPlayer.sessionId, sessionId)))
		.limit(1);

	if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Session player not found" });

	if (target.status === "out") {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Player has already been removed from this session",
		});
	}

	await db
		.update(sessionPlayer)
		.set({ status: "out", updatedAt: new Date() })
		.where(eq(sessionPlayer.id, sessionPlayerId));

	if (target.status === "waiting") {
		await db
			.update(sessionPlayer)
			.set({
				queuePosition: sql`${sessionPlayer.queuePosition} - 1`,
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(sessionPlayer.sessionId, sessionId),
					eq(sessionPlayer.status, "waiting"),
					gt(sessionPlayer.queuePosition, target.queuePosition)
				)
			);
	}

	return target;
};

export const handlePlayerRemovalFromMatch = async ({
	db,
	sessionId,
	sessionPlayerId,
}: {
	db: DrizzleDB;
	sessionId: string;
	sessionPlayerId: string;
}) => {
	return withTransaction(db, async (tx) => {
		const [currentMatch] = await tx
			.select()
			.from(sessionMatch)
			.where(and(eq(sessionMatch.sessionId, sessionId), isNull(sessionMatch.result)))
			.limit(1);

		if (!currentMatch) {
			return null;
		}

		const [playerRecord] = await tx
			.select({ seasonPlayerId: sessionPlayer.seasonPlayerId })
			.from(sessionPlayer)
			.where(and(eq(sessionPlayer.id, sessionPlayerId), eq(sessionPlayer.sessionId, sessionId)))
			.limit(1);

		if (!playerRecord) {
			return null;
		}

		const seasonPlayerId = playerRecord.seasonPlayerId;
		const homePlayerIds = parseStringArray(currentMatch.homePlayerIds);
		const awayPlayerIds = parseStringArray(currentMatch.awayPlayerIds);

		const inHomeTeam = homePlayerIds.includes(seasonPlayerId);
		const inAwayTeam = awayPlayerIds.includes(seasonPlayerId);

		if (!inHomeTeam && !inAwayTeam) {
			return null;
		}

		const newHomeIds = inHomeTeam
			? homePlayerIds.filter((id) => id !== seasonPlayerId)
			: homePlayerIds;
		const newAwayIds = inAwayTeam
			? awayPlayerIds.filter((id) => id !== seasonPlayerId)
			: awayPlayerIds;

		if (newHomeIds.length === 0 || newAwayIds.length === 0) {
			await tx.delete(sessionMatch).where(eq(sessionMatch.id, currentMatch.id));

			await tx
				.update(sessionPlayer)
				.set({ status: "waiting", updatedAt: new Date() })
				.where(and(eq(sessionPlayer.sessionId, sessionId), eq(sessionPlayer.status, "playing")));

			return { matchCancelled: true };
		}

		await tx
			.update(sessionMatch)
			.set({
				homePlayerIds: JSON.stringify(newHomeIds),
				awayPlayerIds: JSON.stringify(newAwayIds),
				updatedAt: new Date(),
			})
			.where(eq(sessionMatch.id, currentMatch.id));

		return { matchUpdated: true, newHomeIds, newAwayIds };
	});
};

export const startNextMatch = async ({
	db,
	sessionId,
	homeSeasonPlayerIds,
	awaySeasonPlayerIds,
}: {
	db: DrizzleDB;
	sessionId: string;
	homeSeasonPlayerIds: string[];
	awaySeasonPlayerIds: string[];
}) => {
	return withTransaction(db, async (tx) => {
		const [countResult] = await tx
			.select({ count: sql<number>`COUNT(*)` })
			.from(sessionMatch)
			.where(eq(sessionMatch.sessionId, sessionId));

		const matchNumber = (countResult?.count ?? 0) + 1;
		const now = new Date();

		const allSeasonPlayerIds = [...homeSeasonPlayerIds, ...awaySeasonPlayerIds];

		const sessionPlayers = await tx
			.select()
			.from(sessionPlayer)
			.where(
				and(
					eq(sessionPlayer.sessionId, sessionId),
					inArray(sessionPlayer.seasonPlayerId, allSeasonPlayerIds)
				)
			);

		const [newMatch] = await tx
			.insert(sessionMatch)
			.values({
				id: newId("sessionMatch"),
				sessionId,
				matchId: null,
				matchNumber,
				homePlayerIds: JSON.stringify(homeSeasonPlayerIds),
				awayPlayerIds: JSON.stringify(awaySeasonPlayerIds),
				result: null,
				createdAt: now,
				updatedAt: now,
			})
			.returning();

		const sessionPlayerIds = sessionPlayers.map((p) => p.id);

		if (sessionPlayerIds.length > 0) {
			await tx
				.update(sessionPlayer)
				.set({ status: "playing", updatedAt: now })
				.where(inArray(sessionPlayer.id, sessionPlayerIds));
		}

		await tx
			.update(sessionPlayer)
			.set({ consecutiveGames: 0, updatedAt: now })
			.where(
				and(
					eq(sessionPlayer.sessionId, sessionId),
					not(inArray(sessionPlayer.seasonPlayerId, allSeasonPlayerIds)),
					gt(sessionPlayer.consecutiveGames, 0)
				)
			);

		await tx.update(gameSession).set({ proposedLineup: null }).where(eq(gameSession.id, sessionId));

		return newMatch;
	});
};

export const recordMatchResult = async ({
	db,
	sessionId,
	sessionMatchId,
	result,
	matchId,
	winnersTakePriority = false,
	maxConsecutiveEnabled,
	maxConsecutiveGames,
}: {
	db: DrizzleDB;
	sessionId: string;
	sessionMatchId: string;
	result: "home" | "away" | "draw";
	matchId: string;
	winnersTakePriority?: boolean;
	maxConsecutiveEnabled?: boolean;
	maxConsecutiveGames?: number | null;
}) => {
	return withTransaction(db, async (tx) => {
		const now = new Date();

		await tx
			.update(sessionMatch)
			.set({ result, matchId, updatedAt: now })
			.where(and(eq(sessionMatch.id, sessionMatchId), eq(sessionMatch.sessionId, sessionId)));

		const [updatedMatch] = await tx
			.select()
			.from(sessionMatch)
			.where(eq(sessionMatch.id, sessionMatchId))
			.limit(1);

		if (!updatedMatch)
			throw new TRPCError({ code: "NOT_FOUND", message: "Session match not found" });

		const homePlayerIds = parseStringArray(updatedMatch.homePlayerIds);
		const awayPlayerIds = parseStringArray(updatedMatch.awayPlayerIds);

		const allPlayingIds = [...homePlayerIds, ...awayPlayerIds];

		const playingSessionPlayers = await tx
			.select()
			.from(sessionPlayer)
			.where(
				and(
					eq(sessionPlayer.sessionId, sessionId),
					inArray(sessionPlayer.seasonPlayerId, allPlayingIds)
				)
			);

		const [maxWaitingPos] = await tx
			.select({ max: sql<number>`MAX(${sessionPlayer.queuePosition})` })
			.from(sessionPlayer)
			.where(and(eq(sessionPlayer.sessionId, sessionId), eq(sessionPlayer.status, "waiting")));

		const [waitingCountResult] = await tx
			.select({ count: sql<number>`COUNT(*)` })
			.from(sessionPlayer)
			.where(and(eq(sessionPlayer.sessionId, sessionId), eq(sessionPlayer.status, "waiting")));

		const playingSessionPlayerIds = playingSessionPlayers.map((p) => p.id);

		if (playingSessionPlayerIds.length > 0) {
			const winnerSeasonPlayerIds =
				result === "draw" ? [] : result === "home" ? homePlayerIds : awayPlayerIds;
			const loserSeasonPlayerIds =
				result === "draw" ? allPlayingIds : result === "home" ? awayPlayerIds : homePlayerIds;

			const winnerSessionPlayers = playingSessionPlayers.filter((p) =>
				winnerSeasonPlayerIds.includes(p.seasonPlayerId)
			);
			const loserSessionPlayers = playingSessionPlayers.filter((p) =>
				loserSeasonPlayerIds.includes(p.seasonPlayerId)
			);

			const isOverride = (p: (typeof playingSessionPlayers)[number]) => {
				// Check if player will exceed max AFTER this game (cg + 1 >= max)
				const cgAfterThisGame = p.consecutiveGames + 1;
				return (
					maxConsecutiveEnabled &&
					maxConsecutiveGames != null &&
					cgAfterThisGame >= maxConsecutiveGames
				);
			};

			const overridePlayers = playingSessionPlayers.filter(isOverride);
			const overrideIds = new Set(overridePlayers.map((p) => p.id));

			const sortByConsecutiveThenQueue = (
				a: (typeof playingSessionPlayers)[number],
				b: (typeof playingSessionPlayers)[number]
			) =>
				a.consecutiveGames !== b.consecutiveGames
					? a.consecutiveGames - b.consecutiveGames
					: a.queuePosition - b.queuePosition;

			const orderedWinners = winnerSessionPlayers
				.filter((p) => !overrideIds.has(p.id))
				.sort(sortByConsecutiveThenQueue);
			const orderedLosers = loserSessionPlayers
				.filter((p) => !overrideIds.has(p.id))
				.sort(sortByConsecutiveThenQueue);
			const orderedOverrides = overridePlayers.sort((a, b) =>
				a.consecutiveGames !== b.consecutiveGames
					? a.consecutiveGames - b.consecutiveGames // Fewer games first = higher queue pos
					: a.queuePosition - b.queuePosition
			);

			const maxWaiting = maxWaitingPos?.max ?? -1;
			let queueAssignments: Array<{ id: string; pos: number }>;

			if (winnersTakePriority) {
				const winnerCount = orderedWinners.length;
				const waitingPlayerCount = waitingCountResult?.count ?? 0;

				if (winnerCount > 0 && waitingPlayerCount > 0) {
					await tx
						.update(sessionPlayer)
						.set({
							queuePosition: sql`${sessionPlayer.queuePosition} + ${winnerCount}`,
							updatedAt: now,
						})
						.where(
							and(eq(sessionPlayer.sessionId, sessionId), eq(sessionPlayer.status, "waiting"))
						);
				}

				// After shifting, re-query to find where waiting players now end
				// Losers go after waiting players, overrides go to absolute bottom
				const [newMaxWaitingPos] = await tx
					.select({ max: sql<number>`MAX(${sessionPlayer.queuePosition})` })
					.from(sessionPlayer)
					.where(and(eq(sessionPlayer.sessionId, sessionId), eq(sessionPlayer.status, "waiting")));

				const baseForLosers = (newMaxWaitingPos?.max ?? -1) + 1;
				const baseForOverrides = baseForLosers + orderedLosers.length;
				queueAssignments = [
					...orderedWinners.map((p, i) => ({ id: p.id, pos: i })),
					...orderedLosers.map((p, i) => ({ id: p.id, pos: baseForLosers + i })),
					...orderedOverrides.map((p, i) => ({ id: p.id, pos: baseForOverrides + i })),
				];
			} else {
				const base = maxWaiting + 1;
				queueAssignments = [...orderedWinners, ...orderedLosers, ...orderedOverrides].map(
					(p, i) => ({ id: p.id, pos: base + i })
				);
			}

			const consecutiveCaseParts = playingSessionPlayerIds
				.map(
					(id) => sql`WHEN ${sessionPlayer.id} = ${id} THEN ${sessionPlayer.consecutiveGames} + 1`
				)
				.reduce((acc, part) => sql`${acc} ${part}`);

			const queuePosCaseParts = queueAssignments
				.map(({ id, pos }) => sql`WHEN ${sessionPlayer.id} = ${id} THEN ${pos}`)
				.reduce((acc, part) => sql`${acc} ${part}`);

			await tx
				.update(sessionPlayer)
				.set({
					gamesPlayedThisSession: sql`${sessionPlayer.gamesPlayedThisSession} + 1`,
					consecutiveGames: sql`CASE ${consecutiveCaseParts} END`,
					queuePosition: sql`CASE ${queuePosCaseParts} END`,
					status: "waiting",
					updatedAt: now,
				})
				.where(inArray(sessionPlayer.id, playingSessionPlayerIds));
		}

		const allPlayers = await tx
			.select()
			.from(sessionPlayer)
			.where(eq(sessionPlayer.sessionId, sessionId))
			.orderBy(asc(sessionPlayer.queuePosition));

		return { match: updatedMatch, players: allPlayers };
	});
};

export const cancelCurrentMatch = async ({
	db,
	sessionId,
}: {
	db: DrizzleDB;
	sessionId: string;
}) => {
	return withTransaction(db, async (tx) => {
		const [current] = await tx
			.select()
			.from(sessionMatch)
			.where(and(eq(sessionMatch.sessionId, sessionId), isNull(sessionMatch.result)))
			.limit(1);

		if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "No active match to cancel" });

		const homePlayerIds = parseStringArray(current.homePlayerIds);
		const awayPlayerIds = parseStringArray(current.awayPlayerIds);

		const homeSessionPlayers = await tx
			.select({ id: sessionPlayer.id })
			.from(sessionPlayer)
			.where(
				and(
					eq(sessionPlayer.sessionId, sessionId),
					inArray(sessionPlayer.seasonPlayerId, homePlayerIds)
				)
			);
		const awaySessionPlayers = await tx
			.select({ id: sessionPlayer.id })
			.from(sessionPlayer)
			.where(
				and(
					eq(sessionPlayer.sessionId, sessionId),
					inArray(sessionPlayer.seasonPlayerId, awayPlayerIds)
				)
			);

		const restoredProposedLineup = {
			homePlayerIds: homeSessionPlayers.map((p) => p.id),
			awayPlayerIds: awaySessionPlayers.map((p) => p.id),
			rotatedOut: [] as string[],
			coinTossNeeded: null,
		};

		await tx.delete(sessionMatch).where(eq(sessionMatch.id, current.id));

		const now = new Date();
		await tx
			.update(sessionPlayer)
			.set({ status: "waiting", updatedAt: now })
			.where(and(eq(sessionPlayer.sessionId, sessionId), eq(sessionPlayer.status, "playing")));

		await recalcConsecutiveGames(tx, sessionId);

		const players = await tx
			.select()
			.from(sessionPlayer)
			.where(eq(sessionPlayer.sessionId, sessionId))
			.orderBy(asc(sessionPlayer.queuePosition));

		await tx
			.update(gameSession)
			.set({ proposedLineup: JSON.stringify(restoredProposedLineup) })
			.where(eq(gameSession.id, sessionId));

		return { deletedMatch: current, players, restoredProposedLineup };
	});
};

export const deleteLastMatch = async ({ db, sessionId }: { db: DrizzleDB; sessionId: string }) => {
	return withTransaction(db, async (tx) => {
		const [lastMatch] = await tx
			.select()
			.from(sessionMatch)
			.where(and(eq(sessionMatch.sessionId, sessionId), isNotNull(sessionMatch.result)))
			.orderBy(desc(sessionMatch.matchNumber))
			.limit(1);

		if (!lastMatch)
			throw new TRPCError({ code: "NOT_FOUND", message: "No completed match to delete" });

		const hasActiveMatch = await tx
			.select({ id: sessionMatch.id })
			.from(sessionMatch)
			.where(and(eq(sessionMatch.sessionId, sessionId), isNull(sessionMatch.result)))
			.limit(1);

		if (hasActiveMatch.length > 0)
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "Cannot delete last match while a match is in progress",
			});

		const homePlayerIds = parseStringArray(lastMatch.homePlayerIds);
		const awayPlayerIds = parseStringArray(lastMatch.awayPlayerIds);
		const allPlayingIds = [...homePlayerIds, ...awayPlayerIds];

		const now = new Date();

		const playingSessionPlayers = await tx
			.select({ id: sessionPlayer.id })
			.from(sessionPlayer)
			.where(
				and(
					eq(sessionPlayer.sessionId, sessionId),
					inArray(sessionPlayer.seasonPlayerId, allPlayingIds)
				)
			);

		const playingIds = playingSessionPlayers.map((p) => p.id);
		if (playingIds.length > 0) {
			await tx
				.update(sessionPlayer)
				.set({
					gamesPlayedThisSession: sql`MAX(0, ${sessionPlayer.gamesPlayedThisSession} - 1)`,
					updatedAt: now,
				})
				.where(inArray(sessionPlayer.id, playingIds));
		}

		await tx.delete(sessionCoinToss).where(eq(sessionCoinToss.sessionMatchId, lastMatch.id));

		await tx.delete(sessionMatch).where(eq(sessionMatch.id, lastMatch.id));

		await recalcConsecutiveGames(tx, sessionId);
		await recalcQueuePositions(tx, sessionId);

		const players = await tx
			.select()
			.from(sessionPlayer)
			.where(eq(sessionPlayer.sessionId, sessionId))
			.orderBy(asc(sessionPlayer.queuePosition));

		let restoredProposedLineup: {
			homePlayerIds: string[];
			awayPlayerIds: string[];
			selectedHomePlayerIds: string[];
			selectedAwayPlayerIds: string[];
			rotatedOut: string[];
			coinTossNeeded: null;
		} | null = null;

		const [previousMatch] = await tx
			.select()
			.from(sessionMatch)
			.where(and(eq(sessionMatch.sessionId, sessionId), isNotNull(sessionMatch.result)))
			.orderBy(desc(sessionMatch.matchNumber))
			.limit(1);

		if (previousMatch) {
			const prevHomeIds = parseStringArray(previousMatch.homePlayerIds);
			const prevAwayIds = parseStringArray(previousMatch.awayPlayerIds);
			const prevSelectedHomeIds = parseStringArray(previousMatch.selectedHomePlayerIds);
			const prevSelectedAwayIds = parseStringArray(previousMatch.selectedAwayPlayerIds);

			const prevHomeSessionPlayers = await tx
				.select({ id: sessionPlayer.id })
				.from(sessionPlayer)
				.where(
					and(
						eq(sessionPlayer.sessionId, sessionId),
						inArray(sessionPlayer.seasonPlayerId, prevHomeIds)
					)
				);
			const prevAwaySessionPlayers = await tx
				.select({ id: sessionPlayer.id })
				.from(sessionPlayer)
				.where(
					and(
						eq(sessionPlayer.sessionId, sessionId),
						inArray(sessionPlayer.seasonPlayerId, prevAwayIds)
					)
				);

			const prevSelectedHomeSessionPlayers = prevSelectedHomeIds.length
				? await tx
						.select({ id: sessionPlayer.id })
						.from(sessionPlayer)
						.where(
							and(
								eq(sessionPlayer.sessionId, sessionId),
								inArray(sessionPlayer.seasonPlayerId, prevSelectedHomeIds)
							)
						)
				: [];
			const prevSelectedAwaySessionPlayers = prevSelectedAwayIds.length
				? await tx
						.select({ id: sessionPlayer.id })
						.from(sessionPlayer)
						.where(
							and(
								eq(sessionPlayer.sessionId, sessionId),
								inArray(sessionPlayer.seasonPlayerId, prevSelectedAwayIds)
							)
						)
				: [];

			restoredProposedLineup = {
				homePlayerIds: prevHomeSessionPlayers.map((p) => p.id),
				awayPlayerIds: prevAwaySessionPlayers.map((p) => p.id),
				selectedHomePlayerIds: prevSelectedHomeSessionPlayers.map((p) => p.id),
				selectedAwayPlayerIds: prevSelectedAwaySessionPlayers.map((p) => p.id),
				rotatedOut: [],
				coinTossNeeded: null,
			};

			await tx
				.update(gameSession)
				.set({ proposedLineup: JSON.stringify(restoredProposedLineup) })
				.where(eq(gameSession.id, sessionId));
		}

		return { deletedMatch: lastMatch, players, restoredProposedLineup };
	});
};

export async function updateMatchScore({
	db,
	sessionId,
	sessionMatchId,
	homeScore,
	awayScore,
}: {
	db: DrizzleDB;
	sessionId: string;
	sessionMatchId: string;
	homeScore: number;
	awayScore: number;
}) {
	const [updated] = await db
		.update(sessionMatch)
		.set({ homeSessionScore: homeScore, awaySessionScore: awayScore })
		.where(and(eq(sessionMatch.id, sessionMatchId), eq(sessionMatch.sessionId, sessionId)))
		.returning({
			id: sessionMatch.id,
			homeSessionScore: sessionMatch.homeSessionScore,
			awaySessionScore: sessionMatch.awaySessionScore,
		});

	return updated;
}

export async function updateTeamSelection({
	db,
	sessionId,
	sessionMatchId,
	selectedHomePlayerIds,
	selectedAwayPlayerIds,
}: {
	db: DrizzleDB;
	sessionId: string;
	sessionMatchId: string;
	selectedHomePlayerIds: string[];
	selectedAwayPlayerIds: string[];
}) {
	const [updated] = await db
		.update(sessionMatch)
		.set({
			selectedHomePlayerIds: JSON.stringify(selectedHomePlayerIds),
			selectedAwayPlayerIds: JSON.stringify(selectedAwayPlayerIds),
		})
		.where(and(eq(sessionMatch.id, sessionMatchId), eq(sessionMatch.sessionId, sessionId)))
		.returning({
			id: sessionMatch.id,
			selectedHomePlayerIds: sessionMatch.selectedHomePlayerIds,
			selectedAwayPlayerIds: sessionMatch.selectedAwayPlayerIds,
		});

	return updated;
}

export async function updateProposedLineup({
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
}) {
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
}

async function recalcConsecutiveGames(db: DrizzleDB | TransactionClient, sessionId: string) {
	// Fetch only necessary columns to reduce memory and CPU usage
	const completedMatches = await db
		.select({
			matchNumber: sessionMatch.matchNumber,
			homePlayerIds: sessionMatch.homePlayerIds,
			awayPlayerIds: sessionMatch.awayPlayerIds,
		})
		.from(sessionMatch)
		.where(and(eq(sessionMatch.sessionId, sessionId), isNotNull(sessionMatch.result)))
		.orderBy(desc(sessionMatch.matchNumber));

	// Early exit if no matches
	if (completedMatches.length === 0) return;

	const allPlayers = await db
		.select({
			id: sessionPlayer.id,
			seasonPlayerId: sessionPlayer.seasonPlayerId,
			consecutiveGames: sessionPlayer.consecutiveGames,
		})
		.from(sessionPlayer)
		.where(eq(sessionPlayer.sessionId, sessionId));

	// Early exit if no players
	if (allPlayers.length === 0) return;

	const now = new Date();

	// Track consecutive games played (not wins) - players in match increment counter
	// Players who sit out a match get reset to 0 (finalized)
	const streak = new Map<string, number>();
	const finalized = new Set<string>();

	// Process matches in reverse order (most recent first)
	for (const m of completedMatches) {
		// Early termination when all players finalized
		if (finalized.size === allPlayers.length) break;

		const home = parseStringArray(m.homePlayerIds);
		const away = parseStringArray(m.awayPlayerIds);

		// Build Set once per match for O(1) lookups
		const inMatch = new Set<string>();
		for (const id of home) inMatch.add(id);
		for (const id of away) inMatch.add(id);

		// Check each player - only those in the match continue their streak
		for (const sp of allPlayers) {
			if (finalized.has(sp.seasonPlayerId)) continue;

			if (!inMatch.has(sp.seasonPlayerId)) {
				// Player sat out - their streak is finalized
				finalized.add(sp.seasonPlayerId);
				continue;
			}

			// Player played - increment streak
			streak.set(sp.seasonPlayerId, (streak.get(sp.seasonPlayerId) ?? 0) + 1);
		}
	}

	// Batch updates by grouping players with same consecutive count
	const updates = new Map<number, string[]>();
	for (const sp of allPlayers) {
		const consecutive = streak.get(sp.seasonPlayerId) ?? 0;
		if (sp.consecutiveGames !== consecutive) {
			const ids = updates.get(consecutive);
			if (ids) {
				ids.push(sp.id);
			} else {
				updates.set(consecutive, [sp.id]);
			}
		}
	}

	// Execute batched updates - one query per unique consecutive value
	const updatePromises: Promise<unknown>[] = [];
	for (const [consecutive, ids] of updates) {
		updatePromises.push(
			db
				.update(sessionPlayer)
				.set({ consecutiveGames: consecutive, updatedAt: now })
				.where(inArray(sessionPlayer.id, ids))
		);
	}

	if (updatePromises.length > 0) {
		await Promise.all(updatePromises);
	}
}

async function recalcQueuePositions(db: DrizzleDB | TransactionClient, sessionId: string) {
	const [session] = await db
		.select({
			rotationMode: gameSession.rotationMode,
			winnersTakePriority: gameSession.winnersTakePriority,
			maxConsecutiveEnabled: gameSession.maxConsecutiveEnabled,
			maxConsecutiveGames: gameSession.maxConsecutiveGames,
		})
		.from(gameSession)
		.where(eq(gameSession.id, sessionId))
		.limit(1);

	if (!session) return;

	const completedMatches = await db
		.select({
			matchNumber: sessionMatch.matchNumber,
			homePlayerIds: sessionMatch.homePlayerIds,
			awayPlayerIds: sessionMatch.awayPlayerIds,
			result: sessionMatch.result,
		})
		.from(sessionMatch)
		.where(and(eq(sessionMatch.sessionId, sessionId), isNotNull(sessionMatch.result)))
		.orderBy(asc(sessionMatch.matchNumber));

	if (completedMatches.length === 0) return;

	const allPlayers = await db
		.select({
			id: sessionPlayer.id,
			seasonPlayerId: sessionPlayer.seasonPlayerId,
			queuePosition: sessionPlayer.queuePosition,
			joinedAt: sessionPlayer.joinedAt,
		})
		.from(sessionPlayer)
		.where(eq(sessionPlayer.sessionId, sessionId))
		.orderBy(asc(sessionPlayer.joinedAt));

	if (allPlayers.length === 0) return;

	let queue: string[] = allPlayers.map((p) => p.seasonPlayerId);
	const playerMap = new Map(allPlayers.map((p) => [p.seasonPlayerId, p.id]));

	const consecutiveGames = new Map<string, number>(allPlayers.map((p) => [p.seasonPlayerId, 0]));

	for (const match of completedMatches) {
		const home = parseStringArray(match.homePlayerIds);
		const away = parseStringArray(match.awayPlayerIds);
		const allPlaying = new Set([...home, ...away]);
		const matchResult = match.result;

		const winnerSPIds = matchResult === "draw" ? [] : matchResult === "home" ? home : away;
		const loserSPIds =
			matchResult === "draw" ? [...allPlaying] : matchResult === "home" ? away : home;

		const cgFor = (spId: string) => consecutiveGames.get(spId) ?? 0;

		const isOverride = (spId: string) =>
			!!session.maxConsecutiveEnabled &&
			session.maxConsecutiveGames !== null &&
			cgFor(spId) >= session.maxConsecutiveGames;

		const sortByConsecutiveThenQueuePos = (a: string, b: string) => {
			if (cgFor(a) !== cgFor(b)) return cgFor(a) - cgFor(b);
			return queue.indexOf(a) - queue.indexOf(b);
		};

		const overrides = [...allPlaying].filter(isOverride);
		const overrideSet = new Set(overrides);

		const orderedWinners = winnerSPIds
			.filter((id) => !overrideSet.has(id))
			.sort(sortByConsecutiveThenQueuePos);
		const orderedLosers = loserSPIds
			.filter((id) => !overrideSet.has(id))
			.sort(sortByConsecutiveThenQueuePos);
		const orderedOverrides = overrides.sort((a, b) => {
			if (cgFor(a) !== cgFor(b)) return cgFor(a) - cgFor(b); // Fewer games first = lower in queue
			return queue.indexOf(a) - queue.indexOf(b);
		});

		queue = queue.filter((id) => !allPlaying.has(id));

		if (session.winnersTakePriority && orderedWinners.length > 0) {
			queue = [...orderedWinners, ...queue, ...orderedLosers, ...orderedOverrides];
		} else {
			queue = [...queue, ...orderedWinners, ...orderedLosers, ...orderedOverrides];
		}

		for (const p of allPlayers) {
			if (allPlaying.has(p.seasonPlayerId)) {
				consecutiveGames.set(p.seasonPlayerId, cgFor(p.seasonPlayerId) + 1);
			} else {
				consecutiveGames.set(p.seasonPlayerId, 0);
			}
		}
	}

	const now = new Date();
	for (let index = 0; index < queue.length; index++) {
		const seasonPlayerId = queue[index]!;
		const playerId = playerMap.get(seasonPlayerId);
		if (playerId) {
			await db
				.update(sessionPlayer)
				.set({ queuePosition: index, updatedAt: now })
				.where(eq(sessionPlayer.id, playerId));
		}
	}
}

export const createCoinToss = async ({
	db,
	sessionId,
	sessionMatchId,
	conflictType,
	candidates,
}: {
	db: DrizzleDB;
	sessionId: string;
	sessionMatchId: string | null;
	conflictType: "loser-rotation" | "max-consecutive-exceeded" | "draw-tiebreak";
	candidates: string[];
}) => {
	const now = new Date();

	const [coinToss] = await db
		.insert(sessionCoinToss)
		.values({
			id: newId("coinToss"),
			sessionId,
			sessionMatchId,
			conflictType,
			candidates: JSON.stringify(candidates),
			resolved: false,
			resolvedWinnerIds: null,
			createdAt: now,
			updatedAt: now,
		})
		.returning();

	return coinToss;
};

export const resolveCoinToss = async ({
	db,
	coinTossId,
	resolvedWinnerIds,
}: {
	db: DrizzleDB;
	coinTossId: string;
	resolvedWinnerIds: string[];
}) => {
	const now = new Date();

	const [updated] = await db
		.update(sessionCoinToss)
		.set({
			resolved: true,
			resolvedWinnerIds: JSON.stringify(resolvedWinnerIds),
			updatedAt: now,
		})
		.where(eq(sessionCoinToss.id, coinTossId))
		.returning();

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

export const getSessionSummary = async ({
	db,
	sessionId,
}: {
	db: DrizzleDB;
	sessionId: string;
}) => {
	// Run independent queries in parallel
	const [sessionResult, totalMatchesResult, sessionPlayers, completedMatches] = await Promise.all([
		db
			.select({
				id: gameSession.id,
				seasonId: gameSession.seasonId,
				rotationMode: gameSession.rotationMode,
				teamSize: gameSession.teamSize,
				maxConsecutiveGames: gameSession.maxConsecutiveGames,
				createdAt: gameSession.createdAt,
				endedAt: gameSession.endedAt,
				status: gameSession.status,
			})
			.from(gameSession)
			.where(eq(gameSession.id, sessionId))
			.limit(1),
		db
			.select({ count: sql<number>`COUNT(*)` })
			.from(sessionMatch)
			.where(and(eq(sessionMatch.sessionId, sessionId), isNotNull(sessionMatch.result))),
		db
			.select({
				sessionPlayerId: sessionPlayer.id,
				seasonPlayerId: sessionPlayer.seasonPlayerId,
				gamesPlayedThisSession: sessionPlayer.gamesPlayedThisSession,
				displayName: sql<string>`COALESCE(${user.name}, ${guest.displayName})`.as("display_name"),
				playerImage: user.image,
			})
			.from(sessionPlayer)
			.innerJoin(seasonPlayer, eq(sessionPlayer.seasonPlayerId, seasonPlayer.id))
			.innerJoin(player, eq(seasonPlayer.playerId, player.id))
			.leftJoin(user, eq(player.userId, user.id))
			.leftJoin(guest, eq(player.guestId, guest.id))
			.where(eq(sessionPlayer.sessionId, sessionId)),
		db
			.select({
				sessionMatchId: sessionMatch.id,
				matchId: sessionMatch.matchId,
				matchNumber: sessionMatch.matchNumber,
				homePlayerIds: sessionMatch.homePlayerIds,
				awayPlayerIds: sessionMatch.awayPlayerIds,
				result: sessionMatch.result,
				homeScore: match.homeScore,
				awayScore: match.awayScore,
				matchCreatedAt: match.createdAt,
			})
			.from(sessionMatch)
			.innerJoin(match, eq(sessionMatch.matchId, match.id))
			.where(and(eq(sessionMatch.sessionId, sessionId), isNotNull(sessionMatch.result)))
			.orderBy(asc(sessionMatch.matchNumber)),
	]);

	const session = sessionResult[0];
	if (!session) return null;

	const totalMatches = totalMatchesResult[0]?.count ?? 0;

	const sessionPlayerIds = sessionPlayers.map((p) => p.seasonPlayerId);

	if (sessionPlayerIds.length === 0) {
		return {
			...session,
			totalMatches,
			playerStats: [],
			matchFeed: [],
			eloProgression: [],
			teamCombos: [],
		};
	}

	const matchIds = completedMatches.map((m) => m.matchId).filter(Boolean) as string[];

	// matchPlayerStats depends on completedMatches, so run after
	const matchPlayerStats =
		matchIds.length > 0
			? await db
					.select({
						matchId: matchPlayer.matchId,
						seasonPlayerId: matchPlayer.seasonPlayerId,
						result: matchPlayer.result,
						scoreBefore: matchPlayer.scoreBefore,
						scoreAfter: matchPlayer.scoreAfter,
						createdAt: matchPlayer.createdAt,
					})
					.from(matchPlayer)
					.where(
						and(
							inArray(matchPlayer.matchId, matchIds),
							inArray(matchPlayer.seasonPlayerId, sessionPlayerIds)
						)
					)
					.orderBy(asc(matchPlayer.createdAt))
			: [];

	const statsByPlayer = new Map<
		string,
		{
			wins: number;
			losses: number;
			draws: number;
			scoreBefore: number | null;
			scoreAfter: number | null;
		}
	>();

	for (const sp of sessionPlayers) {
		statsByPlayer.set(sp.seasonPlayerId, {
			wins: 0,
			losses: 0,
			draws: 0,
			scoreBefore: null,
			scoreAfter: null,
		});
	}

	for (const mp of matchPlayerStats) {
		const stats = statsByPlayer.get(mp.seasonPlayerId);
		if (!stats) continue;

		if (mp.result === "W") stats.wins++;
		else if (mp.result === "L") stats.losses++;
		else if (mp.result === "D") stats.draws++;

		if (stats.scoreBefore === null) stats.scoreBefore = mp.scoreBefore;
		stats.scoreAfter = mp.scoreAfter;
	}

	const playerNameMap = new Map(sessionPlayers.map((p) => [p.seasonPlayerId, p.displayName]));
	const playerImageMap = new Map(sessionPlayers.map((p) => [p.seasonPlayerId, p.playerImage]));

	const mpByMatch = new Map<string, typeof matchPlayerStats>();
	for (const mp of matchPlayerStats) {
		const list = mpByMatch.get(mp.matchId) ?? [];
		list.push(mp);
		mpByMatch.set(mp.matchId, list);
	}

	const eloProgression: Array<{
		matchNumber: number;
		scores: Record<string, number>;
	}> = [];

	for (const cm of completedMatches) {
		if (!cm.matchId) continue;
		const mps = mpByMatch.get(cm.matchId) ?? [];
		const scores: Record<string, number> = {};
		for (const mp of mps) {
			scores[mp.seasonPlayerId] = mp.scoreAfter;
		}
		eloProgression.push({ matchNumber: cm.matchNumber, scores });
	}

	const matchFeed = completedMatches.map((cm) => {
		const homePlayers = parseStringArray(cm.homePlayerIds).map((id) => ({
			seasonPlayerId: id,
			displayName: playerNameMap.get(id) ?? "Unknown",
			playerImage: playerImageMap.get(id) ?? null,
		}));
		const awayPlayers = parseStringArray(cm.awayPlayerIds).map((id) => ({
			seasonPlayerId: id,
			displayName: playerNameMap.get(id) ?? "Unknown",
			playerImage: playerImageMap.get(id) ?? null,
		}));
		return {
			matchNumber: cm.matchNumber,
			homeScore: cm.homeScore,
			awayScore: cm.awayScore,
			result: cm.result as "home" | "away" | "draw",
			createdAt: cm.matchCreatedAt,
			homePlayers,
			awayPlayers,
		};
	});

	const comboCounts = new Map<
		string,
		{ wins: number; losses: number; draws: number; games: number }
	>();

	// Limit matches processed for team combos to prevent CPU timeouts
	// For sessions with >100 matches, only process the most recent 100
	// This maintains reasonable accuracy while preventing CPU limit issues
	const MAX_MATCHES_FOR_COMBOS = 100;
	const matchesForCombos =
		completedMatches.length > MAX_MATCHES_FOR_COMBOS
			? completedMatches.slice(0, MAX_MATCHES_FOR_COMBOS)
			: completedMatches;

	for (const cm of matchesForCombos) {
		const homeIds = parseStringArray(cm.homePlayerIds);
		const awayIds = parseStringArray(cm.awayPlayerIds);

		const addCombo = (ids: string[], result: "win" | "loss" | "draw") => {
			const len = ids.length;
			if (len < 2) return;

			// Sort once and use indices directly to avoid array allocations
			const sorted = [...ids].sort();

			// Generate all pairs: O(n²) where n is team size
			// For 6v6, this is 15 combinations per team per match
			for (let i = 0; i < len - 1; i++) {
				const id1 = sorted[i];
				for (let j = i + 1; j < len; j++) {
					const key = `${id1}|${sorted[j]}`;
					let entry = comboCounts.get(key);
					if (!entry) {
						entry = { wins: 0, losses: 0, draws: 0, games: 0 };
						comboCounts.set(key, entry);
					}
					entry.games++;
					if (result === "win") entry.wins++;
					else if (result === "loss") entry.losses++;
					else entry.draws++;
				}
			}
		};

		const homeResult = cm.result === "home" ? "win" : cm.result === "away" ? "loss" : "draw";
		const awayResult = cm.result === "away" ? "win" : cm.result === "home" ? "loss" : "draw";
		addCombo(homeIds, homeResult);
		addCombo(awayIds, awayResult);
	}

	const teamCombos = [...comboCounts.entries()]
		.filter(([, stats]) => stats.games >= 2)
		.map(([key, stats]) => {
			const [id1, id2] = key.split("|") as [string, string];
			return {
				players: [
					{
						seasonPlayerId: id1,
						displayName: playerNameMap.get(id1) ?? "Unknown",
						playerImage: playerImageMap.get(id1) ?? null,
					},
					{
						seasonPlayerId: id2,
						displayName: playerNameMap.get(id2) ?? "Unknown",
						playerImage: playerImageMap.get(id2) ?? null,
					},
				],
				...stats,
				winRate: stats.games > 0 ? Math.round((stats.wins / stats.games) * 100) : 0,
			};
		})
		.sort((a, b) => b.winRate - a.winRate || b.games - a.games);

	return {
		...session,
		totalMatches,
		playerStats: sessionPlayers.map((p) => {
			const stats = statsByPlayer.get(p.seasonPlayerId) ?? {
				wins: 0,
				losses: 0,
				draws: 0,
				scoreBefore: null,
				scoreAfter: null,
			};
			return {
				sessionPlayerId: p.sessionPlayerId,
				seasonPlayerId: p.seasonPlayerId,
				displayName: p.displayName,
				playerImage: p.playerImage,
				gamesPlayedThisSession: p.gamesPlayedThisSession,
				wins: stats.wins,
				losses: stats.losses,
				draws: stats.draws,
				scoreBeforeSession: stats.scoreBefore,
				scoreAfterSession: stats.scoreAfter,
			};
		}),
		matchFeed,
		eloProgression,
		teamCombos,
	};
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
