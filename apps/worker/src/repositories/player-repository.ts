import { and, count, desc, eq, or, sql } from "drizzle-orm";
import type { DrizzleDB } from "../db";
import { user } from "../db/schema/auth-schema";
import {
	guest,
	leagueTeam,
	match,
	matchPlayer,
	matchTeam,
	player,
	season,
	seasonPlayer,
	seasonTeam,
} from "../db/schema/league-schema";

export const getAll = async ({ db, leagueId }: { db: DrizzleDB; leagueId: string }) => {
	return db
		.select({
			id: player.id,
			userId: player.userId,
			guestId: player.guestId,
			leagueId: player.leagueId,
			disabled: player.disabled,
			createdAt: player.createdAt,
			updatedAt: player.updatedAt,
			name: sql<string>`COALESCE(${user.name}, ${guest.displayName})`.as("name"),
			image: user.image,
			isGuest: sql<boolean>`${player.guestId} IS NOT NULL`.as("is_guest"),
			email: sql<string | null>`COALESCE(${user.email}, ${guest.email})`.as("email"),
		})
		.from(player)
		.leftJoin(user, eq(player.userId, user.id))
		.leftJoin(guest, eq(player.guestId, guest.id))
		.where(eq(player.leagueId, leagueId));
};

export const getByUserId = async ({
	db,
	userId,
	leagueId,
}: {
	db: DrizzleDB;
	userId: string;
	leagueId: string;
}) => {
	const [p] = await db
		.select({
			id: player.id,
			userId: player.userId,
			leagueId: player.leagueId,
			disabled: player.disabled,
			createdAt: player.createdAt,
			updatedAt: player.updatedAt,
			name: user.name,
			image: user.image,
		})
		.from(player)
		.innerJoin(user, eq(player.userId, user.id))
		.where(and(eq(player.userId, userId), eq(player.leagueId, leagueId)))
		.limit(1);
	return p ?? null;
};

export const getById = async ({
	db,
	playerId,
	leagueId,
}: {
	db: DrizzleDB;
	playerId: string;
	leagueId: string;
}) => {
	const [p] = await db
		.select({
			id: player.id,
			userId: player.userId,
			guestId: player.guestId,
			leagueId: player.leagueId,
			disabled: player.disabled,
			createdAt: player.createdAt,
			updatedAt: player.updatedAt,
			name: sql<string>`COALESCE(${user.name}, ${guest.displayName})`.as("name"),
			image: user.image,
			isGuest: sql<boolean>`${player.guestId} IS NOT NULL`.as("is_guest"),
		})
		.from(player)
		.leftJoin(user, eq(player.userId, user.id))
		.leftJoin(guest, eq(player.guestId, guest.id))
		.where(and(eq(player.id, playerId), eq(player.leagueId, leagueId)))
		.limit(1);
	return p;
};

export const setDisabled = async ({
	db,
	playerId,
	leagueId,
	disabled,
}: {
	db: DrizzleDB;
	playerId: string;
	leagueId: string;
	disabled: boolean;
}) => {
	const [updated] = await db
		.update(player)
		.set({ disabled, updatedAt: new Date() })
		.where(and(eq(player.id, playerId), eq(player.leagueId, leagueId)))
		.returning({ id: player.id });
	return updated;
};

export const getPlayerEloProgression = async ({
	db,
	seasonPlayerId,
}: {
	db: DrizzleDB;
	seasonPlayerId: string;
}) => {
	return db
		.select({
			scoreBefore: matchPlayer.scoreBefore,
			scoreAfter: matchPlayer.scoreAfter,
			createdAt: matchPlayer.createdAt,
		})
		.from(matchPlayer)
		.where(eq(matchPlayer.seasonPlayerId, seasonPlayerId))
		.orderBy(desc(matchPlayer.createdAt));
};

