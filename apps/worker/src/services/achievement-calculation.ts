import { sql, inArray, eq } from "drizzle-orm";
import type { DrizzleDB } from "../db";
import { user } from "../db/schema/auth-schema";
import {
	matchPlayer,
	seasonPlayer,
	playerAchievement,
	player,
	guest,
	type achievementType,
} from "../db/schema/league-schema";

type AchievementType = (typeof achievementType)[number];

export type AchievementQueueMessage = {
	seasonPlayerIds: string[];
	leagueSlug: string;
	seasonSlug: string;
};

export type NewAchievement = {
	playerId: string;
	name: string;
	image: string | null;
	type: AchievementType;
};

export function buildAchievementUnlockEvents(newAchievements: NewAchievement[]): Array<{
	type: "achievement:unlock";
	data: { player: { id: string; name: string; image: string | null }; type: AchievementType };
}> {
	return newAchievements.map((a) => ({
		type: "achievement:unlock",
		data: {
			player: { id: a.playerId, name: a.name, image: a.image },
			type: a.type,
		},
	}));
}

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

export async function calculateAchievements(
	db: DrizzleDB,
	seasonPlayerIds: string[]
): Promise<NewAchievement[]> {
	if (seasonPlayerIds.length === 0) return [];

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

	// Resolve seasonPlayerId -> player info for achievement storage + broadcast
	const playerInfo = await db
		.select({
			seasonPlayerId: seasonPlayer.id,
			playerId: seasonPlayer.playerId,
			name: sql<string>`COALESCE(${user.name}, ${guest.displayName})`.as("name"),
			image: user.image,
		})
		.from(seasonPlayer)
		.innerJoin(player, eq(seasonPlayer.playerId, player.id))
		.leftJoin(user, eq(player.userId, user.id))
		.leftJoin(guest, eq(player.guestId, guest.id))
		.where(inArray(seasonPlayer.id, seasonPlayerIds));

	const seasonToPlayerMap = new Map(playerInfo.map((p) => [p.seasonPlayerId, p]));

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
	const achievementsToInsert: NewAchievement[] = [];

	for (const spId of seasonPlayerIds) {
		const info = seasonToPlayerMap.get(spId);
		if (!info) continue;

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
			achievementsToInsert.push({
				playerId: info.playerId,
				name: info.name,
				image: info.image,
				type: achievement,
			});
		}
	}

	// Filter out achievements already earned (idempotent, no re-broadcast)
	const playerIds = [...new Set(achievementsToInsert.map((a) => a.playerId))];
	const existing = playerIds.length
		? await db
				.select({ playerId: playerAchievement.playerId, type: playerAchievement.type })
				.from(playerAchievement)
				.where(inArray(playerAchievement.playerId, playerIds))
		: [];
	const existingSet = new Set(existing.map((e) => `${e.playerId}:${e.type}`));
	const newAchievements = achievementsToInsert.filter(
		(a) => !existingSet.has(`${a.playerId}:${a.type}`)
	);

	if (newAchievements.length > 0) {
		const now = new Date();
		await db
			.insert(playerAchievement)
			.values(
				newAchievements.map((a) => ({
					id: crypto.randomUUID(),
					playerId: a.playerId,
					type: a.type,
					createdAt: now,
					updatedAt: now,
				}))
			)
			.onConflictDoNothing();
	}

	return newAchievements;
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
