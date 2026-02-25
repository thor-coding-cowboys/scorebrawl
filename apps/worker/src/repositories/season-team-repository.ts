import { eq, sql } from "drizzle-orm";
import type { DrizzleDB } from "../db";
import { seasonTeam, leagueTeam, leagueTeamPlayer, player } from "../db/schema/league-schema";
import { user } from "../db/schema/auth-schema";

export const getStanding = async ({ db, seasonId }: { db: DrizzleDB; seasonId: string }) => {
	// Run standings and team players queries in parallel
	const [rows, teamPlayers] = await Promise.all([
		db.all<{
			id: string;
			seasonId: string;
			leagueTeamId: string;
			score: number;
			name: string;
			logo: string | null;
			matchCount: number;
			winCount: number;
			lossCount: number;
			drawCount: number;
			todayPointDiff: number;
			recentResults: string | null;
		}>(sql`
			SELECT
				st.id,
				st.season_id as seasonId,
				st.league_team_id as leagueTeamId,
				st.score,
				lt.name,
				lt.logo,
				COALESCE(stats.match_count, 0) as matchCount,
				COALESCE(stats.win_count, 0) as winCount,
				COALESCE(stats.loss_count, 0) as lossCount,
				COALESCE(stats.draw_count, 0) as drawCount,
				COALESCE(today.point_diff, 0) as todayPointDiff,
				form.recent_results as recentResults
			FROM season_team st
			INNER JOIN league_team lt ON st.league_team_id = lt.id
			LEFT JOIN (
				SELECT
					mt.season_team_id,
					COUNT(*) as match_count,
					SUM(CASE WHEN mt.result = 'W' THEN 1 ELSE 0 END) as win_count,
					SUM(CASE WHEN mt.result = 'L' THEN 1 ELSE 0 END) as loss_count,
					SUM(CASE WHEN mt.result = 'D' THEN 1 ELSE 0 END) as draw_count
				FROM match_team mt
				INNER JOIN season_team st2 ON mt.season_team_id = st2.id
				WHERE st2.season_id = ${seasonId}
				GROUP BY mt.season_team_id
			) stats ON st.id = stats.season_team_id
			LEFT JOIN (
				SELECT
					mt.season_team_id,
					SUM(mt.score_after - mt.score_before) as point_diff
				FROM match_team mt
				INNER JOIN season_team st2 ON mt.season_team_id = st2.id
				WHERE st2.season_id = ${seasonId}
				AND strftime('%Y-%m-%d', datetime(mt.created_at, 'unixepoch')) = strftime('%Y-%m-%d', 'now', 'localtime')
				GROUP BY mt.season_team_id
			) today ON st.id = today.season_team_id
			LEFT JOIN (
				SELECT
					season_team_id,
					GROUP_CONCAT(result, '') as recent_results
				FROM (
					SELECT
						mt.season_team_id,
						mt.result,
						ROW_NUMBER() OVER (PARTITION BY mt.season_team_id ORDER BY mt.created_at DESC) as rn
					FROM match_team mt
					INNER JOIN season_team st2 ON mt.season_team_id = st2.id
					WHERE st2.season_id = ${seasonId}
				)
				WHERE rn <= 5
				GROUP BY season_team_id
			) form ON st.id = form.season_team_id
			WHERE st.season_id = ${seasonId}
			ORDER BY st.score DESC
		`),
		db
			.select({
				leagueTeamId: leagueTeamPlayer.leagueTeamId,
				playerId: player.id,
				playerName: user.name,
				playerImage: user.image,
			})
			.from(leagueTeamPlayer)
			.innerJoin(player, eq(leagueTeamPlayer.playerId, player.id))
			.innerJoin(user, eq(player.userId, user.id))
			.innerJoin(leagueTeam, eq(leagueTeamPlayer.leagueTeamId, leagueTeam.id))
			.innerJoin(seasonTeam, eq(leagueTeam.id, seasonTeam.leagueTeamId))
			.where(eq(seasonTeam.seasonId, seasonId)),
	]);

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

	return rows.map((r, index) => ({
		id: r.id,
		seasonId: r.seasonId,
		leagueTeamId: r.leagueTeamId,
		score: r.score,
		name: r.name,
		logo: r.logo,
		matchCount: r.matchCount,
		winCount: r.winCount,
		lossCount: r.lossCount,
		drawCount: r.drawCount,
		rank: index + 1,
		pointDiff: r.todayPointDiff,
		form: r.recentResults ? (r.recentResults.split("") as ("W" | "D" | "L")[]) : [],
		players: playersMap[r.leagueTeamId] || [],
	}));
};

export const getWeeklyStats = async ({ db, seasonId }: { db: DrizzleDB; seasonId: string }) => {
	// Get stats for the last 7 days including today
	const weeklyTeamStats = await db.all<{
		seasonTeamId: string;
		teamName: string;
		teamLogo: string | null;
		matchCount: number;
		winCount: number;
		lossCount: number;
		drawCount: number;
		pointChange: number;
	}>(sql`
		SELECT 
			mt.season_team_id as seasonTeamId,
			lt.name as teamName,
			lt.logo as teamLogo,
			COUNT(*) as matchCount,
			SUM(CASE WHEN mt.result = 'W' THEN 1 ELSE 0 END) as winCount,
			SUM(CASE WHEN mt.result = 'L' THEN 1 ELSE 0 END) as lossCount,
			SUM(CASE WHEN mt.result = 'D' THEN 1 ELSE 0 END) as drawCount,
			SUM(mt.score_after - mt.score_before) as pointChange
		FROM match_team mt
		INNER JOIN season_team st ON mt.season_team_id = st.id
		INNER JOIN league_team lt ON st.league_team_id = lt.id
		WHERE st.season_id = ${seasonId}
		AND date(datetime(mt.created_at, 'unixepoch')) >= date('now', '-6 days')
		AND date(datetime(mt.created_at, 'unixepoch')) <= date('now')
		GROUP BY mt.season_team_id, lt.name, lt.logo
		HAVING COUNT(*) > 0
	`);

	return weeklyTeamStats;
};