export const getRecentMatches = async ({
	db,
	seasonPlayerId,
	limit,
}: {
	db: DrizzleDB;
	seasonPlayerId: string;
	limit: number;
}) => {
	return db
		.select({
			id: matchPlayer.id,
			matchId: matchPlayer.matchId,
			homeTeam: matchPlayer.homeTeam,
			scoreBefore: matchPlayer.scoreBefore,
			scoreAfter: matchPlayer.scoreAfter,
			result: matchPlayer.result,
			createdAt: matchPlayer.createdAt,
		})
		.from(matchPlayer)
		.where(eq(matchPlayer.seasonPlayerId, seasonPlayerId))
		.orderBy(desc(matchPlayer.createdAt))
		.limit(limit);
};

export const getPlayerStats = async ({
	db,
	seasonPlayerId,
}: {
	db: DrizzleDB;
	seasonPlayerId: string;
}) => {
	const stats = await db
		.select({
			total: sql<number>`count(*)`,
			wins: sql<number>`sum(case when ${matchPlayer.result} = 'W' then 1 else 0 end)`,
			losses: sql<number>`sum(case when ${matchPlayer.result} = 'L' then 1 else 0 end)`,
			draws: sql<number>`sum(case when ${matchPlayer.result} = 'D' then 1 else 0 end)`,
		})
		.from(matchPlayer)
		.where(eq(matchPlayer.seasonPlayerId, seasonPlayerId));

	return stats[0] || { total: 0, wins: 0, losses: 0, draws: 0 };
};

export const getBestSeason = async ({ db, playerId }: { db: DrizzleDB; playerId: string }) => {
	const [best] = await db
		.select({
			seasonName: season.name,
			seasonSlug: season.slug,
			startDate: season.startDate,
			endDate: season.endDate,
			finalScore: seasonPlayer.score,
			initialScore: season.initialScore,
			matchCount: count(matchPlayer.id),
		})
		.from(seasonPlayer)
		.innerJoin(season, eq(seasonPlayer.seasonId, season.id))
		.innerJoin(player, eq(seasonPlayer.playerId, player.id))
		.leftJoin(matchPlayer, eq(matchPlayer.seasonPlayerId, seasonPlayer.id))
		.where(eq(seasonPlayer.playerId, playerId))
		.groupBy(seasonPlayer.id, season.id)
		.orderBy(desc(seasonPlayer.score))
		.limit(1);

	if (!best) {
		return null;
	}

	return {
		season: best.seasonName,
		slug: best.seasonSlug,
		elo: best.finalScore,
		matches: best.matchCount,
		startDate: best.startDate,
		endDate: best.endDate,
	};
};

export interface TeammateStats {
	name: string;
	avatar: string | null;
	matchesTogether: number;
	wins: number;
	losses: number;
	winRate: number;
	eloGained: number;
	eloLost: number;
}

