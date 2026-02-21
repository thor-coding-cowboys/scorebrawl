import { sql, inArray } from "drizzle-orm";
import type { DrizzleDB } from "../db";
import {
	matchPlayer,
	seasonPlayer,
	playerAchievement,
	type achievementType,
} from "../db/schema/league-schema";

type AchievementType = (typeof achievementType)[number];

type AchievementQueueMessage = {
	seasonPlayerIds: string[];
};

export type { AchievementQueueMessage };

const streakThresholds: Partial<Record<AchievementType, number>> = {
	"5_win_streak": 5,
	"10_win_streak": 10,
	"15_win_streak": 15,
	"3_win_loss_redemption": 3,
	"5_win_loss_redemption": 5,
	"8_win_loss_redemption": 8,
	"5_clean_sheet_streak": 5,
	"10_clean_sheet_streak": 10,
	"15_clean_sheet_streak": 15,
	"3_goals_5_games": 3,
	"5_goals_5_games": 5,
	"8_goals_5_games": 8,
};

export async function calculateAchievements(db: DrizzleDB, seasonPlayerIds: string[]) {
	if (seasonPlayerIds.length === 0) return;

	// Single query: get all match results for all players, ordered by creation time
	const allMatchResults = await db
		.select({
			seasonPlayerId: matchPlayer.seasonPlayerId,
			result: matchPlayer.result,
			homeTeam: matchPlayer.homeTeam,
			matchId: matchPlayer.matchId,
			createdAt: matchPlayer.createdAt,
		})
		.from(matchPlayer)
		.where(inArray(matchPlayer.seasonPlayerId, seasonPlayerIds))
		.orderBy(matchPlayer.createdAt);

	// Single query: get goals conceded per match for each player
	// Goals conceded = sum of opponent goals in the same match
	// For a home player, conceded goals = match.awayScore; for away player = match.homeScore
	// We can derive this from the match scores via match table
	const matchIds = [...new Set(allMatchResults.map((r) => r.matchId))];

	const goalsConcededMap = new Map<string, Map<string, number>>();
	if (matchIds.length > 0) {
		const goalsConceded = await db.all<{
			seasonPlayerId: string;
			matchId: string;
			goalsConceded: number;
		}>(sql`
			SELECT 
				mp.season_player_id as seasonPlayerId,
				mp.match_id as matchId,
				CASE WHEN mp.home_team = 1 THEN m.away_score ELSE m.home_score END as goalsConceded
			FROM match_player mp
			INNER JOIN match m ON mp.match_id = m.id
			WHERE mp.season_player_id IN (${sql.join(
				seasonPlayerIds.map((id) => sql`${id}`),
				sql`, `
			)})
		`);

		for (const row of goalsConceded) {
			let playerMap = goalsConcededMap.get(row.seasonPlayerId);
			if (!playerMap) {
				playerMap = new Map();
				goalsConcededMap.set(row.seasonPlayerId, playerMap);
			}
			playerMap.set(row.matchId, row.goalsConceded);
		}
	}

	// Single query: get last 5 matches goals scored per player
	// Goals scored for home player = match.homeScore; for away = match.awayScore
	const last5GoalsMap = new Map<string, number[]>();
	if (matchIds.length > 0) {
		const last5Goals = await db.all<{
			seasonPlayerId: string;
			goalsScored: number;
			rn: number;
		}>(sql`
			SELECT seasonPlayerId, goalsScored, rn FROM (
				SELECT 
					mp.season_player_id as seasonPlayerId,
					CASE WHEN mp.home_team = 1 THEN m.home_score ELSE m.away_score END as goalsScored,
					ROW_NUMBER() OVER (PARTITION BY mp.season_player_id ORDER BY mp.created_at DESC) as rn
				FROM match_player mp
				INNER JOIN match m ON mp.match_id = m.id
				WHERE mp.season_player_id IN (${sql.join(
					seasonPlayerIds.map((id) => sql`${id}`),
					sql`, `
				)})
			)
			WHERE rn <= 5
			ORDER BY seasonPlayerId, rn
		`);

		for (const row of last5Goals) {
			let goals = last5GoalsMap.get(row.seasonPlayerId);
			if (!goals) {
				goals = [];
				last5GoalsMap.set(row.seasonPlayerId, goals);
			}
			goals.push(row.goalsScored);
		}
	}

	// Resolve seasonPlayerId -> playerId for achievement storage
	const playerIdMap = await db
		.select({
			seasonPlayerId: seasonPlayer.id,
			playerId: seasonPlayer.playerId,
		})
		.from(seasonPlayer)
		.where(inArray(seasonPlayer.id, seasonPlayerIds));

	const seasonToPlayerMap = new Map(playerIdMap.map((p) => [p.seasonPlayerId, p.playerId]));

	// Group match results by season player
	const resultsByPlayer = new Map<string, typeof allMatchResults>();
	for (const r of allMatchResults) {
		let playerResults = resultsByPlayer.get(r.seasonPlayerId);
		if (!playerResults) {
			playerResults = [];
			resultsByPlayer.set(r.seasonPlayerId, playerResults);
		}
		playerResults.push(r);
	}

	// Calculate achievements per player
	const achievementsToInsert: { playerId: string; type: AchievementType }[] = [];

	for (const spId of seasonPlayerIds) {
		const playerId = seasonToPlayerMap.get(spId);
		if (!playerId) continue;

		const earned: AchievementType[] = [];
		const matches = resultsByPlayer.get(spId) || [];
		const concededForPlayer = goalsConcededMap.get(spId) || new Map();

		// Check redemption achievements (pattern matching on result string)
		checkRedemptionAchievements(earned, matches);

		// Check goals scored in last 5 games
		const lastFiveGoals = last5GoalsMap.get(spId) || [];
		checkGoalsScoredStreak(earned, lastFiveGoals);

		// Check win streaks and clean sheet streaks
		let currentWinStreak = 0;
		let currentCleanSheetStreak = 0;

		for (const m of matches) {
			if (m.result === "W") {
				currentWinStreak++;
			} else {
				currentWinStreak = 0;
			}

			checkStreakAchievement(earned, currentWinStreak, [
				"5_win_streak",
				"10_win_streak",
				"15_win_streak",
			]);

			const goalsConceded = concededForPlayer.get(m.matchId) ?? -1;
			if (goalsConceded === 0) {
				currentCleanSheetStreak++;
				checkStreakAchievement(earned, currentCleanSheetStreak, [
					"5_clean_sheet_streak",
					"10_clean_sheet_streak",
					"15_clean_sheet_streak",
				]);
			} else {
				currentCleanSheetStreak = 0;
			}
		}

		for (const achievement of earned) {
			achievementsToInsert.push({ playerId, type: achievement });
		}
	}

	// Batch insert all achievements (idempotent via onConflictDoNothing)
	if (achievementsToInsert.length > 0) {
		const now = new Date();
		await db
			.insert(playerAchievement)
			.values(
				achievementsToInsert.map((a) => ({
					id: crypto.randomUUID(),
					playerId: a.playerId,
					type: a.type,
					createdAt: now,
					updatedAt: now,
				}))
			)
			.onConflictDoNothing();
	}
}

