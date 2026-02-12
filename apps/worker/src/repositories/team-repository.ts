import { and, count, desc, eq, ne, sql } from "drizzle-orm";
import type { DrizzleDB } from "../db";
import { user } from "../db/schema/auth-schema";
import {
	match,
	matchTeam,
	season,
	seasonTeam,
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
			name: user.name,
			image: user.image,
		})
		.from(leagueTeamPlayer)
		.innerJoin(player, eq(leagueTeamPlayer.playerId, player.id))
		.innerJoin(user, eq(player.userId, user.id))
		.where(eq(leagueTeamPlayer.leagueTeamId, teamId));
};

export const getAllTimeStats = async ({ db, teamId }: { db: DrizzleDB; teamId: string }) => {
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
		.where(eq(seasonTeam.leagueTeamId, teamId));

	return stats[0] || { total: 0, wins: 0, losses: 0, draws: 0, seasonCount: 0 };
};

export const getBestSeason = async ({ db, teamId }: { db: DrizzleDB; teamId: string }) => {
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
		.where(eq(seasonTeam.leagueTeamId, teamId))
		.groupBy(seasonTeam.id, season.id)
		.orderBy(desc(seasonTeam.score))
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
}: {
	db: DrizzleDB;
	teamId: string;
	limit: number;
}) => {
	// First, get the match IDs for our team's recent matches
	const ourMatchIds = await db
		.select({
			matchId: matchTeam.matchId,
		})
		.from(matchTeam)
		.innerJoin(seasonTeam, eq(matchTeam.seasonTeamId, seasonTeam.id))
		.where(eq(seasonTeam.leagueTeamId, teamId))
		.orderBy(desc(matchTeam.createdAt))
		.limit(limit);

	if (ourMatchIds.length === 0) {
		return [];
	}

	const matchIdList = ourMatchIds.map((m) => m.matchId);

	// Single query to get all match data for these matches with team names
	const matchData = await db
		.select({
			matchId: matchTeam.matchId,
			result: matchTeam.result,
			scoreBefore: matchTeam.scoreBefore,
			scoreAfter: matchTeam.scoreAfter,
			createdAt: matchTeam.createdAt,
			homeScore: match.homeScore,
			awayScore: match.awayScore,
			isOurTeam: eq(seasonTeam.leagueTeamId, teamId),
			teamName: leagueTeam.name,
		})
		.from(matchTeam)
		.innerJoin(seasonTeam, eq(matchTeam.seasonTeamId, seasonTeam.id))
		.innerJoin(match, eq(matchTeam.matchId, match.id))
		.innerJoin(leagueTeam, eq(seasonTeam.leagueTeamId, leagueTeam.id))
		.where(sql`${matchTeam.matchId} IN ${matchIdList}`)
		.orderBy(desc(matchTeam.createdAt));

	// Group by matchId to get our team and opponent in one row
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
			myTeamName: string;
			opponentName: string;
		}
	>();

	for (const row of matchData) {
		const existing = matchMap.get(row.matchId);
		if (existing) {
			// Second team for this match
			if (row.isOurTeam) {
				existing.myTeamName = row.teamName;
			} else {
				existing.opponentName = row.teamName;
			}
		} else {
			// First team for this match
			matchMap.set(row.matchId, {
				matchId: row.matchId,
				result: row.result,
				scoreBefore: row.scoreBefore,
				scoreAfter: row.scoreAfter,
				createdAt: row.createdAt,
				homeScore: row.homeScore,
				awayScore: row.awayScore,
				myTeamName: row.isOurTeam ? row.teamName : "",
				opponentName: row.isOurTeam ? "" : row.teamName,
			});
		}
	}

	return Array.from(matchMap.values()).map((m) => ({
		matchId: m.matchId,
		result: m.result,
		scoreBefore: m.scoreBefore,
		scoreAfter: m.scoreAfter,
		createdAt: m.createdAt,
		myTeamName: m.myTeamName || "Your Team",
		opponentName: m.opponentName || "Opponent",
		myTeamScore: m.homeScore,
		opponentScore: m.awayScore,
	}));
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
}: {
	db: DrizzleDB;
	teamId: string;
}): Promise<{ bestRival: RivalTeam | null; worstRival: RivalTeam | null }> => {
	// Single query to get all match results with opponent details using self-join
	const rivalMatchData = await db
		.select({
			ourResult: matchTeam.result,
			opponentTeamId: seasonTeam.leagueTeamId,
			opponentName: leagueTeam.name,
			opponentLogo: leagueTeam.logo,
		})
		.from(matchTeam)
		.innerJoin(seasonTeam, eq(matchTeam.seasonTeamId, seasonTeam.id))
		.innerJoin(leagueTeam, eq(seasonTeam.leagueTeamId, leagueTeam.id))
		.innerJoin(
			// Self-join to find our team's entries in the same matches
			sql`${matchTeam} as our_team`,
			sql`our_team.${matchTeam.matchId.name} = ${matchTeam.matchId} AND our_team.${matchTeam.seasonTeamId.name} != ${matchTeam.seasonTeamId}`
		)
		.innerJoin(
			sql`${seasonTeam} as our_season_team`,
			sql`our_season_team.${seasonTeam.id.name} = our_team.${matchTeam.seasonTeamId.name} AND our_season_team.${seasonTeam.leagueTeamId.name} = ${teamId}`
		)
		.where(ne(seasonTeam.leagueTeamId, teamId));

	if (rivalMatchData.length === 0) {
		return { bestRival: null, worstRival: null };
	}

	// Aggregate stats per opponent
	const rivalMap = new Map<string, RivalTeam>();

	for (const match of rivalMatchData) {
		const existing = rivalMap.get(match.opponentTeamId);
		const isWin = match.ourResult === "W";
		const isLoss = match.ourResult === "L";

		if (existing) {
			existing.matchesPlayed++;
			if (isWin) existing.wins++;
			if (isLoss) existing.losses++;
		} else {
			rivalMap.set(match.opponentTeamId, {
				id: match.opponentTeamId,
				name: match.opponentName,
				logo: match.opponentLogo,
				matchesPlayed: 1,
				wins: isWin ? 1 : 0,
				losses: isLoss ? 1 : 0,
				winRate: 0,
			});
		}
	}

	// Calculate win rates and filter to rivals with at least 10 matches
	const rivals: RivalTeam[] = Array.from(rivalMap.values())
		.filter((r) => r.matchesPlayed >= 10)
		.map((r) => ({
			...r,
			winRate: Math.round((r.wins / r.matchesPlayed) * 1000) / 10,
		}));

	if (rivals.length === 0) {
		return { bestRival: null, worstRival: null };
	}

	const bestRival = rivals.reduce((best, current) =>
		current.winRate > best.winRate ? current : best
	);

	const worstRival = rivals.reduce((worst, current) =>
		current.winRate < worst.winRate ? current : worst
	);

	return { bestRival, worstRival };
};