export const getTeammateAnalysis = async ({
	db,
	playerId,
}: {
	db: DrizzleDB;
	playerId: string;
}): Promise<{ bestTeammate: TeammateStats | null; worstTeammate: TeammateStats | null }> => {
	// Get matches where this player played with teammates
	const teammateStats = await db
		.select({
			teammatePlayerId: sql<string>`teammate_p.id`,
			teammateName: sql<string>`COALESCE(teammate_user.name, teammate_guest.display_name)`,
			teammateImage: sql<string | null>`teammate_user.image`,
			matchesPlayed: count(sql`DISTINCT ${match.id}`),
			wins: sql<number>`sum(case when ${matchPlayer.result} = 'W' then 1 else 0 end)`,
			losses: sql<number>`sum(case when ${matchPlayer.result} = 'L' then 1 else 0 end)`,
			eloGained: sql<number>`sum(${matchPlayer.scoreAfter} - ${matchPlayer.scoreBefore})`,
		})
		.from(matchPlayer)
		.innerJoin(seasonPlayer, eq(matchPlayer.seasonPlayerId, seasonPlayer.id))
		.innerJoin(match, eq(matchPlayer.matchId, match.id))
		.innerJoin(
			sql`match_player teammate_mp`,
			sql`teammate_mp.match_id = ${match.id} 
				AND teammate_mp.home_team = ${matchPlayer.homeTeam} 
				AND teammate_mp.season_player_id != ${seasonPlayer.id}`
		)
		.innerJoin(sql`season_player teammate_sp`, sql`teammate_mp.season_player_id = teammate_sp.id`)
		.innerJoin(sql`player teammate_p`, sql`teammate_sp.player_id = teammate_p.id`)
		.leftJoin(sql`user teammate_user`, sql`teammate_p.user_id = teammate_user.id`)
		.leftJoin(sql`guest teammate_guest`, sql`teammate_p.guest_id = teammate_guest.id`)
		.where(eq(seasonPlayer.playerId, playerId))
		.groupBy(
			sql`teammate_p.id`,
			sql`COALESCE(teammate_user.name, teammate_guest.display_name)`,
			sql`teammate_user.image`
		)
		.having(sql`COUNT(DISTINCT ${match.id}) >= 3`)
		.orderBy(desc(sql`COUNT(DISTINCT ${match.id})`));

	const teammates: TeammateStats[] = teammateStats.map((teammate) => {
		const matches = teammate.matchesPlayed || 0;
		const wins = Number(teammate.wins) || 0;
		const losses = Number(teammate.losses) || 0;
		const winRate = matches > 0 ? (wins / matches) * 100 : 0;
		const eloGained = Number(teammate.eloGained) || 0;

		return {
			name: teammate.teammateName,
			avatar: teammate.teammateImage,
			matchesTogether: matches,
			wins,
			losses,
			winRate: Math.round(winRate * 10) / 10,
			eloGained,
			eloLost: eloGained < 0 ? Math.abs(eloGained) : 0,
		};
	});

	const bestTeammate =
		teammates.length > 0
			? teammates.reduce((best, current) => (current.winRate > best.winRate ? current : best))
			: null;

	const worstTeammate =
		teammates.length > 0
			? teammates.reduce((worst, current) => (current.winRate < worst.winRate ? current : worst))
			: null;

	return {
		bestTeammate,
		worstTeammate,
	};
};

export const getAllTimeStats = async ({ db, playerId }: { db: DrizzleDB; playerId: string }) => {
	const stats = await db
		.select({
			total: sql<number>`count(*)`,
			wins: sql<number>`sum(case when ${matchPlayer.result} = 'W' then 1 else 0 end)`,
			losses: sql<number>`sum(case when ${matchPlayer.result} = 'L' then 1 else 0 end)`,
			draws: sql<number>`sum(case when ${matchPlayer.result} = 'D' then 1 else 0 end)`,
			seasonCount: sql<number>`count(DISTINCT ${seasonPlayer.seasonId})`,
		})
		.from(matchPlayer)
		.innerJoin(seasonPlayer, eq(matchPlayer.seasonPlayerId, seasonPlayer.id))
		.where(eq(seasonPlayer.playerId, playerId));

	return stats[0] || { total: 0, wins: 0, losses: 0, draws: 0, seasonCount: 0 };
};

