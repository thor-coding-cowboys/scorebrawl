import { and, desc, eq, sql } from "drizzle-orm";
import type { DrizzleDB } from "../db";
import { user } from "../db/schema/auth-schema";
import { seasonPlayer, matchPlayer, player } from "../db/schema/league-schema";

export const findAll = async ({ db, seasonId }: { db: DrizzleDB; seasonId: string }) => {
	return db
		.select({
			id: seasonPlayer.id,
			seasonId: seasonPlayer.seasonId,
			playerId: seasonPlayer.playerId,
			score: seasonPlayer.score,
			disabled: seasonPlayer.disabled,
			createdAt: seasonPlayer.createdAt,
			updatedAt: seasonPlayer.updatedAt,
			name: user.name,
			image: user.image,
			userId: player.userId,
		})
		.from(seasonPlayer)
		.innerJoin(player, eq(seasonPlayer.playerId, player.id))
		.innerJoin(user, eq(player.userId, user.id))
		.where(eq(seasonPlayer.seasonId, seasonId))
		.orderBy(desc(seasonPlayer.score));
};

export const getStanding = async ({ db, seasonId }: { db: DrizzleDB; seasonId: string }) => {
	// Pre-aggregate match stats in a single query to avoid correlated subqueries
	const matchStats = db
		.select({
			seasonPlayerId: matchPlayer.seasonPlayerId,
			matchCount: sql<number>`count(*)`.as("match_count"),
			winCount: sql<number>`sum(case when ${matchPlayer.result} = 'W' then 1 else 0 end)`.as(
				"win_count"
			),
			lossCount: sql<number>`sum(case when ${matchPlayer.result} = 'L' then 1 else 0 end)`.as(
				"loss_count"
			),
			drawCount: sql<number>`sum(case when ${matchPlayer.result} = 'D' then 1 else 0 end)`.as(
				"draw_count"
			),
		})
		.from(matchPlayer)
		.groupBy(matchPlayer.seasonPlayerId)
		.as("match_stats");

	const results = await db
		.select({
			id: seasonPlayer.id,
			seasonId: seasonPlayer.seasonId,
			playerId: seasonPlayer.playerId,
			score: seasonPlayer.score,
			name: user.name,
			image: user.image,
			userId: player.userId,
			matchCount: sql<number>`coalesce(${matchStats.matchCount}, 0)`,
			winCount: sql<number>`coalesce(${matchStats.winCount}, 0)`,
			lossCount: sql<number>`coalesce(${matchStats.lossCount}, 0)`,
			drawCount: sql<number>`coalesce(${matchStats.drawCount}, 0)`,
		})
		.from(seasonPlayer)
		.innerJoin(player, eq(seasonPlayer.playerId, player.id))
		.innerJoin(user, eq(player.userId, user.id))
		.leftJoin(matchStats, eq(seasonPlayer.id, matchStats.seasonPlayerId))
		.where(eq(seasonPlayer.seasonId, seasonId))
		.orderBy(desc(seasonPlayer.score));

	// Calculate point differences for today's matches (final implementation)
	const pointDiff: { seasonPlayerId: string; pointDiff: number }[] = [];

	try {
		// Get all matches from today using a more robust date comparison
		const todayMatches = await db
			.select({
				seasonPlayerId: matchPlayer.seasonPlayerId,
				scoreAfter: matchPlayer.scoreAfter,
				scoreBefore: matchPlayer.scoreBefore,
				createdAt: matchPlayer.createdAt,
			})
			.from(matchPlayer)
			.innerJoin(seasonPlayer, eq(matchPlayer.seasonPlayerId, seasonPlayer.id))
			.where(
				and(
					eq(seasonPlayer.seasonId, seasonId),
					// Convert Unix timestamp to date string for proper comparison
					sql`strftime('%Y-%m-%d', datetime(${matchPlayer.createdAt}, 'unixepoch')) = strftime('%Y-%m-%d', 'now', 'localtime')`
				)
			);

		// Calculate net point differences for each player today
		const pointDiffMap = new Map<string, number>();
		for (const match of todayMatches) {
			const currentDiff = pointDiffMap.get(match.seasonPlayerId) || 0;
			const matchDiff = match.scoreAfter - match.scoreBefore;
			pointDiffMap.set(match.seasonPlayerId, currentDiff + matchDiff);
		}

		// Convert to array format
		for (const [seasonPlayerId, diff] of pointDiffMap) {
			pointDiff.push({ seasonPlayerId, pointDiff: diff });
		}
	} catch (error) {
		console.error("Error calculating point diff:", error);
		// Continue with empty pointDiff array if there's an error
	}

	// Get recent match form (last 5 results per player) using window function
	const recentForms = await db.all<{ seasonPlayerId: string; result: string }>(sql`
		SELECT season_player_id as seasonPlayerId, result
		FROM (
			SELECT 
				mp.season_player_id,
				mp.result,
				ROW_NUMBER() OVER (PARTITION BY mp.season_player_id ORDER BY mp.created_at DESC) as rn
			FROM match_player mp
			INNER JOIN season_player sp ON mp.season_player_id = sp.id
			WHERE sp.season_id = ${seasonId}
		)
		WHERE rn <= 5
		ORDER BY season_player_id, rn
	`);

	// Group form data by player
	const formMap = recentForms.reduce(
		(acc, match) => {
			if (!acc[match.seasonPlayerId]) {
				acc[match.seasonPlayerId] = [];
			}
			acc[match.seasonPlayerId].push(match.result as "W" | "D" | "L");
			return acc;
		},
		{} as Record<string, ("W" | "D" | "L")[]>
	);

	return results.map((r, index) => ({
		...r,
		rank: index + 1,
		pointDiff: pointDiff.find((pd) => pd.seasonPlayerId === r.id)?.pointDiff ?? 0,
		form: formMap[r.id] || [],
	}));
};

