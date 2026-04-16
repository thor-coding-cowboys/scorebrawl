import { eq, and, asc, sql, inArray, isNotNull } from "drizzle-orm";
import type { DrizzleDB } from "../../db";
import {
	gameSession,
	sessionPlayer,
	sessionMatch,
	match,
	matchPlayer,
	seasonPlayer,
	player,
	guest,
} from "../../db/schema/league-schema";
import { user } from "../../db/schema/auth-schema";
import { parseStringArray } from "./session-repository";

export const getSessionSummary = async ({
	db,
	sessionId,
}: {
	db: DrizzleDB;
	sessionId: string;
}) => {
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

			const sorted = [...ids].sort();

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