export const getRecentMatchesWithTeams = async ({
	db,
	seasonPlayerId,
	limit,
}: {
	db: DrizzleDB;
	seasonPlayerId: string;
	limit: number;
}) => {
	// Get matches with team names
	const matches = await db
		.select({
			id: matchPlayer.id,
			matchId: matchPlayer.matchId,
			homeTeam: matchPlayer.homeTeam,
			scoreBefore: matchPlayer.scoreBefore,
			scoreAfter: matchPlayer.scoreAfter,
			result: matchPlayer.result,
			createdAt: matchPlayer.createdAt,
			homeScore: match.homeScore,
			awayScore: match.awayScore,
		})
		.from(matchPlayer)
		.innerJoin(match, eq(matchPlayer.matchId, match.id))
		.where(eq(matchPlayer.seasonPlayerId, seasonPlayerId))
		.orderBy(desc(matchPlayer.createdAt))
		.limit(limit);

	if (matches.length === 0) {
		return [];
	}

	// Batch fetch all teams for these matches in one query
	const matchIds = matches.map((m) => m.matchId);
	const teamRows = await db
		.select({
			matchId: matchTeam.matchId,
			teamName: leagueTeam.name,
			result: matchTeam.result,
			seasonTeamId: seasonTeam.id,
		})
		.from(matchTeam)
		.innerJoin(seasonTeam, eq(matchTeam.seasonTeamId, seasonTeam.id))
		.innerJoin(leagueTeam, eq(seasonTeam.leagueTeamId, leagueTeam.id))
		.where(sql`${matchTeam.matchId} IN ${matchIds}`);

	// Group teams by match
	const teamsByMatch = new Map<string, typeof teamRows>();
	for (const row of teamRows) {
		const existing = teamsByMatch.get(row.matchId) || [];
		existing.push(row);
		teamsByMatch.set(row.matchId, existing);
	}

	// Determine which team is home/away for each match by checking match_player.homeTeam
	// Constrain to the two known seasonTeamIds for each match to avoid cross-season contamination
	const homeTeamByMatch = new Map<string, string>(); // matchId -> seasonTeamId of home team

	for (const matchId of matchIds) {
		const teams = teamsByMatch.get(matchId) || [];
		if (teams.length !== 2) continue;

		const [team1, team2] = teams;

		const [homeTeamCheck] = await db
			.select({
				seasonTeamId: seasonTeam.id,
			})
			.from(matchPlayer)
			.innerJoin(seasonPlayer, eq(matchPlayer.seasonPlayerId, seasonPlayer.id))
			.innerJoin(seasonTeam, eq(seasonPlayer.seasonId, seasonTeam.seasonId))
			.where(
				and(
					eq(matchPlayer.matchId, matchId),
					eq(matchPlayer.homeTeam, true),
					or(eq(seasonTeam.id, team1.seasonTeamId), eq(seasonTeam.id, team2.seasonTeamId))
				)
			)
			.limit(1);

		if (homeTeamCheck) {
			homeTeamByMatch.set(matchId, homeTeamCheck.seasonTeamId);
		}
	}

	// Build result without N+1
	return matches.map((m) => {
		const teams = teamsByMatch.get(m.matchId) || [];
		const homeSeasonTeamId = homeTeamByMatch.get(m.matchId);

		// If we know which team is home, use that; otherwise default to first team as home
		const homeTeam = homeSeasonTeamId
			? teams.find((t) => t.seasonTeamId === homeSeasonTeamId)
			: teams[0];
		const awayTeam = homeSeasonTeamId
			? teams.find((t) => t.seasonTeamId !== homeSeasonTeamId)
			: teams[1];

		return {
			...m,
			homeTeamName: homeTeam?.teamName ?? teams[0]?.teamName ?? "Team A",
			awayTeamName: awayTeam?.teamName ?? teams[1]?.teamName ?? "Team B",
			homeScore: m.homeScore,
			awayScore: m.awayScore,
		};
	});
};

export const getSeasonHistory = async ({
	db,
	playerId,
	seasonId,
}: {
	db: DrizzleDB;
	playerId: string;
	seasonId?: string;
}) => {
	const history = await db
		.select({
			seasonName: season.name,
			seasonSlug: season.slug,
			finalScore: seasonPlayer.score,
			matchCount: count(matchPlayer.id),
			wins: sql<number>`sum(case when ${matchPlayer.result} = 'W' then 1 else 0 end)`,
			losses: sql<number>`sum(case when ${matchPlayer.result} = 'L' then 1 else 0 end)`,
			draws: sql<number>`sum(case when ${matchPlayer.result} = 'D' then 1 else 0 end)`,
			startDate: season.startDate,
			endDate: season.endDate,
		})
		.from(seasonPlayer)
		.innerJoin(season, eq(seasonPlayer.seasonId, season.id))
		.leftJoin(matchPlayer, eq(matchPlayer.seasonPlayerId, seasonPlayer.id))
		.where(
			seasonId
				? and(eq(seasonPlayer.playerId, playerId), eq(season.id, seasonId))
				: eq(seasonPlayer.playerId, playerId)
		)
		.groupBy(seasonPlayer.id, season.id)
		.orderBy(desc(season.startDate));

	return history.map((h) => ({
		season: h.seasonName,
		slug: h.seasonSlug,
		score: h.finalScore,
		matches: h.matchCount,
		wins: Number(h.wins) || 0,
		losses: Number(h.losses) || 0,
		draws: Number(h.draws) || 0,
		winRate: h.matchCount > 0 ? Math.round(((Number(h.wins) || 0) / h.matchCount) * 100) : 0,
		startDate: h.startDate,
		endDate: h.endDate,
	}));
};