export const getTopPlayer = async ({ db, seasonId }: { db: DrizzleDB; seasonId: string }) => {
	const [topPlayer] = await db
		.select({
			id: seasonPlayer.id,
			seasonId: seasonPlayer.seasonId,
			playerId: seasonPlayer.playerId,
			score: seasonPlayer.score,
			name: user.name,
			image: user.image,
		})
		.from(seasonPlayer)
		.innerJoin(player, eq(seasonPlayer.playerId, player.id))
		.innerJoin(user, eq(player.userId, user.id))
		.where(eq(seasonPlayer.seasonId, seasonId))
		.orderBy(desc(seasonPlayer.score))
		.limit(1);

	if (!topPlayer) return null;

	// Get recent match form (last 5 results)
	const recentMatches = await db
		.select({
			result: matchPlayer.result,
		})
		.from(matchPlayer)
		.where(eq(matchPlayer.seasonPlayerId, topPlayer.id))
		.orderBy(desc(matchPlayer.createdAt))
		.limit(5);

	return {
		...topPlayer,
		form: recentMatches.map((m) => m.result as "W" | "D" | "L"),
	};
};

export const isUserInSeason = async ({
	db,
	seasonId,
	userId,
}: {
	db: DrizzleDB;
	seasonId: string;
	userId: string;
}) => {
	const [cp] = await db
		.select({ id: seasonPlayer.id })
		.from(seasonPlayer)
		.innerJoin(player, eq(seasonPlayer.playerId, player.id))
		.where(and(eq(seasonPlayer.seasonId, seasonId), eq(player.userId, userId)))
		.limit(1);
	return !!cp;
};

export const getPointProgression = async ({
	db,
	seasonId,
}: {
	db: DrizzleDB;
	seasonId: string;
}) => {
	// Get all match players for this season ordered by time
	return db
		.select({
			seasonPlayerId: matchPlayer.seasonPlayerId,
			scoreAfter: matchPlayer.scoreAfter,
			createdAt: matchPlayer.createdAt,
			name: user.name,
		})
		.from(matchPlayer)
		.innerJoin(seasonPlayer, eq(matchPlayer.seasonPlayerId, seasonPlayer.id))
		.innerJoin(player, eq(seasonPlayer.playerId, player.id))
		.innerJoin(user, eq(player.userId, user.id))
		.where(eq(seasonPlayer.seasonId, seasonId))
		.orderBy(matchPlayer.createdAt);
};

export const getWeeklyStats = async ({ db, seasonId }: { db: DrizzleDB; seasonId: string }) => {
	// Get stats for the last 7 days excluding today
	// date('now', '-1 day') = yesterday, date('now', '-7 days') = 7 days ago
	const weeklyPlayerStats = await db.all<{
		seasonPlayerId: string;
		playerName: string;
		playerImage: string | null;
		matchCount: number;
		winCount: number;
		lossCount: number;
		drawCount: number;
		pointChange: number;
	}>(sql`
		SELECT 
			mp.season_player_id as seasonPlayerId,
			u.name as playerName,
			u.image as playerImage,
			COUNT(*) as matchCount,
			SUM(CASE WHEN mp.result = 'W' THEN 1 ELSE 0 END) as winCount,
			SUM(CASE WHEN mp.result = 'L' THEN 1 ELSE 0 END) as lossCount,
			SUM(CASE WHEN mp.result = 'D' THEN 1 ELSE 0 END) as drawCount,
			SUM(mp.score_after - mp.score_before) as pointChange
		FROM match_player mp
		INNER JOIN season_player sp ON mp.season_player_id = sp.id
		INNER JOIN player p ON sp.player_id = p.id
		INNER JOIN user u ON p.user_id = u.id
		WHERE sp.season_id = ${seasonId}
		AND date(datetime(mp.created_at, 'unixepoch')) >= date('now', '-7 days')
		AND date(datetime(mp.created_at, 'unixepoch')) <= date('now', '-1 day')
		GROUP BY mp.season_player_id, u.name, u.image
		HAVING COUNT(*) > 0
	`);

	return weeklyPlayerStats;
};
