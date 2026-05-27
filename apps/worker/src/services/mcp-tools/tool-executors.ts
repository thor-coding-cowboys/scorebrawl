import { eq, desc, and, sql, inArray } from "drizzle-orm";
import type { getDb } from "../../db";
import { user } from "../../db/schema/auth-schema";
import {
	guest,
	player,
	season,
	seasonPlayer,
	match,
	matchPlayer,
	fixture,
	playerAchievement,
	gameSession,
	sessionPlayer,
	sessionMatch,
	leagueTeam,
	seasonTeam,
	matchTeam,
} from "../../db/schema/league-schema";

export interface ToolExecutorContext {
	db: ReturnType<typeof getDb>;
}

export async function getPlayers(ctx: ToolExecutorContext, args: { leagueId: string }) {
	const { db } = ctx;

	const results = await db
		.select({
			id: player.id,
			userName: user.name,
			guestName: guest.displayName,
			score: seasonPlayer.score,
			seasonName: season.name,
			matchesPlayed: sql<number>`count(${matchPlayer.id})`.as("matches_played"),
			wins: sql<number>`sum(case when ${matchPlayer.result} = 'W' then 1 else 0 end)`.as("wins"),
			losses: sql<number>`sum(case when ${matchPlayer.result} = 'L' then 1 else 0 end)`.as(
				"losses"
			),
			draws: sql<number>`sum(case when ${matchPlayer.result} = 'D' then 1 else 0 end)`.as("draws"),
		})
		.from(player)
		.innerJoin(seasonPlayer, eq(seasonPlayer.playerId, player.id))
		.innerJoin(season, eq(season.id, seasonPlayer.seasonId))
		.leftJoin(matchPlayer, eq(matchPlayer.seasonPlayerId, seasonPlayer.id))
		.leftJoin(user, eq(user.id, player.userId))
		.leftJoin(guest, eq(guest.id, player.guestId))
		.where(eq(season.leagueId, args.leagueId))
		.groupBy(player.id, user.name, guest.displayName, seasonPlayer.score, season.name);

	return results.map((r) => ({
		id: r.id,
		name: r.userName ?? r.guestName ?? "Unknown",
		season: r.seasonName,
		score: r.score,
		matchesPlayed: r.matchesPlayed ?? 0,
		wins: r.wins ?? 0,
		losses: r.losses ?? 0,
		draws: r.draws ?? 0,
	}));
}

export async function getSeasons(ctx: ToolExecutorContext, args: { leagueId: string }) {
	const { db } = ctx;

	return db
		.select({
			id: season.id,
			name: season.name,
			slug: season.slug,
			scoreType: season.scoreType,
			archived: season.archived,
			closed: season.closed,
			startDate: season.startDate,
			endDate: season.endDate,
		})
		.from(season)
		.where(eq(season.leagueId, args.leagueId))
		.orderBy(desc(season.createdAt));
}

export async function getMatches(
	ctx: ToolExecutorContext,
	args: { leagueId: string; seasonSlug?: string; playerName?: string; limit?: number }
) {
	const { db } = ctx;

	const conditions = [eq(season.leagueId, args.leagueId)];
	if (args.seasonSlug) {
		conditions.push(eq(season.slug, args.seasonSlug));
	}

	const limit = Math.min(args.limit ?? 50, 100);

	const allMatches = await db
		.select({
			id: match.id,
			createdAt: match.createdAt,
			homeScore: match.homeScore,
			awayScore: match.awayScore,
			seasonName: season.name,
		})
		.from(match)
		.innerJoin(season, eq(season.id, match.seasonId))
		.where(and(...conditions))
		.orderBy(desc(match.createdAt))
		.limit(limit);

	if (allMatches.length === 0) return [];

	const matchIds = allMatches.map((m) => m.id);

	const players = await db
		.select({
			matchId: matchPlayer.matchId,
			userName: user.name,
			guestName: guest.displayName,
			isHomeTeam: matchPlayer.homeTeam,
			result: matchPlayer.result,
			scoreBefore: matchPlayer.scoreBefore,
			scoreAfter: matchPlayer.scoreAfter,
		})
		.from(matchPlayer)
		.innerJoin(seasonPlayer, eq(seasonPlayer.id, matchPlayer.seasonPlayerId))
		.innerJoin(player, eq(player.id, seasonPlayer.playerId))
		.leftJoin(user, eq(user.id, player.userId))
		.leftJoin(guest, eq(guest.id, player.guestId))
		.where(inArray(matchPlayer.matchId, matchIds));

	let filtered = allMatches;
	if (args.playerName) {
		const nameLower = args.playerName.toLowerCase();
		const playerMatchIds = new Set(
			players
				.filter((p) => {
					const name = (p.userName ?? p.guestName ?? "").toLowerCase();
					return name.includes(nameLower);
				})
				.map((p) => p.matchId)
		);
		filtered = allMatches.filter((m) => playerMatchIds.has(m.id));
	}

	return filtered.map((m) => ({
		id: m.id,
		createdAt: m.createdAt,
		homeScore: m.homeScore,
		awayScore: m.awayScore,
		seasonName: m.seasonName,
		homePlayers: players
			.filter((p) => p.matchId === m.id && p.isHomeTeam)
			.map((p) => ({
				name: p.userName ?? p.guestName ?? "Unknown",
				result: p.result,
				scoreBefore: p.scoreBefore,
				scoreAfter: p.scoreAfter,
			})),
		awayPlayers: players
			.filter((p) => p.matchId === m.id && !p.isHomeTeam)
			.map((p) => ({
				name: p.userName ?? p.guestName ?? "Unknown",
				result: p.result,
				scoreBefore: p.scoreBefore,
				scoreAfter: p.scoreAfter,
			})),
	}));
}

export async function getSeasonStandings(
	ctx: ToolExecutorContext,
	args: { leagueId: string; seasonSlug: string }
) {
	const { db } = ctx;

	const seasonData = await db
		.select({ id: season.id, name: season.name, scoreType: season.scoreType })
		.from(season)
		.where(and(eq(season.slug, args.seasonSlug), eq(season.leagueId, args.leagueId)))
		.limit(1);

	if (seasonData.length === 0) return { season: null, standings: [] };

	const seasonId = seasonData[0].id;

	const standings = await db
		.select({
			id: seasonPlayer.id,
			userName: user.name,
			guestName: guest.displayName,
			score: seasonPlayer.score,
			matchesPlayed: sql<number>`count(${matchPlayer.id})`.as("matches_played"),
			wins: sql<number>`sum(case when ${matchPlayer.result} = 'W' then 1 else 0 end)`.as("wins"),
			losses: sql<number>`sum(case when ${matchPlayer.result} = 'L' then 1 else 0 end)`.as(
				"losses"
			),
			draws: sql<number>`sum(case when ${matchPlayer.result} = 'D' then 1 else 0 end)`.as("draws"),
		})
		.from(seasonPlayer)
		.innerJoin(player, eq(player.id, seasonPlayer.playerId))
		.leftJoin(matchPlayer, eq(matchPlayer.seasonPlayerId, seasonPlayer.id))
		.leftJoin(user, eq(user.id, player.userId))
		.leftJoin(guest, eq(guest.id, player.guestId))
		.where(eq(seasonPlayer.seasonId, seasonId))
		.groupBy(seasonPlayer.id, user.name, guest.displayName, seasonPlayer.score)
		.orderBy(desc(seasonPlayer.score));

	return {
		season: seasonData[0],
		standings: standings.map((s) => ({
			name: s.userName ?? s.guestName ?? "Unknown",
			score: s.score,
			matchesPlayed: s.matchesPlayed ?? 0,
			wins: s.wins ?? 0,
			losses: s.losses ?? 0,
			draws: s.draws ?? 0,
		})),
	};
}

export async function getPlayerStats(
	ctx: ToolExecutorContext,
	args: { leagueId: string; playerName: string; seasonSlug?: string }
) {
	const { db } = ctx;
	const nameLower = args.playerName.toLowerCase();

	const conditions = [eq(season.leagueId, args.leagueId)];
	if (args.seasonSlug) {
		conditions.push(eq(season.slug, args.seasonSlug));
	}

	const allMatchPlayers = await db
		.select({
			matchId: matchPlayer.matchId,
			seasonPlayerId: matchPlayer.seasonPlayerId,
			userName: user.name,
			guestName: guest.displayName,
			isHomeTeam: matchPlayer.homeTeam,
			result: matchPlayer.result,
			scoreBefore: matchPlayer.scoreBefore,
			scoreAfter: matchPlayer.scoreAfter,
			homeScore: match.homeScore,
			awayScore: match.awayScore,
			createdAt: match.createdAt,
		})
		.from(matchPlayer)
		.innerJoin(seasonPlayer, eq(seasonPlayer.id, matchPlayer.seasonPlayerId))
		.innerJoin(player, eq(player.id, seasonPlayer.playerId))
		.innerJoin(match, eq(match.id, matchPlayer.matchId))
		.innerJoin(season, eq(season.id, match.seasonId))
		.leftJoin(user, eq(user.id, player.userId))
		.leftJoin(guest, eq(guest.id, player.guestId))
		.where(and(...conditions))
		.orderBy(desc(match.createdAt));

	const targetPlayerMatches = allMatchPlayers.filter((mp) => {
		const name = (mp.userName ?? mp.guestName ?? "").toLowerCase();
		return name.includes(nameLower);
	});

	if (targetPlayerMatches.length === 0) {
		return { error: `No matches found for player "${args.playerName}"` };
	}

	const playerName =
		targetPlayerMatches[0].userName ?? targetPlayerMatches[0].guestName ?? "Unknown";

	const opponentStats = new Map<string, { wins: number; losses: number; draws: number }>();

	for (const pm of targetPlayerMatches) {
		const opponents = allMatchPlayers.filter(
			(mp) => mp.matchId === pm.matchId && mp.isHomeTeam !== pm.isHomeTeam
		);
		for (const opp of opponents) {
			const oppName = opp.userName ?? opp.guestName ?? "Unknown";
			const stats = opponentStats.get(oppName) ?? { wins: 0, losses: 0, draws: 0 };
			if (pm.result === "W") stats.wins++;
			else if (pm.result === "L") stats.losses++;
			else stats.draws++;
			opponentStats.set(oppName, stats);
		}
	}

	const totalWins = targetPlayerMatches.filter((m) => m.result === "W").length;
	const totalLosses = targetPlayerMatches.filter((m) => m.result === "L").length;
	const totalDraws = targetPlayerMatches.filter((m) => m.result === "D").length;
	const total = targetPlayerMatches.length;

	return {
		playerName,
		totalMatches: total,
		wins: totalWins,
		losses: totalLosses,
		draws: totalDraws,
		winRate: total > 0 ? Math.round((totalWins / total) * 100) : 0,
		opponents: Array.from(opponentStats.entries())
			.map(([name, stats]) => ({
				name,
				...stats,
				total: stats.wins + stats.losses + stats.draws,
				winRate:
					stats.wins + stats.losses + stats.draws > 0
						? Math.round((stats.wins / (stats.wins + stats.losses + stats.draws)) * 100)
						: 0,
			}))
			.sort((a, b) => a.winRate - b.winRate),
	};
}