function checkGoalsScoredStreak(earned: AchievementType[], lastFiveGoals: number[]) {
	if (lastFiveGoals.length < 5) return;

	if (lastFiveGoals.every((n) => n >= 8)) {
		earned.push("8_goals_5_games", "5_goals_5_games", "3_goals_5_games");
	} else if (lastFiveGoals.every((n) => n >= 5)) {
		earned.push("5_goals_5_games", "3_goals_5_games");
	} else if (lastFiveGoals.every((n) => n >= 3)) {
		earned.push("3_goals_5_games");
	}
}

function checkStreakAchievement(
	earned: AchievementType[],
	currentStreak: number,
	streakAchievements: AchievementType[]
) {
	for (const achievement of streakAchievements) {
		if (currentStreak === streakThresholds[achievement] && !earned.includes(achievement)) {
			earned.push(achievement);
		}
	}
}

function checkRedemptionAchievements(earned: AchievementType[], matches: { result: string }[]) {
	const resultString = matches.map((m) => m.result).join("");

	const redemptionAchievements: AchievementType[] = [
		"3_win_loss_redemption",
		"5_win_loss_redemption",
		"8_win_loss_redemption",
	];

	for (const achievement of redemptionAchievements) {
		const count = streakThresholds[achievement];
		if (!count) continue;
		// Pattern: N consecutive losses followed by N consecutive wins
		const pattern = "L".repeat(count) + "W".repeat(count);
		if (resultString.includes(pattern)) {
			earned.push(achievement);
		}
	}
}
