import { and, count, desc, eq, or, sql } from "drizzle-orm";
import type { DrizzleDB } from "../db";
import { user } from "../db/schema/auth-schema";
import {
	match,
	matchTeam,
	matchPlayer,
	season,
	seasonTeam,
	seasonPlayer,
	leagueTeam,
	leagueTeamPlayer,
	player,
} from "../db/schema/league-schema";

export const getAll = async ({ db, organizationId }: { db: DrizzleDB; organizationId: string }) => {
	return db.select().from(leagueTeam).where(eq(leagueTeam.leagueId, organizationId));
};

export const getById = async ({
	db,
	teamId,
	organizationId,
}: {
	db: DrizzleDB;
	teamId: string;
	organizationId: string;
}) => {
	const [t] = await db
		.select()
		.from(leagueTeam)
		.where(and(eq(leagueTeam.id, teamId), eq(leagueTeam.leagueId, organizationId)))
		.limit(1);
	return t;
};

export const getTeamPlayers = async ({ db, teamId }: { db: DrizzleDB; teamId: string }) => {
	return db
		.select({
			id: player.id,
			userId: player.userId,
		})
		.from(leagueTeamPlayer)
		.innerJoin(player, eq(leagueTeamPlayer.playerId, player.id))
		.where(eq(leagueTeamPlayer.leagueTeamId, teamId));
};

export const addPlayerToTeam = async ({
	db,
	teamId,
	playerId,
}: {
	db: DrizzleDB;
	teamId: string;
	playerId: string;
}) => {
	const now = new Date();
	await db.insert(leagueTeamPlayer).values({
		id: crypto.randomUUID(),
		leagueTeamId: teamId,
		playerId,
		createdAt: now,
		updatedAt: now,
	});
};

export const removePlayerFromTeam = async ({
	db,
	teamId,
	playerId,
}: {
	db: DrizzleDB;
	teamId: string;
	playerId: string;
}) => {
	await db
		.delete(leagueTeamPlayer)
		.where(and(eq(leagueTeamPlayer.leagueTeamId, teamId), eq(leagueTeamPlayer.playerId, playerId)));
};

export const getTeamPlayersWithDetails = async ({
	db,
	teamId,
}: {
	db: DrizzleDB;
	teamId: string;
}) => {
	return db
		.select({
			id: player.id,
			userId: player.userId,
			name: user.name,
			image: user.image,
		})
		.from(leagueTeamPlayer)
		.innerJoin(player, eq(leagueTeamPlayer.playerId, player.id))
		.innerJoin(user, eq(player.userId, user.id))
		.where(eq(leagueTeamPlayer.leagueTeamId, teamId));
};

export const getAllTimeStats = async ({
	db,
	teamId,
	seasonId,
}: {
	db: DrizzleDB;
	teamId: string;
	seasonId?: string;
}) => {
	const conditions = [eq(seasonTeam.leagueTeamId, teamId)];
	if (seasonId) {
		conditions.push(eq(seasonTeam.seasonId, seasonId));
	}

	const stats = await db
		.select({
			total: sql<number>`count(*)`,
			wins: sql<number>`sum(case when ${matchTeam.result} = 'W' then 1 else 0 end)`,
			losses: sql<number>`sum(case when ${matchTeam.result} = 'L' then 1 else 0 end)`,
			draws: sql<number>`sum(case when ${matchTeam.result} = 'D' then 1 else 0 end)`,
			seasonCount: sql<number>`count(DISTINCT ${seasonTeam.seasonId})`,
		})
		.from(matchTeam)
		.innerJoin(seasonTeam, eq(matchTeam.seasonTeamId, seasonTeam.id))
		.where(and(...conditions));

	return stats[0] || { total: 0, wins: 0, losses: 0, draws: 0, seasonCount: 0 };
};

export const getBestSeason = async ({
	db,
	teamId,
	seasonId,
}: {
	db: DrizzleDB;
	teamId: string;
	seasonId?: string;
}) => {
	const conditions = [eq(seasonTeam.leagueTeamId, teamId)];
	if (seasonId) {
		conditions.push(eq(seasonTeam.seasonId, seasonId));
	}

	const [best] = await db
		.select({
			seasonName: season.name,
			seasonSlug: season.slug,
			startDate: season.startDate,
			endDate: season.endDate,
			finalScore: seasonTeam.score,
			matchCount: count(matchTeam.id),
		})
		.from(seasonTeam)
		.innerJoin(season, eq(seasonTeam.seasonId, season.id))
		.leftJoin(matchTeam, eq(matchTeam.seasonTeamId, seasonTeam.id))
		.where(and(...conditions))
		.groupBy(seasonTeam.id, season.id)
		.orderBy(seasonId ? desc(season.startDate) : desc(seasonTeam.score))
		.limit(1);

	if (!best) {
		return null;
	}

	return {
		season: best.seasonName,
		slug: best.seasonSlug,
		score: best.finalScore,
		matches: best.matchCount,
		startDate: best.startDate,
		endDate: best.endDate,
	};
};