export async function getHeadToHead(
	ctx: ToolExecutorContext,
	args: { leagueId: string; player1Name: string; player2Name: string; seasonSlug?: string }
) {
	const { db } = ctx;
	const name1Lower = args.player1Name.toLowerCase();
	const name2Lower = args.player2Name.toLowerCase();

	const conditions = [eq(season.leagueId, args.leagueId)];
	if (args.seasonSlug) {
		conditions.push(eq(season.slug, args.seasonSlug));
	}

	const allMatchPlayers = await db
		.select({
			matchId: matchPlayer.matchId,
			userName: user.name,
			guestName: guest.displayName,
			isHomeTeam: matchPlayer.homeTeam,
			result: matchPlayer.result,
			homeScore: match.homeScore,
			awayScore: match.awayScore,
			createdAt: match.createdAt,
		})
		.from(matchPlayer)
		.innerJoin(seasonPlayer, eq(seasonPlayer.id, matchPlayer.seasonPlayerId))
		.innerJoin(player, eq(player.id, seasonPlayer.playerId))
		.innerJoin(match, eq(match.id, matchPlayer.matchId))
		.innerJoin(season, eq(season.id, match.seasonId))
		.leftJoin(user, eq(user.id, player.userId))
		.leftJoin(guest, eq(guest.id, player.guestId))
		.where(and(...conditions))
		.orderBy(desc(match.createdAt));

	const p1Matches = new Set(
		allMatchPlayers
			.filter((mp) => (mp.userName ?? mp.guestName ?? "").toLowerCase().includes(name1Lower))
			.map((mp) => mp.matchId)
	);
	const p2Matches = new Set(
		allMatchPlayers
			.filter((mp) => (mp.userName ?? mp.guestName ?? "").toLowerCase().includes(name2Lower))
			.map((mp) => mp.matchId)
	);

	const sharedMatchIds = [...p1Matches].filter((id) => p2Matches.has(id));

	if (sharedMatchIds.length === 0) {
		return { error: `No matches found between "${args.player1Name}" and "${args.player2Name}"` };
	}

	let p1Wins = 0;
	let p2Wins = 0;
	let draws = 0;
	const matches: Array<{
		date: string | null;
		homeScore: number;
		awayScore: number;
		p1Team: string;
		p1Result: string | null;
		p2Team: string;
		p2Result: string | null;
	}> = [];

	for (const matchId of sharedMatchIds) {
		const matchEntries = allMatchPlayers.filter((mp) => mp.matchId === matchId);
		const p1Entry = matchEntries.find((mp) =>
			(mp.userName ?? mp.guestName ?? "").toLowerCase().includes(name1Lower)
		);
		const p2Entry = matchEntries.find((mp) =>
			(mp.userName ?? mp.guestName ?? "").toLowerCase().includes(name2Lower)
		);
		if (!p1Entry || !p2Entry) continue;

		const sameTeam = p1Entry.isHomeTeam === p2Entry.isHomeTeam;
		if (sameTeam) continue;

		if (p1Entry.result === "W") p1Wins++;
		else if (p2Entry.result === "W") p2Wins++;
		else draws++;

		matches.push({
			date: p1Entry.createdAt?.toISOString() ?? null,
			homeScore: p1Entry.homeScore,
			awayScore: p1Entry.awayScore,
			p1Team: p1Entry.isHomeTeam ? "home" : "away",
			p1Result: p1Entry.result,
			p2Team: p2Entry.isHomeTeam ? "home" : "away",
			p2Result: p2Entry.result,
		});
	}

	const p1Name =
		allMatchPlayers.find((mp) =>
			(mp.userName ?? mp.guestName ?? "").toLowerCase().includes(name1Lower)
		)?.userName ??
		allMatchPlayers.find((mp) =>
			(mp.userName ?? mp.guestName ?? "").toLowerCase().includes(name2Lower)
		)?.guestName ??
		args.player1Name;
	const p2Name =
		allMatchPlayers.find((mp) =>
			(mp.userName ?? mp.guestName ?? "").toLowerCase().includes(name2Lower)
		)?.userName ??
		allMatchPlayers.find((mp) =>
			(mp.userName ?? mp.guestName ?? "").toLowerCase().includes(name2Lower)
		)?.guestName ??
		args.player2Name;

	return {
		player1: p1Name,
		player2: p2Name,
		totalMatches: matches.length,
		player1Wins: p1Wins,
		player2Wins: p2Wins,
		draws,
		matches,
	};
}

export async function getScoringStats(
	ctx: ToolExecutorContext,
	args: { leagueId: string; seasonSlug?: string; playerName?: string }
) {
	const { db } = ctx;

	const conditions = [eq(season.leagueId, args.leagueId)];
	if (args.seasonSlug) {
		conditions.push(eq(season.slug, args.seasonSlug));
	}

	const rows = await db
		.select({
			matchId: match.id,
			createdAt: match.createdAt,
			homeScore: match.homeScore,
			awayScore: match.awayScore,
			isHomeTeam: matchPlayer.homeTeam,
			result: matchPlayer.result,
			userName: user.name,
			guestName: guest.displayName,
		})
		.from(match)
		.innerJoin(season, eq(season.id, match.seasonId))
		.innerJoin(matchPlayer, eq(matchPlayer.matchId, match.id))
		.innerJoin(seasonPlayer, eq(seasonPlayer.id, matchPlayer.seasonPlayerId))
		.innerJoin(player, eq(player.id, seasonPlayer.playerId))
		.leftJoin(user, eq(user.id, player.userId))
		.leftJoin(guest, eq(guest.id, player.guestId))
		.where(and(...conditions))
		.orderBy(desc(match.createdAt));

	if (rows.length === 0) return [];

	const byPlayer = new Map<
		string,
		{
			goalsScored: number;
			goalsConceded: number;
			matches: number;
			bestGame: { matchId: string; goals: number; date: Date | null };
			worstGame: { matchId: string; goals: number; date: Date | null };
		}
	>();

	for (const row of rows) {
		const name = row.userName ?? row.guestName ?? "Unknown";
		if (args.playerName && !name.toLowerCase().includes(args.playerName.toLowerCase())) {
			continue;
		}

		const goalsScored = row.isHomeTeam ? row.homeScore : row.awayScore;
		const goalsConceded = row.isHomeTeam ? row.awayScore : row.homeScore;

		const existing = byPlayer.get(name) ?? {
			goalsScored: 0,
			goalsConceded: 0,
			matches: 0,
			bestGame: { matchId: row.matchId, goals: goalsScored, date: row.createdAt },
			worstGame: { matchId: row.matchId, goals: goalsConceded, date: row.createdAt },
		};

		existing.goalsScored += goalsScored;
		existing.goalsConceded += goalsConceded;
		existing.matches += 1;

		if (goalsScored > existing.bestGame.goals) {
			existing.bestGame = { matchId: row.matchId, goals: goalsScored, date: row.createdAt };
		}
		if (goalsConceded > existing.worstGame.goals) {
			existing.worstGame = { matchId: row.matchId, goals: goalsConceded, date: row.createdAt };
		}

		byPlayer.set(name, existing);
	}

	return Array.from(byPlayer.entries())
		.map(([name, stats]) => ({
			name,
			goalsScored: stats.goalsScored,
			goalsConceded: stats.goalsConceded,
			goalsPerMatch: stats.matches > 0 ? +(stats.goalsScored / stats.matches).toFixed(2) : 0,
			netGoalDifference: stats.goalsScored - stats.goalsConceded,
			matchesPlayed: stats.matches,
			bestGame: stats.bestGame,
			worstGame: stats.worstGame,
		}))
		.sort((a, b) => b.goalsScored - a.goalsScored);
}

export async function getStreaks(
	ctx: ToolExecutorContext,
	args: { leagueId: string; playerName: string; seasonSlug?: string }
) {
	const { db } = ctx;
	const nameLower = args.playerName.toLowerCase();

	const conditions = [eq(season.leagueId, args.leagueId)];
	if (args.seasonSlug) {
		conditions.push(eq(season.slug, args.seasonSlug));
	}

	const rows = await db
		.select({
			matchId: match.id,
			createdAt: match.createdAt,
			result: matchPlayer.result,
			userName: user.name,
			guestName: guest.displayName,
		})
		.from(match)
		.innerJoin(season, eq(season.id, match.seasonId))
		.innerJoin(matchPlayer, eq(matchPlayer.matchId, match.id))
		.innerJoin(seasonPlayer, eq(seasonPlayer.id, matchPlayer.seasonPlayerId))
		.innerJoin(player, eq(player.id, seasonPlayer.playerId))
		.leftJoin(user, eq(user.id, player.userId))
		.leftJoin(guest, eq(guest.id, player.guestId))
		.where(and(...conditions))
		.orderBy(desc(match.createdAt));

	const playerMatches = rows.filter((r) => {
		const name = (r.userName ?? r.guestName ?? "").toLowerCase();
		return name.includes(nameLower);
	});

	if (playerMatches.length === 0) {
		return { error: `No matches found for player "${args.playerName}"` };
	}

	const results = playerMatches.map((m) => m.result);

	function countStreak(arr: Array<string | null>, result: string) {
		let max = 0;
		let current = 0;
		for (const r of arr) {
			if (r === result) {
				current++;
				max = Math.max(max, current);
			} else {
				current = 0;
			}
		}
		return max;
	}

	const currentResult = results[0];
	let currentCount = 0;
	for (const r of results) {
		if (r === currentResult) currentCount++;
		else break;
	}

	return {
		currentStreak: { type: currentResult, count: currentCount },
		longestWinStreak: countStreak(results, "W"),
		longestLossStreak: countStreak(results, "L"),
		last5: results.slice(0, 5),
		totalMatches: playerMatches.length,
	};
}

export async function getFormGuide(
	ctx: ToolExecutorContext,
	args: { leagueId: string; playerName?: string; seasonSlug?: string; matches?: number }
) {
	const { db } = ctx;
	const limit = Math.min(args.matches ?? 10, 20);

	const conditions = [eq(season.leagueId, args.leagueId)];
	if (args.seasonSlug) {
		conditions.push(eq(season.slug, args.seasonSlug));
	}

	const rows = await db
		.select({
			matchId: match.id,
			createdAt: match.createdAt,
			result: matchPlayer.result,
			scoreBefore: matchPlayer.scoreBefore,
			scoreAfter: matchPlayer.scoreAfter,
			userName: user.name,
			guestName: guest.displayName,
		})
		.from(match)
		.innerJoin(season, eq(season.id, match.seasonId))
		.innerJoin(matchPlayer, eq(matchPlayer.matchId, match.id))
		.innerJoin(seasonPlayer, eq(seasonPlayer.id, matchPlayer.seasonPlayerId))
		.innerJoin(player, eq(player.id, seasonPlayer.playerId))
		.leftJoin(user, eq(user.id, player.userId))
		.leftJoin(guest, eq(guest.id, player.guestId))
		.where(and(...conditions))
		.orderBy(desc(match.createdAt));

	if (args.playerName) {
		const nameLower = args.playerName.toLowerCase();
		const playerRows = rows.filter((r) =>
			(r.userName ?? r.guestName ?? "").toLowerCase().includes(nameLower)
		);

		if (playerRows.length === 0) {
			return { error: `No matches found for player "${args.playerName}"` };
		}

		const lastN = playerRows.slice(0, limit);
		const wins = lastN.filter((m) => m.result === "W").length;
		const changes = lastN.map((m) => m.scoreAfter - m.scoreBefore);
		const firstHalf = changes.slice(0, Math.floor(changes.length / 2));
		const secondHalf = changes.slice(Math.floor(changes.length / 2));
		const firstAvg =
			firstHalf.length > 0 ? firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length : 0;
		const secondAvg =
			secondHalf.length > 0 ? secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length : 0;

		let trend: "improving" | "declining" | "stable" = "stable";
		if (secondAvg > firstAvg + 1) trend = "improving";
		else if (secondAvg < firstAvg - 1) trend = "declining";

		return {
			playerName: args.playerName,
			lastN: lastN.map((m) => ({
				matchId: m.matchId,
				date: m.createdAt?.toISOString(),
				result: m.result,
				scoreChange: m.scoreAfter - m.scoreBefore,
			})),
			trend,
			avgChangePerMatch:
				changes.length > 0 ? +(changes.reduce((a, b) => a + b, 0) / changes.length).toFixed(2) : 0,
			winRateLastN: lastN.length > 0 ? Math.round((wins / lastN.length) * 100) : 0,
		};
	}

	// No player specified — return form for all players
	const byPlayer = new Map<string, typeof rows>();
	for (const row of rows) {
		const name = row.userName ?? row.guestName ?? "Unknown";
		const arr = byPlayer.get(name) ?? [];
		arr.push(row);
		byPlayer.set(name, arr);
	}

	return Array.from(byPlayer.entries()).map(([name, playerRows]) => {
		const lastN = playerRows.slice(0, limit);
		const wins = lastN.filter((m) => m.result === "W").length;
		const changes = lastN.map((m) => m.scoreAfter - m.scoreBefore);
		const firstHalf = changes.slice(0, Math.floor(changes.length / 2));
		const secondHalf = changes.slice(Math.floor(changes.length / 2));
		const firstAvg =
			firstHalf.length > 0 ? firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length : 0;
		const secondAvg =
			secondHalf.length > 0 ? secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length : 0;

		let trend: "improving" | "declining" | "stable" = "stable";
		if (secondAvg > firstAvg + 1) trend = "improving";
		else if (secondAvg < firstAvg - 1) trend = "declining";

		return {
			name,
			lastN: lastN.length,
			trend,
			avgChangePerMatch:
				changes.length > 0 ? +(changes.reduce((a, b) => a + b, 0) / changes.length).toFixed(2) : 0,
			winRateLastN: lastN.length > 0 ? Math.round((wins / lastN.length) * 100) : 0,
		};
	});
}

