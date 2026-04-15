import { eq, and, asc, desc, sql, inArray, not, gt, isNull, isNotNull } from "drizzle-orm";
import { newId } from "@coding-cowboys/scorebrawl-util/id-util";
import { TRPCError } from "@trpc/server";
import type { DrizzleDB } from "../../db";
import { withTransaction } from "../../db";
import {
	gameSession,
	sessionPlayer,
	sessionMatch,
	sessionCoinToss,
} from "../../db/schema/league-schema";
import { parseStringArray } from "./session-repository";
import { recalcConsecutiveGames, recalcQueuePositions } from "./session-queue-repository";

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
					? a.consecutiveGames - b.consecutiveGames
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

		const deletedHomeIds = parseStringArray(lastMatch.homePlayerIds);
		const deletedAwayIds = parseStringArray(lastMatch.awayPlayerIds);
		const deletedSelectedHomeIds = parseStringArray(lastMatch.selectedHomePlayerIds);
		const deletedSelectedAwayIds = parseStringArray(lastMatch.selectedAwayPlayerIds);

		const allDeletedIds = [
			...deletedHomeIds,
			...deletedAwayIds,
			...deletedSelectedHomeIds,
			...deletedSelectedAwayIds,
		];
		const uniqueDeletedIds = [...new Set(allDeletedIds)];

		const deletedSessionPlayers = await tx
			.select({ id: sessionPlayer.id, seasonPlayerId: sessionPlayer.seasonPlayerId })
			.from(sessionPlayer)
			.where(
				and(
					eq(sessionPlayer.sessionId, sessionId),
					inArray(sessionPlayer.seasonPlayerId, uniqueDeletedIds)
				)
			);

		const spIdToSessionPlayerId = new Map(
			deletedSessionPlayers.map((p) => [p.seasonPlayerId, p.id])
		);

		const toSessionPlayerIds = (seasonPlayerIds: string[]) =>
			seasonPlayerIds.map((id) => spIdToSessionPlayerId.get(id)).filter((id): id is string => id !== undefined);

		const restoredProposedLineup = {
			homePlayerIds: toSessionPlayerIds(deletedHomeIds),
			awayPlayerIds: toSessionPlayerIds(deletedAwayIds),
			selectedHomePlayerIds: toSessionPlayerIds(
				deletedSelectedHomeIds.length > 0 ? deletedSelectedHomeIds : deletedHomeIds
			),
			selectedAwayPlayerIds: toSessionPlayerIds(
				deletedSelectedAwayIds.length > 0 ? deletedSelectedAwayIds : deletedAwayIds
			),
			rotatedOut: [],
			coinTossNeeded: null,
		};

		await tx
			.update(gameSession)
			.set({ proposedLineup: JSON.stringify(restoredProposedLineup) })
			.where(eq(gameSession.id, sessionId));

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
