import type { SymbolView } from "expo-symbols";

type SymbolName = Parameters<typeof SymbolView>[0]["name"];

export interface AchievementMetadata {
	name: string;
	description: string;
	icon: SymbolName;
}

const FIRE: SymbolName = {
	ios: "flame.fill",
	android: "local_fire_department",
	web: "local_fire_department",
};
const REDEMPTION: SymbolName = {
	ios: "arrow.left.arrow.right",
	android: "swap_horiz",
	web: "swap_horiz",
};
const SHIELD: SymbolName = { ios: "shield.fill", android: "shield", web: "shield" };
const TARGET: SymbolName = { ios: "target", android: "track_changes", web: "track_changes" };

export const achievementCatalog = {
	"5_win_streak": { name: "5 Win Streak", description: "Win 5 matches in a row", icon: FIRE },
	"10_win_streak": { name: "10 Win Streak", description: "Win 10 matches in a row", icon: FIRE },
	"15_win_streak": { name: "15 Win Streak", description: "Win 15 matches in a row", icon: FIRE },
	"3_win_loss_redemption": {
		name: "3-Game Redemption",
		description: "Lose 3 in a row, then win 3 in a row",
		icon: REDEMPTION,
	},
	"5_win_loss_redemption": {
		name: "5-Game Redemption",
		description: "Lose 5 in a row, then win 5 in a row",
		icon: REDEMPTION,
	},
	"8_win_loss_redemption": {
		name: "8-Game Redemption",
		description: "Lose 8 in a row, then win 8 in a row",
		icon: REDEMPTION,
	},
	"5_clean_sheet_streak": {
		name: "5 Clean Sheets",
		description: "5 straight matches without conceding",
		icon: SHIELD,
	},
	"10_clean_sheet_streak": {
		name: "10 Clean Sheets",
		description: "10 straight matches without conceding",
		icon: SHIELD,
	},
	"15_clean_sheet_streak": {
		name: "15 Clean Sheets",
		description: "15 straight matches without conceding",
		icon: SHIELD,
	},
	"3_goals_5_games": {
		name: "Goal Machine",
		description: "Score 3+ goals in 5 straight matches",
		icon: TARGET,
	},
	"5_goals_5_games": {
		name: "Sharpshooter",
		description: "Score 5+ goals in 5 straight matches",
		icon: TARGET,
	},
	"8_goals_5_games": {
		name: "Goal Overlord",
		description: "Score 8+ goals in 5 straight matches",
		icon: TARGET,
	},
	season_winner: {
		name: "Season Winner",
		description: "Finish a season at the top of the standings",
		icon: { ios: "crown.fill", android: "emoji_events", web: "emoji_events" },
	},
} satisfies Record<string, AchievementMetadata>;

export type AchievementType = keyof typeof achievementCatalog;

export function getAchievement(type: string): AchievementMetadata | undefined {
	return type in achievementCatalog ? achievementCatalog[type as AchievementType] : undefined;
}
