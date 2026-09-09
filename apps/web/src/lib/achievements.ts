import type { IconSvgElement } from "@hugeicons/react";
import {
	ArrowLeftRightIcon,
	CrownIcon,
	Fire02Icon,
	Fire03Icon,
	FireIcon,
	Shield01Icon,
	Shield02Icon,
	ShieldIcon,
	Target01Icon,
	Target02Icon,
	TargetIcon,
} from "@hugeicons/core-free-icons";

export type AchievementType =
	| "5_win_streak"
	| "10_win_streak"
	| "15_win_streak"
	| "3_win_loss_redemption"
	| "5_win_loss_redemption"
	| "8_win_loss_redemption"
	| "5_clean_sheet_streak"
	| "10_clean_sheet_streak"
	| "15_clean_sheet_streak"
	| "3_goals_5_games"
	| "5_goals_5_games"
	| "8_goals_5_games"
	| "season_winner";

export interface AchievementMetadata {
	name: string;
	description: string;
	requirement: string;
	icon: IconSvgElement;
}

export const achievementCatalog: Record<AchievementType, AchievementMetadata> = {
	"5_win_streak": {
		name: "5 Win Streak",
		description: "Win 5 matches in a row",
		requirement: "Win 5 matches in a row",
		icon: FireIcon,
	},
	"10_win_streak": {
		name: "10 Win Streak",
		description: "Win 10 matches in a row",
		requirement: "Win 10 matches in a row",
		icon: Fire02Icon,
	},
	"15_win_streak": {
		name: "15 Win Streak",
		description: "Win 15 matches in a row",
		requirement: "Win 15 matches in a row",
		icon: Fire03Icon,
	},
	"3_win_loss_redemption": {
		name: "3-Game Redemption",
		description: "Lose 3 in a row, then win 3 in a row",
		requirement: "Lose 3 in a row, then win 3 in a row",
		icon: ArrowLeftRightIcon,
	},
	"5_win_loss_redemption": {
		name: "5-Game Redemption",
		description: "Lose 5 in a row, then win 5 in a row",
		requirement: "Lose 5 in a row, then win 5 in a row",
		icon: ArrowLeftRightIcon,
	},
	"8_win_loss_redemption": {
		name: "8-Game Redemption",
		description: "Lose 8 in a row, then win 8 in a row",
		requirement: "Lose 8 in a row, then win 8 in a row",
		icon: ArrowLeftRightIcon,
	},
	"5_clean_sheet_streak": {
		name: "5 Clean Sheets",
		description: "5 straight matches without conceding",
		requirement: "5 straight matches without conceding",
		icon: ShieldIcon,
	},
	"10_clean_sheet_streak": {
		name: "10 Clean Sheets",
		description: "10 straight matches without conceding",
		requirement: "10 straight matches without conceding",
		icon: Shield01Icon,
	},
	"15_clean_sheet_streak": {
		name: "15 Clean Sheets",
		description: "15 straight matches without conceding",
		requirement: "15 straight matches without conceding",
		icon: Shield02Icon,
	},
	"3_goals_5_games": {
		name: "Goal Machine",
		description: "Score 3+ goals in 5 straight matches",
		requirement: "Score 3+ goals in 5 straight matches",
		icon: TargetIcon,
	},
	"5_goals_5_games": {
		name: "Sharpshooter",
		description: "Score 5+ goals in 5 straight matches",
		requirement: "Score 5+ goals in 5 straight matches",
		icon: Target01Icon,
	},
	"8_goals_5_games": {
		name: "Goal Overlord",
		description: "Score 8+ goals in 5 straight matches",
		requirement: "Score 8+ goals in 5 straight matches",
		icon: Target02Icon,
	},
	season_winner: {
		name: "Season Winner",
		description: "Finish a season at the top of the standings",
		requirement: "Finish a season at the top of the standings",
		icon: CrownIcon,
	},
};