// Player Comparison Types
export interface PlayerComparisonStats {
	playerId: string;
	name: string;
	avatar: string | null;
	totalMatches: number;
	wins: number;
	losses: number;
	draws: number;
	winRate: number;
	highestElo: number;
	lowestElo: number;
	currentElo: number;
	avgEloChange: number;
	seasonsPlayed: number;
	longestWinStreak: number;
	longestLossStreak: number;
	comebackWins: number; // Wins after 2+ losses
	blowoutWins: number; // Wins with 3+ goal difference
	closeWins: number; // 1-goal wins
	avgPointsPerMatch: number;
	consistencyScore: number; // Lower = more consistent
	peakPerformanceSeason: string | null;
	totalEloGained: number;
	totalEloLost: number;
	netEloChange: number;
}

export interface HeadToHeadStats {
	matchesPlayed: number;
	player1Wins: number;
	player2Wins: number;
	draws: number;
	player1GoalsFor: number;
	player1GoalsAgainst: number;
	player2GoalsFor: number;
	player2GoalsAgainst: number;
	player1EloGained: number;
	player2EloGained: number;
	biggestWin: {
		winnerId: string;
		score: string;
		eloChange: number;
		date: Date;
	} | null;
	longestStreak: {
		playerId: string;
		streak: number;
	};
	recentMatches: Array<{
		matchId: string;
		date: Date;
		player1ScoreBefore: number;
		player1ScoreAfter: number;
		player2ScoreBefore: number;
		player2ScoreAfter: number;
		homeScore: number;
		awayScore: number;
		player1WasHome: boolean;
		result: "W" | "L" | "D";
	}>;
}