export async function getEloProgression(
	ctx: ToolExecutorContext,
	args: { leagueId: string; playerName?: string; seasonSlug?: string; limit?: number }
) {
	const { db } = ctx;
	const limit = Math.min(args.limit ?? 20, 50);

	const conditions = [eq(season.leagueId, args.leagueId)];
	if (args.seasonSlug) {
		conditions.push(eq(season.slug, args.seasonSlug));
	}

	const rows = await db
		.select({
			matchId: match.id,
			createdAt: match.createdAt,
			scoreBefore: matchPlayer.scoreBefore,
			scoreAfter: matchPlayer.scoreAfter,
			userName: user.name,
			guestName: guest.displayName,
		})
		.from(match)
		.innerJoin(season, eq(season.id, match.seasonId))
		.innerJoin(matchPlayer, eq(matchPlayer.matchId, match.id))
		.innerJoin(seasonPlayer, eq(seasonPlayer.id, matchPlayer.seasonPlayerId))
		.innerJoin(player, eq(player.id, seasonPlayer.playerId))
		.leftJoin(user, eq(user.id, player.userId))
		.leftJoin(guest, eq(guest.id, player.guestId))
		.where(and(...conditions))
		.orderBy(desc(match.createdAt));

	if (args.playerName) {
		const nameLower = args.playerName.toLowerCase();
		const playerRows = rows
			.filter((r) => (r.userName ?? r.guestName ?? "").toLowerCase().includes(nameLower))
			.slice(0, limit);

		if (playerRows.length === 0) {
			return { error: `No matches found for player "${args.playerName}"` };
		}

		let biggestGain = { matchId: "", change: 0 };
		let biggestDrop = { matchId: "", change: 0 };

		const timeline = playerRows.map((r) => {
			const change = r.scoreAfter - r.scoreBefore;
			if (change > biggestGain.change) biggestGain = { matchId: r.matchId, change };
			if (change < biggestDrop.change) biggestDrop = { matchId: r.matchId, change };
			return {
				matchId: r.matchId,
				date: r.createdAt?.toISOString(),
				scoreBefore: r.scoreBefore,
				scoreAfter: r.scoreAfter,
				change,
			};
		});

		return {
			playerName: args.playerName,
			timeline,
			biggestGain,
			biggestDrop,
			currentScore: playerRows[0]?.scoreAfter ?? 0,
		};
	}

	// No player specified — return top 5 players
	const byPlayer = new Map<string, typeof rows>();
	for (const row of rows) {
		const name = row.userName ?? row.guestName ?? "Unknown";
		const arr = byPlayer.get(name) ?? [];
		arr.push(row);
		byPlayer.set(name, arr);
	}

	const topPlayers = Array.from(byPlayer.entries())
		.sort((a, b) => (b[1][0]?.scoreAfter ?? 0) - (a[1][0]?.scoreAfter ?? 0))
		.slice(0, 5);

	return topPlayers.map(([name, playerRows]) => {
		const lastN = playerRows.slice(0, limit);
		let biggestGain = { matchId: "", change: 0 };
		let biggestDrop = { matchId: "", change: 0 };

		const timeline = lastN.map((r) => {
			const change = r.scoreAfter - r.scoreBefore;
			if (change > biggestGain.change) biggestGain = { matchId: r.matchId, change };
			if (change < biggestDrop.change) biggestDrop = { matchId: r.matchId, change };
			return {
				matchId: r.matchId,
				date: r.createdAt?.toISOString(),
				scoreBefore: r.scoreBefore,
				scoreAfter: r.scoreAfter,
				change,
			};
		});

		return {
			name,
			timeline,
			biggestGain,
			biggestDrop,
			currentScore: playerRows[0]?.scoreAfter ?? 0,
		};
	});
}

export async function getTeamChemistry(
	ctx: ToolExecutorContext,
	args: { leagueId: string; playerName: string; seasonSlug?: string }
) {
	const { db } = ctx;
	const nameLower = args.playerName.toLowerCase();

	const conditions = [eq(season.leagueId, args.leagueId)];
	if (args.seasonSlug) {
		conditions.push(eq(season.slug, args.seasonSlug));
	}

	const rows = await db
		.select({
			matchId: match.id,
			isHomeTeam: matchPlayer.homeTeam,
			result: matchPlayer.result,
			userName: user.name,
			guestName: guest.displayName,
		})
		.from(match)
		.innerJoin(season, eq(season.id, match.seasonId))
		.innerJoin(matchPlayer, eq(matchPlayer.matchId, match.id))
		.innerJoin(seasonPlayer, eq(seasonPlayer.id, matchPlayer.seasonPlayerId))
		.innerJoin(player, eq(player.id, seasonPlayer.playerId))
		.leftJoin(user, eq(user.id, player.userId))
		.leftJoin(guest, eq(guest.id, player.guestId))
		.where(and(...conditions))
		.orderBy(desc(match.createdAt));

	const targetMatches = new Map<string, { isHomeTeam: boolean; result: string }>();
	for (const row of rows) {
		const name = (row.userName ?? row.guestName ?? "").toLowerCase();
		if (name.includes(nameLower)) {
			targetMatches.set(row.matchId, { isHomeTeam: row.isHomeTeam, result: row.result });
		}
	}

	if (targetMatches.size === 0) {
		return { error: `No matches found for player "${args.playerName}"` };
	}

	const teammateStats = new Map<
		string,
		{ wins: number; losses: number; draws: number; matches: number }
	>();

	for (const row of rows) {
		const matchInfo = targetMatches.get(row.matchId);
		if (!matchInfo) continue;

		const name = row.userName ?? row.guestName ?? "Unknown";
		const rowNameLower = name.toLowerCase();
		if (rowNameLower.includes(nameLower)) continue; // Skip self

		if (row.isHomeTeam === matchInfo.isHomeTeam) {
			// Same team = teammate
			const stats = teammateStats.get(name) ?? { wins: 0, losses: 0, draws: 0, matches: 0 };
			stats.matches++;
			if (matchInfo.result === "W") stats.wins++;
			else if (matchInfo.result === "L") stats.losses++;
			else stats.draws++;
			teammateStats.set(name, stats);
		}
	}

	const results = Array.from(teammateStats.entries())
		.filter(([, stats]) => stats.matches >= 3)
		.map(([name, stats]) => ({
			name,
			matchesTogether: stats.matches,
			wins: stats.wins,
			losses: stats.losses,
			draws: stats.draws,
			winRate: stats.matches > 0 ? Math.round((stats.wins / stats.matches) * 100) : 0,
		}))
		.sort((a, b) => b.winRate - a.winRate);

	return {
		playerName: args.playerName,
		teammates: results,
		bestTeammate: results[0] ?? null,
		worstTeammate: results[results.length - 1] ?? null,
	};
}

export async function getSessionStats(
	ctx: ToolExecutorContext,
	args: { leagueId: string; playerName?: string; seasonSlug?: string }
) {
	const { db } = ctx;

	const conditions = [eq(season.leagueId, args.leagueId)];
	if (args.seasonSlug) {
		conditions.push(eq(season.slug, args.seasonSlug));
	}

	// Get all sessions with their matches for this league
	const sessions = await db
		.select({
			sessionId: gameSession.id,
			seasonId: gameSession.seasonId,
			status: gameSession.status,
		})
		.from(gameSession)
		.innerJoin(season, eq(season.id, gameSession.seasonId))
		.where(and(...conditions));

	if (sessions.length === 0) return { sessionsPlayed: 0, totalGames: 0, avgGamesPerSession: 0 };

	const sessionIds = sessions.map((s) => s.sessionId);

	const sessionPlayers = await db
		.select({
			sessionId: sessionPlayer.sessionId,
			seasonPlayerId: sessionPlayer.seasonPlayerId,
			gamesPlayed: sessionPlayer.gamesPlayedThisSession,
		})
		.from(sessionPlayer)
		.where(inArray(sessionPlayer.sessionId, sessionIds));

	// Get player names for sessionPlayers
	const seasonPlayerIds = [...new Set(sessionPlayers.map((sp) => sp.seasonPlayerId))];
	const playerNames = await db
		.select({
			seasonPlayerId: seasonPlayer.id,
			userName: user.name,
			guestName: guest.displayName,
		})
		.from(seasonPlayer)
		.innerJoin(player, eq(player.id, seasonPlayer.playerId))
		.leftJoin(user, eq(user.id, player.userId))
		.leftJoin(guest, eq(guest.id, player.guestId))
		.where(inArray(seasonPlayer.id, seasonPlayerIds));

	const nameMap = new Map(
		playerNames.map((p) => [p.seasonPlayerId, p.userName ?? p.guestName ?? "Unknown"])
	);

	if (args.playerName) {
		const nameLower = args.playerName.toLowerCase();
		const playerSessionIds = sessionPlayers
			.filter((sp) => (nameMap.get(sp.seasonPlayerId) ?? "").toLowerCase().includes(nameLower))
			.map((sp) => sp.sessionId);

		const uniqueSessions = [...new Set(playerSessionIds)];
		const totalGames = sessionPlayers
			.filter((sp) => playerSessionIds.includes(sp.sessionId))
			.reduce((sum, sp) => sum + (sp.gamesPlayed ?? 0), 0);

		return {
			playerName: args.playerName,
			sessionsPlayed: uniqueSessions.length,
			totalGamesInSessions: totalGames,
			avgGamesPerSession:
				uniqueSessions.length > 0 ? +(totalGames / uniqueSessions.length).toFixed(2) : 0,
		};
	}

	// All players
	const byPlayer = new Map<string, { sessions: Set<string>; games: number }>();
	for (const sp of sessionPlayers) {
		const name = nameMap.get(sp.seasonPlayerId) ?? "Unknown";
		const existing = byPlayer.get(name) ?? { sessions: new Set<string>(), games: 0 };
		existing.sessions.add(sp.sessionId);
		existing.games += sp.gamesPlayed ?? 0;
		byPlayer.set(name, existing);
	}

	return Array.from(byPlayer.entries()).map(([name, stats]) => ({
		name,
		sessionsPlayed: stats.sessions.size,
		totalGamesInSessions: stats.games,
		avgGamesPerSession:
			stats.sessions.size > 0 ? +(stats.games / stats.sessions.size).toFixed(2) : 0,
	}));
}

// ─── Phase 1: Match Insights ────────────────────────────────────────────────

export async function getBiggestMargins(
	ctx: ToolExecutorContext,
	args: { leagueId: string; seasonSlug?: string; limit?: number }
) {
	const { db } = ctx;
	const limit = Math.min(args.limit ?? 5, 20);

	const conditions = [eq(season.leagueId, args.leagueId)];
	if (args.seasonSlug) conditions.push(eq(season.slug, args.seasonSlug));

	const matches = await db
		.select({
			id: match.id,
			createdAt: match.createdAt,
			homeScore: match.homeScore,
			awayScore: match.awayScore,
			seasonName: season.name,
		})
		.from(match)
		.innerJoin(season, eq(season.id, match.seasonId))
		.where(and(...conditions))
		.orderBy(desc(match.createdAt));

	if (matches.length === 0) return [];

	const matchIds = matches.map((m) => m.id);
	const players = await db
		.select({
			matchId: matchPlayer.matchId,
			userName: user.name,
			guestName: guest.displayName,
			isHomeTeam: matchPlayer.homeTeam,
		})
		.from(matchPlayer)
		.innerJoin(seasonPlayer, eq(seasonPlayer.id, matchPlayer.seasonPlayerId))
		.innerJoin(player, eq(player.id, seasonPlayer.playerId))
		.leftJoin(user, eq(user.id, player.userId))
		.leftJoin(guest, eq(guest.id, player.guestId))
		.where(inArray(matchPlayer.matchId, matchIds));

	return matches
		.map((m) => {
			const margin = Math.abs(m.homeScore - m.awayScore);
			const homePlayers = players
				.filter((p) => p.matchId === m.id && p.isHomeTeam)
				.map((p) => p.userName ?? p.guestName ?? "Unknown");
			const awayPlayers = players
				.filter((p) => p.matchId === m.id && !p.isHomeTeam)
				.map((p) => p.userName ?? p.guestName ?? "Unknown");
			const winner =
				m.homeScore > m.awayScore
					? homePlayers
					: m.awayScore > m.homeScore
						? awayPlayers
						: [...homePlayers, ...awayPlayers];
			const loser =
				m.homeScore > m.awayScore ? awayPlayers : m.awayScore > m.homeScore ? homePlayers : [];
			return {
				id: m.id,
				date: m.createdAt?.toISOString() ?? null,
				homeScore: m.homeScore,
				awayScore: m.awayScore,
				margin,
				winner,
				loser,
				seasonName: m.seasonName,
			};
		})
		.sort((a, b) => b.margin - a.margin)
		.slice(0, limit);
}