export const getSeasonHistory = async ({ db, teamId }: { db: DrizzleDB; teamId: string }) => {
	const history = await db
		.select({
			seasonName: season.name,
			seasonSlug: season.slug,
			finalScore: seasonTeam.score,
			matchCount: count(matchTeam.id),
			wins: sql<number>`sum(case when ${matchTeam.result} = 'W' then 1 else 0 end)`,
			losses: sql<number>`sum(case when ${matchTeam.result} = 'L' then 1 else 0 end)`,
			draws: sql<number>`sum(case when ${matchTeam.result} = 'D' then 1 else 0 end)`,
			startDate: season.startDate,
			endDate: season.endDate,
		})
		.from(seasonTeam)
		.innerJoin(season, eq(seasonTeam.seasonId, season.id))
		.leftJoin(matchTeam, eq(matchTeam.seasonTeamId, seasonTeam.id))
		.where(eq(seasonTeam.leagueTeamId, teamId))
		.groupBy(seasonTeam.id, season.id)
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

export const getRecentMatches = async ({
	db,
	teamId,
	limit,
	seasonId,
}: {
	db: DrizzleDB;
	teamId: string;
	limit: number;
	seasonId?: string;
}) => {
	const conditions = [eq(seasonTeam.leagueTeamId, teamId)];
	if (seasonId) {
		conditions.push(eq(seasonTeam.seasonId, seasonId));
	}

	// First, get the match IDs for our team's recent matches, ordered by match.createdAt
	const ourMatchIds = await db
		.select({
			matchId: matchTeam.matchId,
			createdAt: match.createdAt,
		})
		.from(matchTeam)
		.innerJoin(seasonTeam, eq(matchTeam.seasonTeamId, seasonTeam.id))
		.innerJoin(match, eq(matchTeam.matchId, match.id))
		.where(and(...conditions))
		.orderBy(desc(match.createdAt))
		.limit(limit);

	if (ourMatchIds.length === 0) {
		return [];
	}

	const matchIdList = ourMatchIds.map((m) => m.matchId);

	// Get match data with team names. We need to determine which team is home/away
	// by joining through match_player which has the home_team flag
	const matchData = await db
		.selectDistinct({
			matchId: matchTeam.matchId,
			result: matchTeam.result,
			scoreBefore: matchTeam.scoreBefore,
			scoreAfter: matchTeam.scoreAfter,
			matchCreatedAt: match.createdAt,
			homeScore: match.homeScore,
			awayScore: match.awayScore,
			seasonTeamId: seasonTeam.id,
			teamName: leagueTeam.name,
			isOurTeam: eq(seasonTeam.leagueTeamId, teamId),
		})
		.from(matchTeam)
		.innerJoin(seasonTeam, eq(matchTeam.seasonTeamId, seasonTeam.id))
		.innerJoin(match, eq(matchTeam.matchId, match.id))
		.innerJoin(leagueTeam, eq(seasonTeam.leagueTeamId, leagueTeam.id))
		.where(sql`${matchTeam.matchId} IN ${matchIdList}`)
		.orderBy(desc(match.createdAt));

	// For each match, determine which team is home/away by checking match_player.home_team
	const matchMap = new Map<
		string,
		{
			matchId: string;
			result: string;
			scoreBefore: number;
			scoreAfter: number;
			createdAt: Date;
			homeScore: number | null;
			awayScore: number | null;
			homeTeamName: string;
			awayTeamName: string;
			ourTeamIsHome: boolean;
		}
	>();
	const orderedMatchIds: string[] = [];

	// Group teams by match
	const teamsByMatch = new Map<string, typeof matchData>();
	for (const row of matchData) {
		const teams = teamsByMatch.get(row.matchId) || [];
		teams.push(row);
		teamsByMatch.set(row.matchId, teams);
	}

	// For each match, determine home/away by checking match_player
	for (const [matchId, teams] of teamsByMatch.entries()) {
		if (teams.length !== 2) continue;

		orderedMatchIds.push(matchId);

		// Get one player from each team to determine home/away
		const team1 = teams[0];
		const team2 = teams[1];

		// Query match_player to find which team is home (home_team=1)
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

		const homeSeasonTeamId = homeTeamCheck?.seasonTeamId;
		const team1IsHome = team1.seasonTeamId === homeSeasonTeamId;

		const ourTeam = teams.find((t) => t.isOurTeam);
		const opponentTeam = teams.find((t) => !t.isOurTeam);

		if (!ourTeam || !opponentTeam) continue;

		matchMap.set(matchId, {
			matchId,
			result: ourTeam.result,
			scoreBefore: ourTeam.scoreBefore,
			scoreAfter: ourTeam.scoreAfter,
			createdAt: team1.matchCreatedAt,
			homeScore: team1.homeScore,
			awayScore: team1.awayScore,
			homeTeamName: team1IsHome ? team1.teamName : team2.teamName,
			awayTeamName: team1IsHome ? team2.teamName : team1.teamName,
			ourTeamIsHome: ourTeam.seasonTeamId === homeSeasonTeamId,
		});
	}

	// Return in database order (desc by match.createdAt)
	return orderedMatchIds.map((matchId) => {
		const m = matchMap.get(matchId);
		if (!m) {
			throw new Error(`Match ${matchId} not found in matchMap`);
		}
		return {
			matchId: m.matchId,
			result: m.result,
			scoreBefore: m.scoreBefore,
			scoreAfter: m.scoreAfter,
			createdAt: m.createdAt,
			myTeamName: m.ourTeamIsHome ? m.homeTeamName : m.awayTeamName,
			opponentName: m.ourTeamIsHome ? m.awayTeamName : m.homeTeamName,
			myTeamScore: m.ourTeamIsHome ? m.homeScore : m.awayScore,
			opponentScore: m.ourTeamIsHome ? m.awayScore : m.homeScore,
		};
	});
};

export interface RivalTeam {
	id: string;
	name: string;
	logo: string | null;
	matchesPlayed: number;
	wins: number;
	losses: number;
	winRate: number;
}

export const getRivalTeams = async ({
	db,
	teamId,
	seasonId,
}: {
	db: DrizzleDB;
	teamId: string;
	seasonId?: string;
}): Promise<{ bestRival: RivalTeam | null; worstRival: RivalTeam | null }> => {
	// Use a single, optimized query to get rival statistics
	// This counts matches grouped by opponent team
	const whereClause = seasonId
		? sql`our_season_team.league_team_id = ${teamId} AND our_season_team.season_id = ${seasonId}`
		: sql`our_season_team.league_team_id = ${teamId}`;

	const rivalStats = await db
		.select({
			opponentTeamId: sql<string>`opponent_league_team.id`,
			opponentName: sql<string>`opponent_league_team.name`,
			opponentLogo: sql<string>`opponent_league_team.logo`,
			totalMatches: sql<number>`COUNT(*)`,
			wins: sql<number>`SUM(CASE WHEN our_match.result = 'W' THEN 1 ELSE 0 END)`,
			losses: sql<number>`SUM(CASE WHEN our_match.result = 'L' THEN 1 ELSE 0 END)`,
		})
		.from(sql`match_team our_match`)
		.innerJoin(sql`season_team our_season_team`, sql`our_match.season_team_id = our_season_team.id`)
		.innerJoin(
			sql`match_team opponent_match`,
			sql`our_match.match_id = opponent_match.match_id AND our_match.season_team_id != opponent_match.season_team_id`
		)
		.innerJoin(
			sql`season_team opponent_season_team`,
			sql`opponent_match.season_team_id = opponent_season_team.id`
		)
		.innerJoin(
			sql`league_team opponent_league_team`,
			sql`opponent_season_team.league_team_id = opponent_league_team.id`
		)
		.where(whereClause)
		.groupBy(sql`opponent_league_team.id, opponent_league_team.name, opponent_league_team.logo`)
		.having(sql`COUNT(*) >= 2`) // Only teams with 2+ matches
		.orderBy(sql`COUNT(*) DESC`) // Order by most matches first
		.limit(20); // Limit to top 20 to prevent excessive processing

	if (rivalStats.length === 0) {
		return { bestRival: null, worstRival: null };
	}

	// Convert to RivalTeam objects and calculate win rates
	const rivals: RivalTeam[] = rivalStats.map((stat) => {
		const wins = Number(stat.wins) || 0;
		const losses = Number(stat.losses) || 0;
		const totalMatches = Number(stat.totalMatches) || 0;

		return {
			id: stat.opponentTeamId,
			name: stat.opponentName,
			logo: stat.opponentLogo,
			matchesPlayed: totalMatches,
			wins,
			losses,
			winRate: totalMatches > 0 ? Math.round((wins / totalMatches) * 1000) / 10 : 0,
		};
	});

	// Find best and worst rivals
	const bestRival = rivals.reduce((best, current) =>
		current.winRate > best.winRate ? current : best
	);

	const worstRival = rivals.reduce((worst, current) =>
		current.winRate < worst.winRate ? current : worst
	);

	return { bestRival, worstRival };
};