export const getPlayerComparisonStats = async ({
	db,
	playerId,
	seasonId,
}: {
	db: DrizzleDB;
	playerId: string;
	seasonId?: string;
}): Promise<PlayerComparisonStats | null> => {
	// Get player basic info
	const [playerInfo] = await db
		.select({
			id: player.id,
			name: sql<string>`COALESCE(${user.name}, ${guest.displayName})`.as("name"),
			image: user.image,
		})
		.from(player)
		.leftJoin(user, eq(player.userId, user.id))
		.leftJoin(guest, eq(player.guestId, guest.id))
		.where(eq(player.id, playerId))
		.limit(1);

	if (!playerInfo) return null;

	// Get all stats in parallel - single query approach
	const stats = await db
		.select({
			totalMatches: sql<number>`count(${matchPlayer.id})`,
			wins: sql<number>`sum(case when ${matchPlayer.result} = 'W' then 1 else 0 end)`,
			losses: sql<number>`sum(case when ${matchPlayer.result} = 'L' then 1 else 0 end)`,
			draws: sql<number>`sum(case when ${matchPlayer.result} = 'D' then 1 else 0 end)`,
			highestElo: sql<number>`max(${matchPlayer.scoreAfter})`,
			lowestElo: sql<number>`min(${matchPlayer.scoreBefore})`,
			currentElo: sql<number>`${seasonPlayer.score}`,
			avgEloChange: sql<number>`avg(${matchPlayer.scoreAfter} - ${matchPlayer.scoreBefore})`,
			seasonsPlayed: sql<number>`count(DISTINCT ${seasonPlayer.seasonId})`,
			totalEloGained: sql<number>`sum(case when ${matchPlayer.scoreAfter} > ${matchPlayer.scoreBefore} then ${matchPlayer.scoreAfter} - ${matchPlayer.scoreBefore} else 0 end)`,
			totalEloLost: sql<number>`sum(case when ${matchPlayer.scoreAfter} < ${matchPlayer.scoreBefore} then ${matchPlayer.scoreBefore} - ${matchPlayer.scoreAfter} else 0 end)`,
		})
		.from(seasonPlayer)
		.leftJoin(matchPlayer, eq(matchPlayer.seasonPlayerId, seasonPlayer.id))
		.where(
			seasonId
				? and(eq(seasonPlayer.playerId, playerId), eq(seasonPlayer.seasonId, seasonId))
				: eq(seasonPlayer.playerId, playerId)
		)
		.groupBy(seasonPlayer.id);

	const s = stats[0];
	if (!s) return null;

	// Get streaks and comeback wins from match history
	const allMatches = await db
		.select({
			result: matchPlayer.result,
			scoreAfter: matchPlayer.scoreAfter,
			scoreBefore: matchPlayer.scoreBefore,
			homeScore: match.homeScore,
			awayScore: match.awayScore,
			homeTeam: matchPlayer.homeTeam,
		})
		.from(matchPlayer)
		.innerJoin(seasonPlayer, eq(matchPlayer.seasonPlayerId, seasonPlayer.id))
		.innerJoin(match, eq(matchPlayer.matchId, match.id))
		.where(
			seasonId
				? and(eq(seasonPlayer.playerId, playerId), eq(seasonPlayer.seasonId, seasonId))
				: eq(seasonPlayer.playerId, playerId)
		)
		.orderBy(match.createdAt);

	// Calculate streaks
	let currentWinStreak = 0;
	let maxWinStreak = 0;
	let currentLossStreak = 0;
	let maxLossStreak = 0;
	let comebackWins = 0;
	let blowoutWins = 0;
	let closeWins = 0;
	let lossCount = 0;

	for (const m of allMatches) {
		if (m.result === "W") {
			currentWinStreak++;
			maxWinStreak = Math.max(maxWinStreak, currentWinStreak);
			currentLossStreak = 0;

			// Check if comeback (2+ previous losses)
			if (lossCount >= 2) {
				comebackWins++;
			}

			// Check goal difference
			const myScore = m.homeTeam ? m.homeScore : m.awayScore;
			const theirScore = m.homeTeam ? m.awayScore : m.homeScore;
			const diff = myScore - theirScore;

			if (diff >= 3) blowoutWins++;
			if (diff === 1) closeWins++;

			lossCount = 0;
		} else if (m.result === "L") {
			currentLossStreak++;
			maxLossStreak = Math.max(maxLossStreak, currentLossStreak);
			currentWinStreak = 0;
			lossCount++;
		} else {
			currentWinStreak = 0;
			currentLossStreak = 0;
		}
	}

	// Calculate consistency (standard deviation of ELO changes)
	const eloChanges = allMatches.map((m) => m.scoreAfter - m.scoreBefore);
	const avgChange = eloChanges.reduce((a, b) => a + b, 0) / (eloChanges.length || 1);
	const variance =
		eloChanges.reduce((sum, val) => sum + (val - avgChange) ** 2, 0) / (eloChanges.length || 1);
	const consistencyScore = Math.round(Math.sqrt(variance));

	// Get peak performance season
	const [peakSeason] = await db
		.select({
			seasonName: season.name,
			winRate: sql<number>`sum(case when ${matchPlayer.result} = 'W' then 1 else 0 end) * 100.0 / nullif(count(${matchPlayer.id}), 0)`,
		})
		.from(seasonPlayer)
		.innerJoin(season, eq(seasonPlayer.seasonId, season.id))
		.leftJoin(matchPlayer, eq(matchPlayer.seasonPlayerId, seasonPlayer.id))
		.where(
			seasonId
				? and(eq(seasonPlayer.playerId, playerId), eq(seasonPlayer.seasonId, seasonId))
				: eq(seasonPlayer.playerId, playerId)
		)
		.groupBy(seasonPlayer.id, season.id)
		.having(sql`count(${matchPlayer.id}) >= 5`)
		.orderBy(
			sql`sum(case when ${matchPlayer.result} = 'W' then 1 else 0 end) * 100.0 / nullif(count(${matchPlayer.id}), 0) DESC`
		)
		.limit(1);

	const totalMatches = s.totalMatches || 0;
	const wins = Number(s.wins) || 0;

	return {
		playerId: playerInfo.id,
		name: playerInfo.name,
		avatar: playerInfo.image,
		totalMatches,
		wins,
		losses: Number(s.losses) || 0,
		draws: Number(s.draws) || 0,
		winRate: totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0,
		highestElo: s.highestElo || 0,
		lowestElo: s.lowestElo || 0,
		currentElo: s.currentElo || 0,
		avgEloChange: Math.round((Number(s.avgEloChange) || 0) * 10) / 10,
		seasonsPlayed: s.seasonsPlayed || 0,
		longestWinStreak: maxWinStreak,
		longestLossStreak: maxLossStreak,
		comebackWins,
		blowoutWins,
		closeWins,
		avgPointsPerMatch: totalMatches > 0 ? Math.round((wins * 3 + s.draws) / totalMatches) : 0,
		consistencyScore,
		peakPerformanceSeason: peakSeason?.seasonName || null,
		totalEloGained: Number(s.totalEloGained) || 0,
		totalEloLost: Number(s.totalEloLost) || 0,
		netEloChange: (Number(s.totalEloGained) || 0) - (Number(s.totalEloLost) || 0),
	};
};

