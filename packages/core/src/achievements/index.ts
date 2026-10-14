export const ACHIEVEMENT_TYPES = [
	"5_win_streak",
	"10_win_streak",
	"15_win_streak",
	"3_win_loss_redemption",
	"5_win_loss_redemption",
	"8_win_loss_redemption",
	"5_clean_sheet_streak",
	"10_clean_sheet_streak",
	"15_clean_sheet_streak",
	"3_goals_5_games",
	"5_goals_5_games",
	"8_goals_5_games",
	"season_winner",
] as const;

export type AchievementType = (typeof ACHIEVEMENT_TYPES)[number];

export type AchievementIconKey =
	| "fire-1"
	| "fire-2"
	| "fire-3"
	| "redemption"
	| "shield-1"
	| "shield-2"
	| "shield-3"
	| "target-1"
	| "target-2"
	| "target-3"
	| "crown";

export interface AchievementMetadata {
	name: string;
	description: string;
	requirement: string;
	iconKey: AchievementIconKey;
}

export const achievementCatalog: Record<AchievementType, AchievementMetadata> = {
	"5_win_streak": {
		name: "5 Win Streak",
		description: "Win 5 matches in a row",
		requirement: "Win 5 matches in a row",
		iconKey: "fire-1",
	},
	"10_win_streak": {
		name: "10 Win Streak",
		description: "Win 10 matches in a row",
		requirement: "Win 10 matches in a row",
		iconKey: "fire-2",
	},
	"15_win_streak": {
		name: "15 Win Streak",
		description: "Win 15 matches in a row",
		requirement: "Win 15 matches in a row",
		iconKey: "fire-3",
	},
	"3_win_loss_redemption": {
		name: "3-Game Redemption",
		description: "Lose 3 in a row, then win 3 in a row",
		requirement: "Lose 3 in a row, then win 3 in a row",
		iconKey: "redemption",
	},
	"5_win_loss_redemption": {
		name: "5-Game Redemption",
		description: "Lose 5 in a row, then win 5 in a row",
		requirement: "Lose 5 in a row, then win 5 in a row",
		iconKey: "redemption",
	},
	"8_win_loss_redemption": {
		name: "8-Game Redemption",
		description: "Lose 8 in a row, then win 8 in a row",
		requirement: "Lose 8 in a row, then win 8 in a row",
		iconKey: "redemption",
	},
	"5_clean_sheet_streak": {
		name: "5 Clean Sheets",
		description: "5 straight matches without conceding",
		requirement: "5 straight matches without conceding",
		iconKey: "shield-1",
	},
	"10_clean_sheet_streak": {
		name: "10 Clean Sheets",
		description: "10 straight matches without conceding",
		requirement: "10 straight matches without conceding",
		iconKey: "shield-2",
	},
	"15_clean_sheet_streak": {
		name: "15 Clean Sheets",
		description: "15 straight matches without conceding",
		requirement: "15 straight matches without conceding",
		iconKey: "shield-3",
	},
	"3_goals_5_games": {
		name: "Goal Machine",
		description: "Score 3+ goals in 5 straight matches",
		requirement: "Score 3+ goals in 5 straight matches",
		iconKey: "target-1",
	},
	"5_goals_5_games": {
		name: "Sharpshooter",
		description: "Score 5+ goals in 5 straight matches",
		requirement: "Score 5+ goals in 5 straight matches",
		iconKey: "target-2",
	},
	"8_goals_5_games": {
		name: "Goal Overlord",
		description: "Score 8+ goals in 5 straight matches",
		requirement: "Score 8+ goals in 5 straight matches",
		iconKey: "target-3",
	},
	season_winner: {
		name: "Season Winner",
		description: "Finish a season at the top of the standings",
		requirement: "Finish a season at the top of the standings",
		iconKey: "crown",
	},
};

export function getAchievement(type: string): AchievementMetadata | undefined {
	return Object.prototype.hasOwnProperty.call(achievementCatalog, type)
		? achievementCatalog[type as AchievementType]
		: undefined;
}