export async function getClosestMatches(
	ctx: ToolExecutorContext,
	args: { leagueId: string; seasonSlug?: string; limit?: number }
) {
	const { db } = ctx;
	const limit = Math.min(args.limit ?? 5, 20);

	const conditions = [eq(season.leagueId, args.leagueId)];
	if (args.seasonSlug) conditions.push(eq(season.slug, args.seasonSlug));

	const matches = await db
		.select({
			id: match.id,
			createdAt: match.createdAt,
			homeScore: match.homeScore,
			awayScore: match.awayScore,
			seasonName: season.name,
		})
		.from(match)
		.innerJoin(season, eq(season.id, match.seasonId))
		.where(and(...conditions))
		.orderBy(desc(match.createdAt));

	if (matches.length === 0) return [];

	const matchIds = matches.map((m) => m.id);
	const players = await db
		.select({
			matchId: matchPlayer.matchId,
			userName: user.name,
			guestName: guest.displayName,
			isHomeTeam: matchPlayer.homeTeam,
		})
		.from(matchPlayer)
		.innerJoin(seasonPlayer, eq(seasonPlayer.id, matchPlayer.seasonPlayerId))
		.innerJoin(player, eq(player.id, seasonPlayer.playerId))
		.leftJoin(user, eq(user.id, player.userId))
		.leftJoin(guest, eq(guest.id, player.guestId))
		.where(inArray(matchPlayer.matchId, matchIds));

	return matches
		.map((m) => {
			const margin = Math.abs(m.homeScore - m.awayScore);
			const homePlayers = players
				.filter((p) => p.matchId === m.id && p.isHomeTeam)
				.map((p) => p.userName ?? p.guestName ?? "Unknown");
			const awayPlayers = players
				.filter((p) => p.matchId === m.id && !p.isHomeTeam)
				.map((p) => p.userName ?? p.guestName ?? "Unknown");
			return {
				id: m.id,
				date: m.createdAt?.toISOString() ?? null,
				homeScore: m.homeScore,
				awayScore: m.awayScore,
				margin,
				homePlayers,
				awayPlayers,
				seasonName: m.seasonName,
			};
		})
		.filter((m) => m.margin <= 1)
		.sort((a, b) => a.margin - b.margin)
		.slice(0, limit);
}

export async function getUpsets(
	ctx: ToolExecutorContext,
	args: { leagueId: string; seasonSlug?: string; limit?: number }
) {
	const { db } = ctx;
	const limit = Math.min(args.limit ?? 5, 20);

	const conditions = [
		eq(season.leagueId, args.leagueId),
		and(sql`${match.homeExpectedElo} IS NOT NULL`, sql`${match.awayExpectedElo} IS NOT NULL`),
	];
	if (args.seasonSlug) conditions.push(eq(season.slug, args.seasonSlug));

	const matches = await db
		.select({
			id: match.id,
			createdAt: match.createdAt,
			homeScore: match.homeScore,
			awayScore: match.awayScore,
			homeExpectedElo: match.homeExpectedElo,
			awayExpectedElo: match.awayExpectedElo,
			seasonName: season.name,
		})
		.from(match)
		.innerJoin(season, eq(season.id, match.seasonId))
		.where(and(...conditions))
		.orderBy(desc(match.createdAt));

	if (matches.length === 0) return [];

	const matchIds = matches.map((m) => m.id);
	const players = await db
		.select({
			matchId: matchPlayer.matchId,
			userName: user.name,
			guestName: guest.displayName,
			isHomeTeam: matchPlayer.homeTeam,
		})
		.from(matchPlayer)
		.innerJoin(seasonPlayer, eq(seasonPlayer.id, matchPlayer.seasonPlayerId))
		.innerJoin(player, eq(player.id, seasonPlayer.playerId))
		.leftJoin(user, eq(user.id, player.userId))
		.leftJoin(guest, eq(guest.id, player.guestId))
		.where(inArray(matchPlayer.matchId, matchIds));

	return matches
		.map((m) => {
			const homeExpected = m.homeExpectedElo ?? 0.5;
			const awayExpected = m.awayExpectedElo ?? 0.5;
			const expectedWinner = homeExpected > awayExpected ? "home" : "away";
			const actualWinner =
				m.homeScore > m.awayScore ? "home" : m.awayScore > m.homeScore ? "away" : "draw";
			const isUpset = actualWinner !== "draw" && expectedWinner !== actualWinner;
			const expectedWinProb = expectedWinner === "home" ? homeExpected : awayExpected;
			const upsetMagnitude = isUpset
				? Math.abs(expectedWinProb - (actualWinner === "home" ? 1 : 0))
				: 0;
			const homePlayers = players
				.filter((p) => p.matchId === m.id && p.isHomeTeam)
				.map((p) => p.userName ?? p.guestName ?? "Unknown");
			const awayPlayers = players
				.filter((p) => p.matchId === m.id && !p.isHomeTeam)
				.map((p) => p.userName ?? p.guestName ?? "Unknown");
			return {
				id: m.id,
				date: m.createdAt?.toISOString() ?? null,
				homeScore: m.homeScore,
				awayScore: m.awayScore,
				expectedWinner,
				actualWinner,
				isUpset,
				upsetMagnitude: +upsetMagnitude.toFixed(3),
				homePlayers,
				awayPlayers,
				seasonName: m.seasonName,
			};
		})
		.filter((m) => m.isUpset)
		.sort((a, b) => b.upsetMagnitude - a.upsetMagnitude)
		.slice(0, limit);
}

export async function getRecentMatches(
	ctx: ToolExecutorContext,
	args: {
		leagueId: string;
		days?: number;
		seasonSlug?: string;
		playerName?: string;
		limit?: number;
	}
) {
	const { db } = ctx;
	const days = args.days ?? 7;
	const limit = Math.min(args.limit ?? 20, 100);
	const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

	const conditions = [
		eq(season.leagueId, args.leagueId),
		sql`${match.createdAt} >= ${cutoff.toISOString()}`,
	];
	if (args.seasonSlug) conditions.push(eq(season.slug, args.seasonSlug));

	const allMatches = await db
		.select({
			id: match.id,
			createdAt: match.createdAt,
			homeScore: match.homeScore,
			awayScore: match.awayScore,
			seasonName: season.name,
		})
		.from(match)
		.innerJoin(season, eq(season.id, match.seasonId))
		.where(and(...conditions))
		.orderBy(desc(match.createdAt))
		.limit(limit);

	if (allMatches.length === 0) return [];

	const matchIds = allMatches.map((m) => m.id);
	const players = await db
		.select({
			matchId: matchPlayer.matchId,
			userName: user.name,
			guestName: guest.displayName,
			isHomeTeam: matchPlayer.homeTeam,
			result: matchPlayer.result,
			scoreBefore: matchPlayer.scoreBefore,
			scoreAfter: matchPlayer.scoreAfter,
		})
		.from(matchPlayer)
		.innerJoin(seasonPlayer, eq(seasonPlayer.id, matchPlayer.seasonPlayerId))
		.innerJoin(player, eq(player.id, seasonPlayer.playerId))
		.leftJoin(user, eq(user.id, player.userId))
		.leftJoin(guest, eq(guest.id, player.guestId))
		.where(inArray(matchPlayer.matchId, matchIds));

	let filtered = allMatches;
	if (args.playerName) {
		const nameLower = args.playerName.toLowerCase();
		const playerMatchIds = new Set(
			players
				.filter((p) => {
					const name = (p.userName ?? p.guestName ?? "").toLowerCase();
					return name.includes(nameLower);
				})
				.map((p) => p.matchId)
		);
		filtered = allMatches.filter((m) => playerMatchIds.has(m.id));
	}

	return filtered.map((m) => ({
		id: m.id,
		createdAt: m.createdAt,
		homeScore: m.homeScore,
		awayScore: m.awayScore,
		seasonName: m.seasonName,
		homePlayers: players
			.filter((p) => p.matchId === m.id && p.isHomeTeam)
			.map((p) => ({
				name: p.userName ?? p.guestName ?? "Unknown",
				result: p.result,
				scoreBefore: p.scoreBefore,
				scoreAfter: p.scoreAfter,
			})),
		awayPlayers: players
			.filter((p) => p.matchId === m.id && !p.isHomeTeam)
			.map((p) => ({
				name: p.userName ?? p.guestName ?? "Unknown",
				result: p.result,
				scoreBefore: p.scoreBefore,
				scoreAfter: p.scoreAfter,
			})),
	}));
}

export async function getMatchById(
	ctx: ToolExecutorContext,
	args: { leagueId: string; matchId: string }
) {
	const { db } = ctx;

	const [matchData] = await db
		.select({
			id: match.id,
			createdAt: match.createdAt,
			homeScore: match.homeScore,
			awayScore: match.awayScore,
			seasonName: season.name,
		})
		.from(match)
		.innerJoin(season, eq(season.id, match.seasonId))
		.where(and(eq(match.id, args.matchId), eq(season.leagueId, args.leagueId)))
		.limit(1);

	if (!matchData) return { error: `Match "${args.matchId}" not found` };

	const players = await db
		.select({
			userName: user.name,
			guestName: guest.displayName,
			isHomeTeam: matchPlayer.homeTeam,
			result: matchPlayer.result,
			scoreBefore: matchPlayer.scoreBefore,
			scoreAfter: matchPlayer.scoreAfter,
		})
		.from(matchPlayer)
		.innerJoin(seasonPlayer, eq(seasonPlayer.id, matchPlayer.seasonPlayerId))
		.innerJoin(player, eq(player.id, seasonPlayer.playerId))
		.leftJoin(user, eq(user.id, player.userId))
		.leftJoin(guest, eq(guest.id, player.guestId))
		.where(eq(matchPlayer.matchId, args.matchId));

	return {
		id: matchData.id,
		createdAt: matchData.createdAt,
		homeScore: matchData.homeScore,
		awayScore: matchData.awayScore,
		seasonName: matchData.seasonName,
		homePlayers: players
			.filter((p) => p.isHomeTeam)
			.map((p) => ({
				name: p.userName ?? p.guestName ?? "Unknown",
				result: p.result,
				scoreBefore: p.scoreBefore,
				scoreAfter: p.scoreAfter,
			})),
		awayPlayers: players
			.filter((p) => !p.isHomeTeam)
			.map((p) => ({
				name: p.userName ?? p.guestName ?? "Unknown",
				result: p.result,
				scoreBefore: p.scoreBefore,
				scoreAfter: p.scoreAfter,
			})),
	};
}

// ─── Phase 2: Fixtures & Schedule ───────────────────────────────────────────

export async function getFixtures(
	ctx: ToolExecutorContext,
	args: { leagueId: string; seasonSlug: string; playerName?: string }
) {
	const { db } = ctx;

	const seasonData = await db
		.select({ id: season.id })
		.from(season)
		.where(and(eq(season.slug, args.seasonSlug), eq(season.leagueId, args.leagueId)))
		.limit(1);

	if (seasonData.length === 0) return { error: `Season "${args.seasonSlug}" not found` };

	const seasonId = seasonData[0].id;

	const fixtures = await db
		.select({
			id: fixture.id,
			round: fixture.round,
			homePlayerId: fixture.homePlayerId,
			awayPlayerId: fixture.awayPlayerId,
			matchId: fixture.matchId,
		})
		.from(fixture)
		.where(eq(fixture.seasonId, seasonId))
		.orderBy(fixture.round);

	if (fixtures.length === 0) return [];

	const playerIds = [...new Set(fixtures.flatMap((f) => [f.homePlayerId, f.awayPlayerId]))];

	const names = await db
		.select({
			id: seasonPlayer.id,
			userName: user.name,
			guestName: guest.displayName,
		})
		.from(seasonPlayer)
		.innerJoin(player, eq(player.id, seasonPlayer.playerId))
		.leftJoin(user, eq(user.id, player.userId))
		.leftJoin(guest, eq(guest.id, player.guestId))
		.where(inArray(seasonPlayer.id, playerIds));

	const nameMap = new Map(names.map((n) => [n.id, n.userName ?? n.guestName ?? "Unknown"]));

	let result = fixtures.map((f) => ({
		round: f.round,
		homePlayer: nameMap.get(f.homePlayerId) ?? "Unknown",
		awayPlayer: nameMap.get(f.awayPlayerId) ?? "Unknown",
		played: f.matchId !== null,
	}));

	if (args.playerName) {
		const nameLower = args.playerName.toLowerCase();
		result = result.filter(
			(f) =>
				f.homePlayer.toLowerCase().includes(nameLower) ||
				f.awayPlayer.toLowerCase().includes(nameLower)
		);
	}

	return result;
}

