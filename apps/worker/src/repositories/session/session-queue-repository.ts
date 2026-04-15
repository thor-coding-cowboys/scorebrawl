import { eq, and, asc, desc, sql, inArray, gt, isNull, isNotNull } from "drizzle-orm";
import { newId } from "@coding-cowboys/scorebrawl-util/id-util";
import { TRPCError } from "@trpc/server";
import type { DrizzleDB, TransactionClient } from "../../db";
import { withTransaction } from "../../db";
import { gameSession, sessionPlayer, sessionMatch } from "../../db/schema/league-schema";
import { parseStringArray } from "./session-repository";

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

	if (existing && existing.status !== "out") {
		throw new TRPCError({ code: "CONFLICT", message: "Player already in session" });
	}

	const [{ maxPos }] = await db
		.select({ maxPos: sql<number>`COALESCE(MAX(${sessionPlayer.queuePosition}), -1)` })
		.from(sessionPlayer)
		.where(and(eq(sessionPlayer.sessionId, sessionId), eq(sessionPlayer.status, "waiting")));

	const bottomPosition = maxPos + 1;

	if (existing && existing.status === "out") {
		const [reactivatedPlayer] = await db
			.update(sessionPlayer)
			.set({
				status: "waiting",
				queuePosition: bottomPosition,
				gamesPlayedThisSession: 0,
				consecutiveGames: 0,
				updatedAt: now,
			})
			.where(eq(sessionPlayer.id, existing.id))
			.returning();
		return reactivatedPlayer;
	}

	const [newPlayer] = await db
		.insert(sessionPlayer)
		.values({
			id: newId("sessionPlayer"),
			sessionId,
			seasonPlayerId,
			status: "waiting",
			queuePosition: bottomPosition,
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

async function recalcConsecutiveGames(db: DrizzleDB | TransactionClient, sessionId: string) {
	const completedMatches = await db
		.select({
			matchNumber: sessionMatch.matchNumber,
			homePlayerIds: sessionMatch.homePlayerIds,
			awayPlayerIds: sessionMatch.awayPlayerIds,
		})
		.from(sessionMatch)
		.where(and(eq(sessionMatch.sessionId, sessionId), isNotNull(sessionMatch.result)))
		.orderBy(desc(sessionMatch.matchNumber));

	if (completedMatches.length === 0) return;

	const allPlayers = await db
		.select({
			id: sessionPlayer.id,
			seasonPlayerId: sessionPlayer.seasonPlayerId,
			consecutiveGames: sessionPlayer.consecutiveGames,
		})
		.from(sessionPlayer)
		.where(eq(sessionPlayer.sessionId, sessionId));

	if (allPlayers.length === 0) return;

	const now = new Date();

	const streak = new Map<string, number>();
	const finalized = new Set<string>();

	for (const m of completedMatches) {
		if (finalized.size === allPlayers.length) break;

		const home = parseStringArray(m.homePlayerIds);
		const away = parseStringArray(m.awayPlayerIds);

		const inMatch = new Set<string>();
		for (const id of home) inMatch.add(id);
		for (const id of away) inMatch.add(id);

		for (const sp of allPlayers) {
			if (finalized.has(sp.seasonPlayerId)) continue;

			if (!inMatch.has(sp.seasonPlayerId)) {
				finalized.add(sp.seasonPlayerId);
				continue;
			}

			streak.set(sp.seasonPlayerId, (streak.get(sp.seasonPlayerId) ?? 0) + 1);
		}
	}

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
			if (cgFor(a) !== cgFor(b)) return cgFor(a) - cgFor(b);
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

	const caseParts = queue
		.map((seasonPlayerId, index) => {
			const playerId = playerMap.get(seasonPlayerId);
			if (!playerId) return null;
			return sql`WHEN ${sessionPlayer.id} = ${playerId} THEN ${index}`;
		})
		.filter((p): p is NonNullable<typeof p> => p !== null);

	if (caseParts.length > 0) {
		const caseExpression = caseParts.reduce((acc, part) => sql`${acc} ${part}`);
		await db
			.update(sessionPlayer)
			.set({ queuePosition: sql`CASE ${caseExpression} END`, updatedAt: now })
			.where(
				and(
					eq(sessionPlayer.sessionId, sessionId),
					inArray(sessionPlayer.id, [...playerMap.values()])
				)
			);
	}
}

export { recalcConsecutiveGames, recalcQueuePositions };
