import { and, desc, eq, sql } from "drizzle-orm";
import type { DrizzleDB } from "../db";
import { user } from "../db/schema/auth-schema";
import { guest, seasonPlayer, matchPlayer, player } from "../db/schema/league-schema";

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
			name: sql<string>`COALESCE(${user.name}, ${guest.displayName})`.as("name"),
			image: user.image,
			userId: player.userId,
			isGuest: sql<boolean>`${player.guestId} IS NOT NULL`.as("is_guest"),
		})
		.from(seasonPlayer)
		.innerJoin(player, eq(seasonPlayer.playerId, player.id))
		.leftJoin(user, eq(player.userId, user.id))
		.leftJoin(guest, eq(player.guestId, guest.id))
		.where(eq(seasonPlayer.seasonId, seasonId))
		.orderBy(desc(seasonPlayer.score));
};

export const getStanding = async ({ db, seasonId }: { db: DrizzleDB; seasonId: string }) => {
	// Single raw SQL query that computes standings, today's point diff, and recent form
	const rows = await db.all<{
		id: string;
		seasonId: string;
		playerId: string;
		score: number;
		name: string;
		image: string | null;
		userId: string | null;
		isGuest: number;
		matchCount: number;
		winCount: number;
		lossCount: number;
		drawCount: number;
		todayPointDiff: number;
		recentResults: string | null;
	}>(sql`
		SELECT
			sp.id,
			sp.season_id as seasonId,
			sp.player_id as playerId,
			sp.score,
			COALESCE(u.name, g.display_name) as name,
			u.image,
			p.user_id as userId,
			(p.guest_id IS NOT NULL) as isGuest,
			COALESCE(stats.match_count, 0) as matchCount,
			COALESCE(stats.win_count, 0) as winCount,
			COALESCE(stats.loss_count, 0) as lossCount,
			COALESCE(stats.draw_count, 0) as drawCount,
			COALESCE(today.point_diff, 0) as todayPointDiff,
			form.recent_results as recentResults
		FROM season_player sp
		INNER JOIN player p ON sp.player_id = p.id
		LEFT JOIN user u ON p.user_id = u.id
		LEFT JOIN guest g ON p.guest_id = g.id
		LEFT JOIN (
			SELECT
				mp.season_player_id,
				COUNT(*) as match_count,
				SUM(CASE WHEN mp.result = 'W' THEN 1 ELSE 0 END) as win_count,
				SUM(CASE WHEN mp.result = 'L' THEN 1 ELSE 0 END) as loss_count,
				SUM(CASE WHEN mp.result = 'D' THEN 1 ELSE 0 END) as draw_count
			FROM match_player mp
			INNER JOIN season_player sp2 ON mp.season_player_id = sp2.id
			WHERE sp2.season_id = ${seasonId}
			GROUP BY mp.season_player_id
		) stats ON sp.id = stats.season_player_id
		LEFT JOIN (
			SELECT
				mp.season_player_id,
				SUM(mp.score_after - mp.score_before) as point_diff
			FROM match_player mp
			INNER JOIN season_player sp2 ON mp.season_player_id = sp2.id
			WHERE sp2.season_id = ${seasonId}
			AND strftime('%Y-%m-%d', datetime(mp.created_at, 'unixepoch')) = strftime('%Y-%m-%d', 'now', 'localtime')
			GROUP BY mp.season_player_id
		) today ON sp.id = today.season_player_id
		LEFT JOIN (
			SELECT
				season_player_id,
				GROUP_CONCAT(result, '') as recent_results
			FROM (
				SELECT
					mp.season_player_id,
					mp.result,
					ROW_NUMBER() OVER (PARTITION BY mp.season_player_id ORDER BY mp.created_at DESC) as rn
				FROM match_player mp
				INNER JOIN season_player sp2 ON mp.season_player_id = sp2.id
				WHERE sp2.season_id = ${seasonId}
			)
			WHERE rn <= 5
			GROUP BY season_player_id
		) form ON sp.id = form.season_player_id
		WHERE sp.season_id = ${seasonId}
		ORDER BY sp.score DESC
	`);

	return rows.map((r, index) => ({
		id: r.id,
		seasonId: r.seasonId,
		playerId: r.playerId,
		score: r.score,
		name: r.name,
		image: r.image,
		userId: r.userId,
		isGuest: !!r.isGuest,
		matchCount: r.matchCount,
		winCount: r.winCount,
		lossCount: r.lossCount,
		drawCount: r.drawCount,
		rank: index + 1,
		pointDiff: r.todayPointDiff,
		form: r.recentResults ? (r.recentResults.split("") as ("W" | "D" | "L")[]) : [],
	}));
};

export const getTopPlayer = async ({ db, seasonId }: { db: DrizzleDB; seasonId: string }) => {
	const [topPlayer] = await db
		.select({
			id: seasonPlayer.id,
			seasonId: seasonPlayer.seasonId,
			playerId: seasonPlayer.playerId,
			score: seasonPlayer.score,
			name: sql<string>`COALESCE(${user.name}, ${guest.displayName})`.as("name"),
			image: user.image,
		})
		.from(seasonPlayer)
		.innerJoin(player, eq(seasonPlayer.playerId, player.id))
		.leftJoin(user, eq(player.userId, user.id))
		.leftJoin(guest, eq(player.guestId, guest.id))
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
			name: sql<string>`COALESCE(${user.name}, ${guest.displayName})`.as("name"),
		})
		.from(matchPlayer)
		.innerJoin(seasonPlayer, eq(matchPlayer.seasonPlayerId, seasonPlayer.id))
		.innerJoin(player, eq(seasonPlayer.playerId, player.id))
		.leftJoin(user, eq(player.userId, user.id))
		.leftJoin(guest, eq(player.guestId, guest.id))
		.where(eq(seasonPlayer.seasonId, seasonId))
		.orderBy(matchPlayer.createdAt);
};

export const getWeeklyStats = async ({ db, seasonId }: { db: DrizzleDB; seasonId: string }) => {
	// Get stats for the last 7 days including today
	// date('now') = today, date('now', '-6 days') = 6 days ago
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
			COALESCE(u.name, g.display_name) as playerName,
			u.image as playerImage,
			COUNT(*) as matchCount,
			SUM(CASE WHEN mp.result = 'W' THEN 1 ELSE 0 END) as winCount,
			SUM(CASE WHEN mp.result = 'L' THEN 1 ELSE 0 END) as lossCount,
			SUM(CASE WHEN mp.result = 'D' THEN 1 ELSE 0 END) as drawCount,
			SUM(mp.score_after - mp.score_before) as pointChange
		FROM match_player mp
		INNER JOIN season_player sp ON mp.season_player_id = sp.id
		INNER JOIN player p ON sp.player_id = p.id
		LEFT JOIN user u ON p.user_id = u.id
		LEFT JOIN guest g ON p.guest_id = g.id
		WHERE sp.season_id = ${seasonId}
		AND date(datetime(mp.created_at, 'unixepoch')) >= date('now', '-6 days')
		AND date(datetime(mp.created_at, 'unixepoch')) <= date('now')
		GROUP BY mp.season_player_id, COALESCE(u.name, g.display_name), u.image
		HAVING COUNT(*) > 0
	`);

	return weeklyPlayerStats;
};