export async function getSeasonProgress(
	ctx: ToolExecutorContext,
	args: { leagueId: string; seasonSlug: string }
) {
	const { db } = ctx;

	const seasonData = await db
		.select({
			id: season.id,
			name: season.name,
			startDate: season.startDate,
			endDate: season.endDate,
		})
		.from(season)
		.where(and(eq(season.slug, args.seasonSlug), eq(season.leagueId, args.leagueId)))
		.limit(1);

	if (seasonData.length === 0) return { error: `Season "${args.seasonSlug}" not found` };

	const s = seasonData[0];

	const totalFixtures = await db
		.select({ count: sql<number>`count(*)`.as("count") })
		.from(fixture)
		.where(eq(fixture.seasonId, s.id));

	const playedFixtures = await db
		.select({ count: sql<number>`count(*)`.as("count") })
		.from(fixture)
		.where(and(eq(fixture.seasonId, s.id), sql`${fixture.matchId} IS NOT NULL`));

	const activePlayers = await db
		.select({ count: sql<number>`count(distinct ${matchPlayer.seasonPlayerId})`.as("count") })
		.from(match)
		.innerJoin(matchPlayer, eq(matchPlayer.matchId, match.id))
		.where(eq(match.seasonId, s.id));

	const totalPlayers = await db
		.select({ count: sql<number>`count(*)`.as("count") })
		.from(seasonPlayer)
		.where(eq(seasonPlayer.seasonId, s.id));

	const total = totalFixtures[0]?.count ?? 0;
	const played = playedFixtures[0]?.count ?? 0;
	const completionPercent = total > 0 ? Math.round((played / total) * 100) : 0;

	const now = new Date();
	const start = s.startDate ? new Date(s.startDate) : now;
	const end = s.endDate ? new Date(s.endDate) : null;
	const daysElapsed = Math.max(
		0,
		Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
	);
	const daysRemaining = end
		? Math.max(0, Math.floor((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
		: null;

	const matchesPerDay = daysElapsed > 0 ? +(played / daysElapsed).toFixed(2) : played;
	const estimatedCompletionDate =
		matchesPerDay > 0 && total > played && end === null
			? new Date(
					now.getTime() + ((total - played) / matchesPerDay) * 24 * 60 * 60 * 1000
				).toISOString()
			: null;

	return {
		seasonName: s.name,
		totalFixtures: total,
		playedFixtures: played,
		completionPercent,
		activePlayers: activePlayers[0]?.count ?? 0,
		totalPlayers: totalPlayers[0]?.count ?? 0,
		daysElapsed,
		daysRemaining,
		matchesPerDay,
		estimatedCompletionDate,
	};
}

// ─── Phase 3: Player Milestones ─────────────────────────────────────────────

export async function getAchievements(
	ctx: ToolExecutorContext,
	args: { leagueId: string; playerName?: string; seasonSlug?: string }
) {
	const { db } = ctx;

	const achievements = await db
		.select({
			playerId: playerAchievement.playerId,
			type: playerAchievement.type,
			createdAt: playerAchievement.createdAt,
			userName: user.name,
			guestName: guest.displayName,
		})
		.from(playerAchievement)
		.innerJoin(player, eq(player.id, playerAchievement.playerId))
		.leftJoin(user, eq(user.id, player.userId))
		.leftJoin(guest, eq(guest.id, player.guestId))
		.where(eq(player.leagueId, args.leagueId))
		.orderBy(desc(playerAchievement.createdAt));

	let result = achievements.map((a) => ({
		playerName: a.userName ?? a.guestName ?? "Unknown",
		achievement: a.type,
		earnedAt: a.createdAt?.toISOString() ?? null,
	}));

	if (args.playerName) {
		const nameLower = args.playerName.toLowerCase();
		result = result.filter((r) => r.playerName.toLowerCase().includes(nameLower));
	}

	return result;
}

export async function getUnbeatenRuns(
	ctx: ToolExecutorContext,
	args: { leagueId: string; playerName?: string; seasonSlug?: string; limit?: number }
) {
	const { db } = ctx;
	const limit = Math.min(args.limit ?? 5, 20);

	const conditions = [eq(season.leagueId, args.leagueId)];
	if (args.seasonSlug) conditions.push(eq(season.slug, args.seasonSlug));

	const rows = await db
		.select({
			matchId: match.id,
			createdAt: match.createdAt,
			result: matchPlayer.result,
			userName: user.name,
			guestName: guest.displayName,
		})
		.from(match)
		.innerJoin(season, eq(season.id, match.seasonId))
		.innerJoin(matchPlayer, eq(matchPlayer.matchId, match.id))
		.innerJoin(seasonPlayer, eq(seasonPlayer.id, matchPlayer.seasonPlayerId))
		.innerJoin(player, eq(player.id, seasonPlayer.playerId))
		.leftJoin(user, eq(user.id, player.userId))
		.leftJoin(guest, eq(guest.id, player.guestId))
		.where(and(...conditions))
		.orderBy(desc(match.createdAt));

	const byPlayer = new Map<string, Array<{ result: string; date: Date | null }>>();
	for (const row of rows) {
		const name = row.userName ?? row.guestName ?? "Unknown";
		const arr = byPlayer.get(name) ?? [];
		arr.push({ result: row.result, date: row.createdAt });
		byPlayer.set(name, arr);
	}

	function analyzeUnbeaten(matches: Array<{ result: string; date: Date | null }>) {
		let longest = 0;
		let current = 0;
		let longestStart: Date | null = null;
		let longestEnd: Date | null = null;
		let currentStart = 0;

		for (let i = 0; i < matches.length; i++) {
			if (matches[i].result !== "L") {
				if (current === 0) currentStart = i;
				current++;
				if (current > longest) {
					longest = current;
					longestStart = matches[currentStart].date;
					longestEnd = matches[i].date;
				}
			} else {
				current = 0;
			}
		}

		let currentUnbeaten = 0;
		for (const m of matches) {
			if (m.result !== "L") currentUnbeaten++;
			else break;
		}

		return {
			longestUnbeaten: longest,
			currentUnbeaten,
			bestRunStart: longestStart?.toISOString() ?? null,
			bestRunEnd: longestEnd?.toISOString() ?? null,
		};
	}

	let results = Array.from(byPlayer.entries()).map(([name, matches]) => ({
		playerName: name,
		...analyzeUnbeaten(matches),
	}));

	if (args.playerName) {
		const nameLower = args.playerName.toLowerCase();
		results = results.filter((r) => r.playerName.toLowerCase().includes(nameLower));
	}

	return results.sort((a, b) => b.longestUnbeaten - a.longestUnbeaten).slice(0, limit);
}

export async function getMostImproved(
	ctx: ToolExecutorContext,
	args: { leagueId: string; seasonSlug?: string; days?: number; limit?: number }
) {
	const { db } = ctx;
	const days = args.days ?? 30;
	const limit = Math.min(args.limit ?? 5, 20);
	const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

	const conditions = [
		eq(season.leagueId, args.leagueId),
		sql`${match.createdAt} >= ${cutoff.toISOString()}`,
	];
	if (args.seasonSlug) conditions.push(eq(season.slug, args.seasonSlug));

	const rows = await db
		.select({
			matchId: match.id,
			createdAt: match.createdAt,
			scoreBefore: matchPlayer.scoreBefore,
			scoreAfter: matchPlayer.scoreAfter,
			userName: user.name,
			guestName: guest.displayName,
		})
		.from(match)
		.innerJoin(season, eq(season.id, match.seasonId))
		.innerJoin(matchPlayer, eq(matchPlayer.matchId, match.id))
		.innerJoin(seasonPlayer, eq(seasonPlayer.id, matchPlayer.seasonPlayerId))
		.innerJoin(player, eq(player.id, seasonPlayer.playerId))
		.leftJoin(user, eq(user.id, player.userId))
		.leftJoin(guest, eq(guest.id, player.guestId))
		.where(and(...conditions))
		.orderBy(desc(match.createdAt));

	const byPlayer = new Map<string, Array<{ scoreBefore: number; scoreAfter: number }>>();
	for (const row of rows) {
		const name = row.userName ?? row.guestName ?? "Unknown";
		const arr = byPlayer.get(name) ?? [];
		arr.push({ scoreBefore: row.scoreBefore, scoreAfter: row.scoreAfter });
		byPlayer.set(name, arr);
	}

	return Array.from(byPlayer.entries())
		.map(([name, matches]) => {
			const earliest = matches[matches.length - 1];
			const latest = matches[0];
			const improvement = (latest?.scoreAfter ?? 0) - (earliest?.scoreBefore ?? 0);
			return {
				playerName: name,
				scoreBefore: earliest?.scoreBefore ?? 0,
				scoreAfter: latest?.scoreAfter ?? 0,
				improvement,
				matchesPlayed: matches.length,
			};
		})
		.sort((a, b) => b.improvement - a.improvement)
		.slice(0, limit);
}

export async function getPlayerActivity(
	ctx: ToolExecutorContext,
	args: { leagueId: string; playerName: string; seasonSlug?: string }
) {
	const { db } = ctx;
	const nameLower = args.playerName.toLowerCase();

	const conditions = [eq(season.leagueId, args.leagueId)];
	if (args.seasonSlug) conditions.push(eq(season.slug, args.seasonSlug));

	const rows = await db
		.select({
			createdAt: match.createdAt,
			userName: user.name,
			guestName: guest.displayName,
		})
		.from(match)
		.innerJoin(season, eq(season.id, match.seasonId))
		.innerJoin(matchPlayer, eq(matchPlayer.matchId, match.id))
		.innerJoin(seasonPlayer, eq(seasonPlayer.id, matchPlayer.seasonPlayerId))
		.innerJoin(player, eq(player.id, seasonPlayer.playerId))
		.leftJoin(user, eq(user.id, player.userId))
		.leftJoin(guest, eq(guest.id, player.guestId))
		.where(and(...conditions))
		.orderBy(desc(match.createdAt));

	const playerRows = rows.filter((r) =>
		(r.userName ?? r.guestName ?? "").toLowerCase().includes(nameLower)
	);

	if (playerRows.length === 0) {
		return { error: `No matches found for player "${args.playerName}"` };
	}

	const totalMatches = playerRows.length;
	const lastPlayed = playerRows[0]?.createdAt?.toISOString() ?? null;

	// Group by ISO week
	const weekMap = new Map<string, number>();
	for (const row of playerRows) {
		if (!row.createdAt) continue;
		const d = new Date(row.createdAt);
		const year = d.getFullYear();
		const week = Math.floor(
			((d.getTime() - new Date(year, 0, 1).getTime()) / (1000 * 60 * 60 * 24) +
				new Date(year, 0, 1).getDay() +
				1) /
				7
		);
		const key = `${year}-W${week}`;
		weekMap.set(key, (weekMap.get(key) ?? 0) + 1);
	}

	const activeWeeks = weekMap.size;
	const gamesPerWeek = activeWeeks > 0 ? +(totalMatches / activeWeeks).toFixed(2) : 0;

	const sortedWeeks = Array.from(weekMap.entries()).sort((a, b) => b[1] - a[1]);
	const busiestWeek = sortedWeeks[0] ?? [null, 0];
	const quietestWeek = sortedWeeks[sortedWeeks.length - 1] ?? [null, 0];

	return {
		playerName: args.playerName,
		lastPlayed,
		totalMatches,
		gamesPerWeek,
		activeWeeks,
		busiestWeek: { week: busiestWeek[0], matches: busiestWeek[1] },
		quietestWeek: { week: quietestWeek[0], matches: quietestWeek[1] },
	};
}

export async function getPlayerPeak(
	ctx: ToolExecutorContext,
	args: { leagueId: string; playerName: string; seasonSlug?: string; windowSize?: number }
) {
	const { db } = ctx;
	const windowSize = Math.min(args.windowSize ?? 5, 20);
	const nameLower = args.playerName.toLowerCase();

	const conditions = [eq(season.leagueId, args.leagueId)];
	if (args.seasonSlug) conditions.push(eq(season.slug, args.seasonSlug));

	const rows = await db
		.select({
			createdAt: match.createdAt,
			result: matchPlayer.result,
			scoreBefore: matchPlayer.scoreBefore,
			scoreAfter: matchPlayer.scoreAfter,
			userName: user.name,
			guestName: guest.displayName,
		})
		.from(match)
		.innerJoin(season, eq(season.id, match.seasonId))
		.innerJoin(matchPlayer, eq(matchPlayer.matchId, match.id))
		.innerJoin(seasonPlayer, eq(seasonPlayer.id, matchPlayer.seasonPlayerId))
		.innerJoin(player, eq(player.id, seasonPlayer.playerId))
		.leftJoin(user, eq(user.id, player.userId))
		.leftJoin(guest, eq(guest.id, player.guestId))
		.where(and(...conditions))
		.orderBy(desc(match.createdAt));

	const playerRows = rows.filter((r) =>
		(r.userName ?? r.guestName ?? "").toLowerCase().includes(nameLower)
	);

	if (playerRows.length === 0) {
		return { error: `No matches found for player "${args.playerName}"` };
	}

	if (playerRows.length < windowSize) {
		return {
			playerName: args.playerName,
			bestWindow: null,
			reason: `Not enough matches (${playerRows.length}) for window size ${windowSize}`,
		};
	}

	let bestWindow: {
		startDate: string | null;
		endDate: string | null;
		matches: number;
		wins: number;
		winRate: number;
		eloGain: number;
	} | null = null;

	for (let i = 0; i <= playerRows.length - windowSize; i++) {
		const window = playerRows.slice(i, i + windowSize);
		const wins = window.filter((m) => m.result === "W").length;
		const winRate = wins / window.length;
		const eloGain = window[window.length - 1].scoreAfter - window[0].scoreBefore;

		if (
			!bestWindow ||
			winRate > bestWindow.winRate ||
			(winRate === bestWindow.winRate && eloGain > bestWindow.eloGain)
		) {
			bestWindow = {
				startDate: window[window.length - 1].createdAt?.toISOString() ?? null,
				endDate: window[0].createdAt?.toISOString() ?? null,
				matches: window.length,
				wins,
				winRate: Math.round(winRate * 100),
				eloGain,
			};
		}
	}

	return {
		playerName: args.playerName,
		bestWindow,
	};
}

// ─── Phase 4: Team ──────────────────────────────────────────────────────────

export async function getTeamStandings(
	ctx: ToolExecutorContext,
	args: { leagueId: string; seasonSlug: string }
) {
	const { db } = ctx;

	const seasonData = await db
		.select({ id: season.id, name: season.name })
		.from(season)
		.where(and(eq(season.slug, args.seasonSlug), eq(season.leagueId, args.leagueId)))
		.limit(1);

	if (seasonData.length === 0) return { error: `Season "${args.seasonSlug}" not found` };

	const seasonId = seasonData[0].id;

	const standings = await db
		.select({
			teamName: leagueTeam.name,
			score: seasonTeam.score,
			matchesPlayed: sql<number>`count(${matchTeam.id})`.as("matches_played"),
			wins: sql<number>`sum(case when ${matchTeam.result} = 'W' then 1 else 0 end)`.as("wins"),
			losses: sql<number>`sum(case when ${matchTeam.result} = 'L' then 1 else 0 end)`.as("losses"),
			draws: sql<number>`sum(case when ${matchTeam.result} = 'D' then 1 else 0 end)`.as("draws"),
		})
		.from(seasonTeam)
		.innerJoin(leagueTeam, eq(leagueTeam.id, seasonTeam.leagueTeamId))
		.leftJoin(matchTeam, eq(matchTeam.seasonTeamId, seasonTeam.id))
		.where(eq(seasonTeam.seasonId, seasonId))
		.groupBy(seasonTeam.id, leagueTeam.name, seasonTeam.score)
		.orderBy(desc(seasonTeam.score));

	return {
		seasonName: seasonData[0].name,
		standings: standings.map((s) => ({
			teamName: s.teamName,
			score: s.score,
			matchesPlayed: s.matchesPlayed ?? 0,
			wins: s.wins ?? 0,
			losses: s.losses ?? 0,
			draws: s.draws ?? 0,
		})),
	};
}

export async function getTeamStats(
	ctx: ToolExecutorContext,
	args: { leagueId: string; seasonSlug?: string; teamName?: string }
) {
	const { db } = ctx;

	const conditions = [eq(season.leagueId, args.leagueId)];
	if (args.seasonSlug) conditions.push(eq(season.slug, args.seasonSlug));

	const teams = await db
		.select({
			seasonTeamId: seasonTeam.id,
			teamName: leagueTeam.name,
			score: seasonTeam.score,
		})
		.from(seasonTeam)
		.innerJoin(leagueTeam, eq(leagueTeam.id, seasonTeam.leagueTeamId))
		.innerJoin(season, eq(season.id, seasonTeam.seasonId))
		.where(and(...conditions));

	if (teams.length === 0) return [];

	const seasonTeamIds = teams.map((t) => t.seasonTeamId);

	const stats = await db
		.select({
			seasonTeamId: matchTeam.seasonTeamId,
			matchesPlayed: sql<number>`count(*)`.as("matches_played"),
			wins: sql<number>`sum(case when ${matchTeam.result} = 'W' then 1 else 0 end)`.as("wins"),
			losses: sql<number>`sum(case when ${matchTeam.result} = 'L' then 1 else 0 end)`.as("losses"),
			draws: sql<number>`sum(case when ${matchTeam.result} = 'D' then 1 else 0 end)`.as("draws"),
		})
		.from(matchTeam)
		.where(inArray(matchTeam.seasonTeamId, seasonTeamIds))
		.groupBy(matchTeam.seasonTeamId);

	const statsMap = new Map(stats.map((s) => [s.seasonTeamId, s]));

	let result = teams.map((t) => {
		const s = statsMap.get(t.seasonTeamId);
		const played = s?.matchesPlayed ?? 0;
		return {
			teamName: t.teamName,
			score: t.score,
			matchesPlayed: played,
			wins: s?.wins ?? 0,
			losses: s?.losses ?? 0,
			draws: s?.draws ?? 0,
			winRate: played > 0 ? Math.round(((s?.wins ?? 0) / played) * 100) : 0,
		};
	});

	if (args.teamName) {
		const nameLower = args.teamName.toLowerCase();
		result = result.filter((r) => r.teamName.toLowerCase().includes(nameLower));
	}

	return result;
}

// ─── Phase 5: Comparative ───────────────────────────────────────────────────

export async function getComparison(
	ctx: ToolExecutorContext,
	args: { leagueId: string; player1Name: string; player2Name: string; seasonSlug?: string }
) {
	const p1Stats = await getPlayerStats(ctx, {
		leagueId: args.leagueId,
		playerName: args.player1Name,
		seasonSlug: args.seasonSlug,
	});
	const p2Stats = await getPlayerStats(ctx, {
		leagueId: args.leagueId,
		playerName: args.player2Name,
		seasonSlug: args.seasonSlug,
	});
	const h2h = await getHeadToHead(ctx, {
		leagueId: args.leagueId,
		player1Name: args.player1Name,
		player2Name: args.player2Name,
		seasonSlug: args.seasonSlug,
	});

	const extractStats = (stats: unknown) => {
		if (!stats || typeof stats !== "object" || "error" in stats) {
			return {
				name: "Unknown",
				totalMatches: 0,
				wins: 0,
				losses: 0,
				winRate: 0,
				currentScore: 0,
				longestWinStreak: 0,
			};
		}
		const s = stats as Record<string, unknown>;
		return {
			name: (s.playerName as string) ?? "Unknown",
			totalMatches: (s.totalMatches as number) ?? 0,
			wins: (s.wins as number) ?? 0,
			losses: (s.losses as number) ?? 0,
			winRate: (s.winRate as number) ?? 0,
			currentScore: 0,
			longestWinStreak: 0,
		};
	};

	return {
		player1: extractStats(p1Stats),
		player2: extractStats(p2Stats),
		headToHead: {
			totalMatches: (h2h as Record<string, unknown>)?.totalMatches ?? 0,
			player1Wins: (h2h as Record<string, unknown>)?.player1Wins ?? 0,
			player2Wins: (h2h as Record<string, unknown>)?.player2Wins ?? 0,
			draws: (h2h as Record<string, unknown>)?.draws ?? 0,
		},
	};
}

export async function getWinProbability(
	ctx: ToolExecutorContext,
	args: { leagueId: string; player1Name: string; player2Name: string; seasonSlug?: string }
) {
	const { db } = ctx;
	const name1Lower = args.player1Name.toLowerCase();
	const name2Lower = args.player2Name.toLowerCase();

	const conditions = [eq(season.leagueId, args.leagueId)];
	if (args.seasonSlug) conditions.push(eq(season.slug, args.seasonSlug));

	const rows = await db
		.select({
			score: seasonPlayer.score,
			scoreType: season.scoreType,
			userName: user.name,
			guestName: guest.displayName,
		})
		.from(seasonPlayer)
		.innerJoin(season, eq(season.id, seasonPlayer.seasonId))
		.innerJoin(player, eq(player.id, seasonPlayer.playerId))
		.leftJoin(user, eq(user.id, player.userId))
		.leftJoin(guest, eq(guest.id, player.guestId))
		.where(and(...conditions))
		.orderBy(desc(seasonPlayer.score));

	const p1 = rows.find((r) => (r.userName ?? r.guestName ?? "").toLowerCase().includes(name1Lower));
	const p2 = rows.find((r) => (r.userName ?? r.guestName ?? "").toLowerCase().includes(name2Lower));

	if (!p1 || !p2) {
		return { error: `Could not find both players for probability calculation` };
	}

	const p1Name = p1.userName ?? p1.guestName ?? args.player1Name;
	const p2Name = p2.userName ?? p2.guestName ?? args.player2Name;

	// Only compute ELO-based probabilities for elo score types
	const isElo = p1.scoreType?.includes("elo");

	if (!isElo) {
		return {
			player1: { name: p1Name, score: p1.score, winProbability: null },
			player2: { name: p2Name, score: p2.score, winProbability: null },
			drawProbability: null,
			predictedMargin: null,
		};
	}

	function expectedScore(self: number, opponent: number) {
		return 1 / (1 + Math.pow(10, (opponent - self) / 400));
	}

	const p1Prob = expectedScore(p1.score, p2.score);
	const p2Prob = expectedScore(p2.score, p1.score);
	const drawProb = Math.max(0, 1 - p1Prob - p2Prob);

	return {
		player1: { name: p1Name, score: p1.score, winProbability: Math.round(p1Prob * 100) },
		player2: { name: p2Name, score: p2.score, winProbability: Math.round(p2Prob * 100) },
		drawProbability: Math.round(drawProb * 100),
		predictedMargin: null,
	};
}

export async function getRivalries(
	ctx: ToolExecutorContext,
	args: { leagueId: string; seasonSlug?: string; limit?: number }
) {
	const { db } = ctx;
	const limit = Math.min(args.limit ?? 5, 20);

	const conditions = [eq(season.leagueId, args.leagueId)];
	if (args.seasonSlug) conditions.push(eq(season.slug, args.seasonSlug));

	const rows = await db
		.select({
			matchId: match.id,
			createdAt: match.createdAt,
			userName: user.name,
			guestName: guest.displayName,
			isHomeTeam: matchPlayer.homeTeam,
			result: matchPlayer.result,
		})
		.from(match)
		.innerJoin(season, eq(season.id, match.seasonId))
		.innerJoin(matchPlayer, eq(matchPlayer.matchId, match.id))
		.innerJoin(seasonPlayer, eq(seasonPlayer.id, matchPlayer.seasonPlayerId))
		.innerJoin(player, eq(player.id, seasonPlayer.playerId))
		.leftJoin(user, eq(user.id, player.userId))
		.leftJoin(guest, eq(guest.id, player.guestId))
		.where(and(...conditions))
		.orderBy(desc(match.createdAt));

	// Group players by match and team
	const matchTeams = new Map<
		string,
		Array<{ name: string; isHomeTeam: boolean; result: string }>
	>();
	for (const row of rows) {
		const arr = matchTeams.get(row.matchId) ?? [];
		arr.push({
			name: row.userName ?? row.guestName ?? "Unknown",
			isHomeTeam: row.isHomeTeam,
			result: row.result,
		});
		matchTeams.set(row.matchId, arr);
	}

	// Build rivalries: every cross-team pairing
	const rivalryMap = new Map<
		string,
		{
			p1: string;
			p2: string;
			matches: number;
			p1Wins: number;
			p2Wins: number;
			draws: number;
			lastPlayed: string | null;
		}
	>();

	for (const [matchId, players] of matchTeams) {
		const homePlayers = players.filter((p) => p.isHomeTeam);
		const awayPlayers = players.filter((p) => !p.isHomeTeam);
		const date = rows.find((r) => r.matchId === matchId)?.createdAt?.toISOString() ?? null;

		for (const hp of homePlayers) {
			for (const ap of awayPlayers) {
				const key = [hp.name, ap.name].sort().join("::");
				const existing = rivalryMap.get(key) ?? {
					p1: hp.name,
					p2: ap.name,
					matches: 0,
					p1Wins: 0,
					p2Wins: 0,
					draws: 0,
					lastPlayed: null,
				};
				existing.matches++;
				if (hp.result === "W" || ap.result === "L") existing.p1Wins++;
				else if (hp.result === "L" || ap.result === "W") existing.p2Wins++;
				else existing.draws++;
				if (date && (!existing.lastPlayed || date > existing.lastPlayed)) {
					existing.lastPlayed = date;
				}
				rivalryMap.set(key, existing);
			}
		}
	}

	return Array.from(rivalryMap.values())
		.sort((a, b) => b.matches - a.matches)
		.slice(0, limit)
		.map((r) => ({
			player1: r.p1,
			player2: r.p2,
			matchesPlayed: r.matches,
			player1Wins: r.p1Wins,
			player2Wins: r.p2Wins,
			draws: r.draws,
			lastPlayed: r.lastPlayed,
		}));
}

// ─── Phase 6: League Narrative ──────────────────────────────────────────────

export async function getLeagueRecords(
	ctx: ToolExecutorContext,
	args: { leagueId: string; recordType?: string }
) {
	const { db } = ctx;
	const types = args.recordType
		? [args.recordType]
		: [
				"highest_score",
				"lowest_score",
				"longest_win_streak",
				"most_matches",
				"biggest_margin",
				"most_goals_game",
			];

	const records: Array<{
		recordType: string;
		holder: string;
		value: number | string;
		seasonName: string | null;
		date: string | null;
	}> = [];

	for (const type of types) {
		switch (type) {
			case "highest_score": {
				const row = await db
					.select({
						score: seasonPlayer.score,
						userName: user.name,
						guestName: guest.displayName,
						seasonName: season.name,
					})
					.from(seasonPlayer)
					.innerJoin(player, eq(player.id, seasonPlayer.playerId))
					.innerJoin(season, eq(season.id, seasonPlayer.seasonId))
					.leftJoin(user, eq(user.id, player.userId))
					.leftJoin(guest, eq(guest.id, player.guestId))
					.where(eq(season.leagueId, args.leagueId))
					.orderBy(desc(seasonPlayer.score))
					.limit(1);
				if (row[0]) {
					records.push({
						recordType: type,
						holder: row[0].userName ?? row[0].guestName ?? "Unknown",
						value: row[0].score,
						seasonName: row[0].seasonName,
						date: null,
					});
				}
				break;
			}
			case "lowest_score": {
				const row = await db
					.select({
						score: seasonPlayer.score,
						userName: user.name,
						guestName: guest.displayName,
						seasonName: season.name,
					})
					.from(seasonPlayer)
					.innerJoin(player, eq(player.id, seasonPlayer.playerId))
					.innerJoin(season, eq(season.id, seasonPlayer.seasonId))
					.leftJoin(user, eq(user.id, player.userId))
					.leftJoin(guest, eq(guest.id, player.guestId))
					.where(eq(season.leagueId, args.leagueId))
					.orderBy(seasonPlayer.score)
					.limit(1);
				if (row[0]) {
					records.push({
						recordType: type,
						holder: row[0].userName ?? row[0].guestName ?? "Unknown",
						value: row[0].score,
						seasonName: row[0].seasonName,
						date: null,
					});
				}
				break;
			}
			case "most_matches": {
				const rows = await db
					.select({
						userName: user.name,
						guestName: guest.displayName,
						count: sql<number>`count(${matchPlayer.id})`.as("count"),
					})
					.from(matchPlayer)
					.innerJoin(seasonPlayer, eq(seasonPlayer.id, matchPlayer.seasonPlayerId))
					.innerJoin(player, eq(player.id, seasonPlayer.playerId))
					.innerJoin(season, eq(season.id, seasonPlayer.seasonId))
					.leftJoin(user, eq(user.id, player.userId))
					.leftJoin(guest, eq(guest.id, player.guestId))
					.where(eq(season.leagueId, args.leagueId))
					.groupBy(player.id, user.name, guest.displayName)
					.orderBy(desc(sql`count(${matchPlayer.id})`))
					.limit(1);
				if (rows[0]) {
					records.push({
						recordType: type,
						holder: rows[0].userName ?? rows[0].guestName ?? "Unknown",
						value: rows[0].count,
						seasonName: null,
						date: null,
					});
				}
				break;
			}
			case "biggest_margin": {
				const rows = await db
					.select({
						homeScore: match.homeScore,
						awayScore: match.awayScore,
						createdAt: match.createdAt,
						seasonName: season.name,
					})
					.from(match)
					.innerJoin(season, eq(season.id, match.seasonId))
					.where(eq(season.leagueId, args.leagueId))
					.orderBy(desc(sql`abs(${match.homeScore} - ${match.awayScore})`))
					.limit(1);
				if (rows[0]) {
					records.push({
						recordType: type,
						holder: `${rows[0].homeScore}-${rows[0].awayScore}`,
						value: Math.abs(rows[0].homeScore - rows[0].awayScore),
						seasonName: rows[0].seasonName,
						date: rows[0].createdAt?.toISOString() ?? null,
					});
				}
				break;
			}
			case "most_goals_game": {
				const rows = await db
					.select({
						homeScore: match.homeScore,
						awayScore: match.awayScore,
						createdAt: match.createdAt,
						seasonName: season.name,
					})
					.from(match)
					.innerJoin(season, eq(season.id, match.seasonId))
					.where(eq(season.leagueId, args.leagueId))
					.orderBy(desc(sql`${match.homeScore} + ${match.awayScore}`))
					.limit(1);
				if (rows[0]) {
					records.push({
						recordType: type,
						holder: `${rows[0].homeScore}-${rows[0].awayScore}`,
						value: rows[0].homeScore + rows[0].awayScore,
						seasonName: rows[0].seasonName,
						date: rows[0].createdAt?.toISOString() ?? null,
					});
				}
				break;
			}
			case "longest_win_streak": {
				// This requires walking match history per player — compute from existing data
				const allRows = await db
					.select({
						result: matchPlayer.result,
						userName: user.name,
						guestName: guest.displayName,
					})
					.from(match)
					.innerJoin(season, eq(season.id, match.seasonId))
					.innerJoin(matchPlayer, eq(matchPlayer.matchId, match.id))
					.innerJoin(seasonPlayer, eq(seasonPlayer.id, matchPlayer.seasonPlayerId))
					.innerJoin(player, eq(player.id, seasonPlayer.playerId))
					.leftJoin(user, eq(user.id, player.userId))
					.leftJoin(guest, eq(guest.id, player.guestId))
					.where(eq(season.leagueId, args.leagueId))
					.orderBy(desc(match.createdAt));

				const byPlayer = new Map<string, Array<string>>();
				for (const row of allRows) {
					const name = row.userName ?? row.guestName ?? "Unknown";
					const arr = byPlayer.get(name) ?? [];
					arr.push(row.result);
					byPlayer.set(name, arr);
				}

				let bestPlayer = "";
				let bestStreak = 0;
				for (const [name, results] of byPlayer) {
					let max = 0;
					let current = 0;
					for (const r of results) {
						if (r === "W") {
							current++;
							max = Math.max(max, current);
						} else {
							current = 0;
						}
					}
					if (max > bestStreak) {
						bestStreak = max;
						bestPlayer = name;
					}
				}
				records.push({
					recordType: type,
					holder: bestPlayer,
					value: bestStreak,
					seasonName: null,
					date: null,
				});
				break;
			}
		}
	}

	return records;
}

export async function getSeasonHighlights(
	ctx: ToolExecutorContext,
	args: { leagueId: string; seasonSlug: string }
) {
	const { db } = ctx;

	const seasonData = await db
		.select({ id: season.id, name: season.name })
		.from(season)
		.where(and(eq(season.slug, args.seasonSlug), eq(season.leagueId, args.leagueId)))
		.limit(1);

	if (seasonData.length === 0) return { error: `Season "${args.seasonSlug}" not found` };

	const seasonId = seasonData[0].id;
	const highlights: Array<{
		category: "upset" | "streak" | "improvement" | "title_race" | "milestone";
		title: string;
		description: string;
		players: string[];
		date: string | null;
	}> = [];

	// Biggest upset
	const upsets = await db
		.select({
			id: match.id,
			createdAt: match.createdAt,
			homeScore: match.homeScore,
			awayScore: match.awayScore,
			homeExpectedElo: match.homeExpectedElo,
			awayExpectedElo: match.awayExpectedElo,
		})
		.from(match)
		.where(eq(match.seasonId, seasonId))
		.orderBy(desc(sql`abs(${match.homeExpectedElo} - ${match.awayExpectedElo})`))
		.limit(1);

	if (upsets[0] && upsets[0].homeExpectedElo !== null && upsets[0].awayExpectedElo !== null) {
		const m = upsets[0];
		const homeExpected = m.homeExpectedElo ?? 0.5;
		const awayExpected = m.awayExpectedElo ?? 0.5;
		const expectedWinner = homeExpected > awayExpected ? "home" : "away";
		const actualWinner =
			m.homeScore > m.awayScore ? "home" : m.awayScore > m.homeScore ? "away" : "draw";
		if (expectedWinner !== actualWinner && actualWinner !== "draw") {
			// Get player names
			const matchPlayers = await db
				.select({
					userName: user.name,
					guestName: guest.displayName,
					isHomeTeam: matchPlayer.homeTeam,
				})
				.from(matchPlayer)
				.innerJoin(seasonPlayer, eq(seasonPlayer.id, matchPlayer.seasonPlayerId))
				.innerJoin(player, eq(player.id, seasonPlayer.playerId))
				.leftJoin(user, eq(user.id, player.userId))
				.leftJoin(guest, eq(guest.id, player.guestId))
				.where(eq(matchPlayer.matchId, m.id));

			const winnerNames = matchPlayers
				.filter((p) => p.isHomeTeam === (actualWinner === "home"))
				.map((p) => p.userName ?? p.guestName ?? "Unknown");
			const loserNames = matchPlayers
				.filter((p) => p.isHomeTeam !== (actualWinner === "home"))
				.map((p) => p.userName ?? p.guestName ?? "Unknown");

			highlights.push({
				category: "upset",
				title: `Biggest upset: ${winnerNames.join(", ")} beat ${loserNames.join(", ")}`,
				description: `Expected win probability was ${Math.round((expectedWinner === "home" ? homeExpected : awayExpected) * 100)}% for the other side.`,
				players: [...winnerNames, ...loserNames],
				date: m.createdAt?.toISOString() ?? null,
			});
		}
	}

	// Longest win streak
	const streakRows = await db
		.select({
			result: matchPlayer.result,
			userName: user.name,
			guestName: guest.displayName,
		})
		.from(match)
		.innerJoin(matchPlayer, eq(matchPlayer.matchId, match.id))
		.innerJoin(seasonPlayer, eq(seasonPlayer.id, matchPlayer.seasonPlayerId))
		.innerJoin(player, eq(player.id, seasonPlayer.playerId))
		.leftJoin(user, eq(user.id, player.userId))
		.leftJoin(guest, eq(guest.id, player.guestId))
		.where(eq(match.seasonId, seasonId))
		.orderBy(desc(match.createdAt));

	const byPlayer = new Map<string, Array<string>>();
	for (const row of streakRows) {
		const name = row.userName ?? row.guestName ?? "Unknown";
		const arr = byPlayer.get(name) ?? [];
		arr.push(row.result);
		byPlayer.set(name, arr);
	}

	let bestStreakPlayer = "";
	let bestStreak = 0;
	for (const [name, results] of byPlayer) {
		let max = 0;
		let current = 0;
		for (const r of results) {
			if (r === "W") {
				current++;
				max = Math.max(max, current);
			} else {
				current = 0;
			}
		}
		if (max > bestStreak) {
			bestStreak = max;
			bestStreakPlayer = name;
		}
	}
	if (bestStreak >= 3) {
		highlights.push({
			category: "streak",
			title: `Longest win streak: ${bestStreakPlayer} (${bestStreak} wins)`,
			description: `${bestStreakPlayer} went on a ${bestStreak}-game winning streak this season.`,
			players: [bestStreakPlayer],
			date: null,
		});
	}

	// Title race gap
	const standings = await db
		.select({
			userName: user.name,
			guestName: guest.displayName,
			score: seasonPlayer.score,
		})
		.from(seasonPlayer)
		.innerJoin(player, eq(player.id, seasonPlayer.playerId))
		.leftJoin(user, eq(user.id, player.userId))
		.leftJoin(guest, eq(guest.id, player.guestId))
		.where(eq(seasonPlayer.seasonId, seasonId))
		.orderBy(desc(seasonPlayer.score))
		.limit(2);

	if (standings.length === 2) {
		const first = standings[0];
		const second = standings[1];
		const gap = first.score - second.score;
		if (gap <= 50) {
			highlights.push({
				category: "title_race",
				title: `Close title race: ${gap} points separating 1st and 2nd`,
				description: `${first.userName ?? first.guestName ?? "Unknown"} leads ${second.userName ?? second.guestName ?? "Unknown"} by just ${gap} points.`,
				players: [
					first.userName ?? first.guestName ?? "Unknown",
					second.userName ?? second.guestName ?? "Unknown",
				],
				date: null,
			});
		}
	}

	return { seasonName: seasonData[0].name, highlights };
}

export async function getFairnessIndex(
	ctx: ToolExecutorContext,
	args: { leagueId: string; seasonSlug?: string }
) {
	const { db } = ctx;

	const conditions = [
		eq(season.leagueId, args.leagueId),
		sql`${match.homeExpectedElo} IS NOT NULL`,
		sql`${match.awayExpectedElo} IS NOT NULL`,
	];
	if (args.seasonSlug) conditions.push(eq(season.slug, args.seasonSlug));

	const rows = await db
		.select({
			homeScore: match.homeScore,
			awayScore: match.awayScore,
			homeExpectedElo: match.homeExpectedElo,
			awayExpectedElo: match.awayExpectedElo,
			createdAt: match.createdAt,
		})
		.from(match)
		.innerJoin(season, eq(season.id, match.seasonId))
		.where(and(...conditions));

	if (rows.length === 0) {
		return { totalMatches: 0, favoriteWins: 0, underdogWins: 0, draws: 0, fairnessPercent: null };
	}

	let favoriteWins = 0;
	let underdogWins = 0;
	let draws = 0;
	let totalUpsetMagnitude = 0;
	let mostLopsided = { expected: 0, actual: "", date: null as string | null };

	for (const row of rows) {
		const homeExpected = row.homeExpectedElo ?? 0.5;
		const awayExpected = row.awayExpectedElo ?? 0.5;
		const expectedWinner = homeExpected > awayExpected ? "home" : "away";
		const actualWinner =
			row.homeScore > row.awayScore ? "home" : row.awayScore > row.homeScore ? "away" : "draw";

		if (actualWinner === "draw") {
			draws++;
		} else if (expectedWinner === actualWinner) {
			favoriteWins++;
		} else {
			underdogWins++;
			const expectedProb = expectedWinner === "home" ? homeExpected : awayExpected;
			totalUpsetMagnitude += Math.abs(expectedProb - (actualWinner === "home" ? 1 : 0));
		}

		const lopsidedness = Math.abs(homeExpected - awayExpected);
		if (lopsidedness > mostLopsided.expected) {
			mostLopsided = {
				expected: lopsidedness,
				actual: `${row.homeScore}-${row.awayScore}`,
				date: row.createdAt?.toISOString() ?? null,
			};
		}
	}

	const decisiveMatches = favoriteWins + underdogWins;
	return {
		totalMatches: rows.length,
		favoriteWins,
		underdogWins,
		draws,
		fairnessPercent:
			decisiveMatches > 0 ? Math.round((favoriteWins / decisiveMatches) * 100) : null,
		avgUpsetMagnitude: underdogWins > 0 ? +(totalUpsetMagnitude / underdogWins).toFixed(3) : 0,
		mostLopsidedMatch: mostLopsided,
	};
}

export async function getBusiestPeriods(
	ctx: ToolExecutorContext,
	args: { leagueId: string; seasonSlug?: string; granularity?: string; limit?: number }
) {
	const { db } = ctx;
	const granularity = args.granularity ?? "week";
	const limit = Math.min(args.limit ?? 5, 20);

	const conditions = [eq(season.leagueId, args.leagueId)];
	if (args.seasonSlug) conditions.push(eq(season.slug, args.seasonSlug));

	const rows = await db
		.select({
			createdAt: match.createdAt,
			matchId: match.id,
		})
		.from(match)
		.innerJoin(season, eq(season.id, match.seasonId))
		.where(and(...conditions))
		.orderBy(desc(match.createdAt));

	const periodMap = new Map<string, { matches: number; matchIds: Set<string> }>();

	for (const row of rows) {
		if (!row.createdAt) continue;
		const d = new Date(row.createdAt);
		let key: string;
		if (granularity === "day") {
			key = d.toISOString().split("T")[0];
		} else {
			const year = d.getFullYear();
			const week = Math.floor(
				((d.getTime() - new Date(year, 0, 1).getTime()) / (1000 * 60 * 60 * 24) +
					new Date(year, 0, 1).getDay() +
					1) /
					7
			);
			key = `${year}-W${week}`;
		}
		const existing = periodMap.get(key) ?? { matches: 0, matchIds: new Set<string>() };
		existing.matches++;
		existing.matchIds.add(row.matchId);
		periodMap.set(key, existing);
	}

	// This doesn't give us unique players per period easily without more queries.
	// Let's simplify and just return match counts.
	return Array.from(periodMap.entries())
		.map(([period, data]) => ({
			period,
			matchesPlayed: data.matches,
			uniquePlayers: 0, // Would need additional query per period
		}))
		.sort((a, b) => b.matchesPlayed - a.matchesPlayed)
		.slice(0, limit);
}

// ─── Phase 7: Session ───────────────────────────────────────────────────────

export async function getActiveSessions(
	ctx: ToolExecutorContext,
	args: { leagueId: string; seasonSlug?: string }
) {
	const { db } = ctx;

	const conditions = [eq(season.leagueId, args.leagueId), eq(gameSession.status, "active")];
	if (args.seasonSlug) conditions.push(eq(season.slug, args.seasonSlug));

	const sessions = await db
		.select({
			sessionId: gameSession.id,
			seasonName: season.name,
			status: gameSession.status,
			rotationMode: gameSession.rotationMode,
			teamSize: gameSession.teamSize,
			createdAt: gameSession.createdAt,
		})
		.from(gameSession)
		.innerJoin(season, eq(season.id, gameSession.seasonId))
		.where(and(...conditions));

	if (sessions.length === 0) return [];

	const sessionIds = sessions.map((s) => s.sessionId);

	const players = await db
		.select({
			sessionId: sessionPlayer.sessionId,
			status: sessionPlayer.status,
		})
		.from(sessionPlayer)
		.where(inArray(sessionPlayer.sessionId, sessionIds));

	const matches = await db
		.select({
			sessionId: sessionMatch.sessionId,
		})
		.from(sessionMatch)
		.where(inArray(sessionMatch.sessionId, sessionIds));

	const matchesBySession = new Map<string, number>();
	for (const m of matches) {
		matchesBySession.set(m.sessionId, (matchesBySession.get(m.sessionId) ?? 0) + 1);
	}

	const playersBySession = new Map<string, { active: number; waiting: number }>();
	for (const p of players) {
		const existing = playersBySession.get(p.sessionId) ?? { active: 0, waiting: 0 };
		if (p.status === "playing") existing.active++;
		else existing.waiting++;
		playersBySession.set(p.sessionId, existing);
	}

	return sessions.map((s) => {
		const p = playersBySession.get(s.sessionId) ?? { active: 0, waiting: 0 };
		return {
			sessionId: s.sessionId,
			seasonName: s.seasonName,
			status: s.status,
			rotationMode: s.rotationMode,
			teamSize: s.teamSize,
			playersActive: p.active,
			playersWaiting: p.waiting,
			matchesPlayedThisSession: matchesBySession.get(s.sessionId) ?? 0,
			startedAt: s.createdAt?.toISOString() ?? null,
		};
	});
}

export async function getSessionLineup(
	ctx: ToolExecutorContext,
	args: { leagueId: string; sessionId: string }
) {
	const { db } = ctx;

	const [session] = await db
		.select({
			id: gameSession.id,
			rotationMode: gameSession.rotationMode,
			seasonId: gameSession.seasonId,
		})
		.from(gameSession)
		.innerJoin(season, eq(season.id, gameSession.seasonId))
		.where(and(eq(gameSession.id, args.sessionId), eq(season.leagueId, args.leagueId)))
		.limit(1);

	if (!session) return { error: `Session "${args.sessionId}" not found` };

	// Get current match (highest matchNumber)
	const currentMatches = await db
		.select({
			id: sessionMatch.id,
			matchNumber: sessionMatch.matchNumber,
			homePlayerIds: sessionMatch.homePlayerIds,
			awayPlayerIds: sessionMatch.awayPlayerIds,
			homeSessionScore: sessionMatch.homeSessionScore,
			awaySessionScore: sessionMatch.awaySessionScore,
			result: sessionMatch.result,
		})
		.from(sessionMatch)
		.where(eq(sessionMatch.sessionId, args.sessionId))
		.orderBy(desc(sessionMatch.matchNumber))
		.limit(1);

	const currentMatch = currentMatches[0];

	// Get waiting queue
	const queue = await db
		.select({
			seasonPlayerId: sessionPlayer.seasonPlayerId,
			queuePosition: sessionPlayer.queuePosition,
			gamesPlayed: sessionPlayer.gamesPlayedThisSession,
			status: sessionPlayer.status,
		})
		.from(sessionPlayer)
		.where(eq(sessionPlayer.sessionId, args.sessionId))
		.orderBy(sessionPlayer.queuePosition);

	const seasonPlayerIds = queue.map((q) => q.seasonPlayerId);
	if (currentMatch) {
		const homeIds = currentMatch.homePlayerIds.split(",");
		const awayIds = currentMatch.awayPlayerIds.split(",");
		seasonPlayerIds.push(...homeIds, ...awayIds);
	}

	const names = await db
		.select({
			seasonPlayerId: seasonPlayer.id,
			userName: user.name,
			guestName: guest.displayName,
		})
		.from(seasonPlayer)
		.innerJoin(player, eq(player.id, seasonPlayer.playerId))
		.leftJoin(user, eq(user.id, player.userId))
		.leftJoin(guest, eq(guest.id, player.guestId))
		.where(inArray(seasonPlayer.id, [...new Set(seasonPlayerIds)]));

	const nameMap = new Map(
		names.map((n) => [n.seasonPlayerId, n.userName ?? n.guestName ?? "Unknown"])
	);

	return {
		sessionId: session.id,
		rotationMode: session.rotationMode,
		currentMatch: currentMatch
			? {
					matchNumber: currentMatch.matchNumber,
					homePlayers: currentMatch.homePlayerIds
						.split(",")
						.map((id) => nameMap.get(id) ?? "Unknown"),
					awayPlayers: currentMatch.awayPlayerIds
						.split(",")
						.map((id) => nameMap.get(id) ?? "Unknown"),
					homeSessionScore: currentMatch.homeSessionScore,
					awaySessionScore: currentMatch.awaySessionScore,
					result: currentMatch.result,
				}
			: null,
		waitingQueue: queue
			.filter((q) => q.status === "waiting")
			.map((q) => ({
				name: nameMap.get(q.seasonPlayerId) ?? "Unknown",
				queuePosition: q.queuePosition,
				gamesPlayed: q.gamesPlayed,
			})),
	};
}