export const getHeadToHeadStats = async ({
	db,
	player1Id,
	player2Id,
	seasonId,
}: {
	db: DrizzleDB;
	player1Id: string;
	player2Id: string;
	seasonId?: string;
}): Promise<HeadToHeadStats> => {
	// Find all matches where both players played on opposite teams
	const h2hMatches = await db
		.select({
			matchId: match.id,
			date: match.createdAt,
			homeScore: match.homeScore,
			awayScore: match.awayScore,
			p1HomeTeam: sql<boolean>`${matchPlayer.homeTeam}`.as("p1_home_team"),
			p1ScoreBefore: matchPlayer.scoreBefore,
			p1ScoreAfter: matchPlayer.scoreAfter,
			p2ScoreBefore: sql<number>`p2_mp.score_before`.as("p2_score_before"),
			p2ScoreAfter: sql<number>`p2_mp.score_after`.as("p2_score_after"),
			p1Result: matchPlayer.result,
			p2Result: sql<string>`p2_mp.result`.as("p2_result"),
		})
		.from(matchPlayer)
		.innerJoin(seasonPlayer, eq(matchPlayer.seasonPlayerId, seasonPlayer.id))
		.innerJoin(match, eq(matchPlayer.matchId, match.id))
		.innerJoin(
			sql`match_player p2_mp`,
			sql`p2_mp.match_id = ${match.id} AND p2_mp.home_team != ${matchPlayer.homeTeam}`
		)
		.innerJoin(
			sql`season_player p2_sp`,
			sql`p2_sp.id = p2_mp.season_player_id AND p2_sp.player_id = ${player2Id}`
		)
		.where(
			seasonId
				? and(eq(seasonPlayer.playerId, player1Id), eq(seasonPlayer.seasonId, seasonId))
				: eq(seasonPlayer.playerId, player1Id)
		)
		.orderBy(desc(match.createdAt));

	if (h2hMatches.length === 0) {
		return {
			matchesPlayed: 0,
			player1Wins: 0,
			player2Wins: 0,
			draws: 0,
			player1GoalsFor: 0,
			player1GoalsAgainst: 0,
			player2GoalsFor: 0,
			player2GoalsAgainst: 0,
			player1EloGained: 0,
			player2EloGained: 0,
			biggestWin: null,
			longestStreak: { playerId: player1Id, streak: 0 },
			recentMatches: [],
		};
	}

	let p1Wins = 0;
	let p2Wins = 0;
	let draws = 0;
	let p1GoalsFor = 0;
	let p1GoalsAgainst = 0;
	let p2GoalsFor = 0;
	let p2GoalsAgainst = 0;
	let p1EloGained = 0;
	let p2EloGained = 0;

	let biggestWin: {
		winnerId: string;
		score: string;
		eloChange: number;
		date: Date;
	} | null = null;

	let currentP1Streak = 0;
	let currentP2Streak = 0;
	let maxP1Streak = 0;
	let maxP2Streak = 0;

	// Process oldest to newest for streaks
	const sortedMatches = [...h2hMatches].reverse();

	for (const m of sortedMatches) {
		const p1WasHome = m.p1HomeTeam;
		const p1Goals = p1WasHome ? m.homeScore : m.awayScore;
		const p2Goals = p1WasHome ? m.awayScore : m.homeScore;
		const p1Change = m.p1ScoreAfter - m.p1ScoreBefore;
		const p2Change = (m.p2ScoreAfter || 0) - (m.p2ScoreBefore || 0);

		p1GoalsFor += p1Goals;
		p1GoalsAgainst += p2Goals;
		p2GoalsFor += p2Goals;
		p2GoalsAgainst += p1Goals;
		p1EloGained += p1Change;
		p2EloGained += p2Change;

		if (m.p1Result === "W") {
			p1Wins++;
			currentP1Streak++;
			maxP1Streak = Math.max(maxP1Streak, currentP1Streak);
			currentP2Streak = 0;

			// Check for biggest win
			const goalDiff = p1Goals - p2Goals;
			if (
				!biggestWin ||
				goalDiff >
					Number.parseInt(biggestWin.score.split("-")[0]) -
						Number.parseInt(biggestWin.score.split("-")[1])
			) {
				biggestWin = {
					winnerId: player1Id,
					score: `${p1Goals}-${p2Goals}`,
					eloChange: p1Change,
					date: m.date,
				};
			}
		} else if (m.p1Result === "L") {
			p2Wins++;
			currentP2Streak++;
			maxP2Streak = Math.max(maxP2Streak, currentP2Streak);
			currentP1Streak = 0;

			// Check for biggest win
			const goalDiff = p2Goals - p1Goals;
			if (
				!biggestWin ||
				goalDiff >
					Number.parseInt(biggestWin.score.split("-")[1]) -
						Number.parseInt(biggestWin.score.split("-")[0])
			) {
				biggestWin = {
					winnerId: player2Id,
					score: `${p2Goals}-${p1Goals}`,
					eloChange: p2Change,
					date: m.date,
				};
			}
		} else {
			draws++;
			currentP1Streak = 0;
			currentP2Streak = 0;
		}
	}

	const longestStreak =
		maxP1Streak >= maxP2Streak
			? { playerId: player1Id, streak: maxP1Streak }
			: { playerId: player2Id, streak: maxP2Streak };

	return {
		matchesPlayed: h2hMatches.length,
		player1Wins: p1Wins,
		player2Wins: p2Wins,
		draws,
		player1GoalsFor: p1GoalsFor,
		player1GoalsAgainst: p1GoalsAgainst,
		player2GoalsFor: p2GoalsFor,
		player2GoalsAgainst: p2GoalsAgainst,
		player1EloGained: p1EloGained,
		player2EloGained: p2EloGained,
		biggestWin,
		longestStreak,
		recentMatches: h2hMatches.slice(0, 10).map((m) => ({
			matchId: m.matchId,
			date: m.date,
			player1ScoreBefore: m.p1ScoreBefore,
			player1ScoreAfter: m.p1ScoreAfter,
			player2ScoreBefore: m.p2ScoreBefore || 0,
			player2ScoreAfter: m.p2ScoreAfter || 0,
			homeScore: m.homeScore,
			awayScore: m.awayScore,
			player1WasHome: m.p1HomeTeam,
			result: m.p1Result as "W" | "L" | "D",
		})),
	};
};
