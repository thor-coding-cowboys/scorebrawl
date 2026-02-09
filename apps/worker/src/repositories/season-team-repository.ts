import { and, desc, eq, sql } from "drizzle-orm";
import type { DrizzleDB } from "../db";
import {
	seasonTeam,
	matchTeam,
	leagueTeam,
	leagueTeamPlayer,
	player,
} from "../db/schema/league-schema";
import { user } from "../db/schema/auth-schema";

export const getStanding = async ({ db, seasonId }: { db: DrizzleDB; seasonId: string }) => {
	const results = await db
		.select({
			id: seasonTeam.id,
			seasonId: seasonTeam.seasonId,
			leagueTeamId: seasonTeam.leagueTeamId,
			score: seasonTeam.score,
			name: leagueTeam.name,
			logo: leagueTeam.logo,
			matchCount: sql<number>`(
				select count(*) from ${matchTeam}
				where ${matchTeam.seasonTeamId} = ${seasonTeam.id}
			)`,
			winCount: sql<number>`(
				select count(*) from ${matchTeam} 
				where ${matchTeam.seasonTeamId} = ${seasonTeam.id} 
				and ${matchTeam.result} = 'W'
			)`,
			lossCount: sql<number>`(
				select count(*) from ${matchTeam} 
				where ${matchTeam.seasonTeamId} = ${seasonTeam.id} 
				and ${matchTeam.result} = 'L'
			)`,
			drawCount: sql<number>`(
				select count(*) from ${matchTeam} 
				where ${matchTeam.seasonTeamId} = ${seasonTeam.id} 
				and ${matchTeam.result} = 'D'
			)`,
		})
		.from(seasonTeam)
		.innerJoin(leagueTeam, eq(seasonTeam.leagueTeamId, leagueTeam.id))
		.where(eq(seasonTeam.seasonId, seasonId))
		.orderBy(desc(seasonTeam.score));

	// Calculate point differences for today's matches
	const pointDiff: { seasonTeamId: string; pointDiff: number }[] = [];

	try {
		const todayMatches = await db
			.select({
				seasonTeamId: matchTeam.seasonTeamId,
				scoreAfter: matchTeam.scoreAfter,
				scoreBefore: matchTeam.scoreBefore,
				createdAt: matchTeam.createdAt,
			})
			.from(matchTeam)
			.innerJoin(seasonTeam, eq(matchTeam.seasonTeamId, seasonTeam.id))
			.where(
				and(
					eq(seasonTeam.seasonId, seasonId),
					sql`strftime('%Y-%m-%d', datetime(${matchTeam.createdAt}, 'unixepoch')) = strftime('%Y-%m-%d', 'now', 'localtime')`
				)
			);

		const pointDiffMap = new Map<string, number>();
		for (const match of todayMatches) {
			const currentDiff = pointDiffMap.get(match.seasonTeamId) || 0;
			const matchDiff = match.scoreAfter - match.scoreBefore;
			pointDiffMap.set(match.seasonTeamId, currentDiff + matchDiff);
		}

		for (const [seasonTeamId, diff] of pointDiffMap) {
			pointDiff.push({ seasonTeamId, pointDiff: diff });
		}
	} catch (error) {
		console.error("Error calculating team point diff:", error);
	}

	// Get recent match form (last 5 results)
	const recentForms = await db
		.select({
			seasonTeamId: matchTeam.seasonTeamId,
			result: matchTeam.result,
			createdAt: matchTeam.createdAt,
		})
		.from(matchTeam)
		.innerJoin(seasonTeam, eq(matchTeam.seasonTeamId, seasonTeam.id))
		.where(eq(seasonTeam.seasonId, seasonId))
		.orderBy(desc(matchTeam.createdAt));

	const formMap = recentForms.reduce(
		(acc, match) => {
			if (!acc[match.seasonTeamId]) {
				acc[match.seasonTeamId] = [];
			}
			if (acc[match.seasonTeamId].length < 5) {
				acc[match.seasonTeamId].push(match.result as "W" | "D" | "L");
			}
			return acc;
		},
		{} as Record<string, ("W" | "D" | "L")[]>
	);

	// Get players for each team
	const teamPlayers = await db
		.select({
			leagueTeamId: leagueTeamPlayer.leagueTeamId,
			playerId: player.id,
			playerName: user.name,
			playerImage: user.image,
		})
		.from(leagueTeamPlayer)
		.innerJoin(player, eq(leagueTeamPlayer.playerId, player.id))
		.innerJoin(user, eq(player.userId, user.id))
		.where(
			sql`${leagueTeamPlayer.leagueTeamId} in (${sql.join(
				results.map((r) => sql`${r.leagueTeamId}`),
				sql`, `
			)})`
		);

	const playersMap = teamPlayers.reduce(
		(acc, tp) => {
			if (!acc[tp.leagueTeamId]) {
				acc[tp.leagueTeamId] = [];
			}
			acc[tp.leagueTeamId].push({
				id: tp.playerId,
				name: tp.playerName,
				image: tp.playerImage,
			});
			return acc;
		},
		{} as Record<
			string,
			{
				id: string;
				name: string;
				image: string | null;
			}[]
		>
	);

	return results.map((r, index) => ({
		...r,
		rank: index + 1,
		pointDiff: pointDiff.find((pd) => pd.seasonTeamId === r.id)?.pointDiff ?? 0,
		form: formMap[r.id] || [],
		players: playersMap[r.leagueTeamId] || [],
	}));
};
