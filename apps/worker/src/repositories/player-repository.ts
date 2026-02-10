import { and, count, desc, eq, sql } from "drizzle-orm";
import type { DrizzleDB } from "../db";
import { user } from "../db/schema/auth-schema";
import {
	match,
	matchPlayer,
	matchTeam,
	player,
	season,
	seasonPlayer,
	seasonTeam,
	leagueTeam,
} from "../db/schema/league-schema";

export const getAll = async ({ db, leagueId }: { db: DrizzleDB; leagueId: string }) => {
	return db
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
		.where(eq(player.leagueId, leagueId));
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
			leagueId: player.leagueId,
			disabled: player.disabled,
			createdAt: player.createdAt,
			updatedAt: player.updatedAt,
			name: user.name,
			image: user.image,
		})
		.from(player)
		.innerJoin(user, eq(player.userId, user.id))
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
			teammateUserId: sql<string>`teammate_user.id`,
			teammateName: sql<string>`teammate_user.name`,
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
		.innerJoin(sql`user teammate_user`, sql`teammate_p.user_id = teammate_user.id`)
		.where(eq(seasonPlayer.playerId, playerId))
		.groupBy(sql`teammate_user.id`, sql`teammate_user.name`, sql`teammate_user.image`)
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

	// For each match, get the team names
	const matchesWithTeams = await Promise.all(
		matches.map(async (m) => {
			const teams = await db
				.select({
					teamName: leagueTeam.name,
					result: matchTeam.result,
				})
				.from(matchTeam)
				.innerJoin(seasonTeam, eq(matchTeam.seasonTeamId, seasonTeam.id))
				.innerJoin(leagueTeam, eq(seasonTeam.leagueTeamId, leagueTeam.id))
				.where(eq(matchTeam.matchId, m.matchId));

			// Determine which team won and lost
			const winningTeam = teams.find((t) => t.result === "W");
			const losingTeam = teams.find((t) => t.result === "L");

			return {
				...m,
				homeTeamName: winningTeam?.teamName ?? teams[0]?.teamName ?? "Team A",
				awayTeamName: losingTeam?.teamName ?? teams[1]?.teamName ?? "Team B",
				homeScore: m.homeScore,
				awayScore: m.awayScore,
			};
		})
	);

	return matchesWithTeams;
};
