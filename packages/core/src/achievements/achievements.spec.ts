import { describe, expect, it } from "vitest";
import { ACHIEVEMENT_TYPES, achievementCatalog, getAchievement } from "./index";

describe("achievementCatalog", () => {
	it("covers every achievement type exactly once", () => {
		expect(Object.keys(achievementCatalog).sort()).toEqual([...ACHIEVEMENT_TYPES].sort());
	});

	it("has non-empty display strings and an icon key for every achievement", () => {
		for (const type of ACHIEVEMENT_TYPES) {
			const meta = achievementCatalog[type];
			expect(meta.name, `${type} name`).toBeTruthy();
			expect(meta.description, `${type} description`).toBeTruthy();
			expect(meta.requirement, `${type} requirement`).toBeTruthy();
			expect(meta.iconKey, `${type} iconKey`).toBeTruthy();
		}
	});

	it("keeps displayed strings stable", () => {
		expect(achievementCatalog).toMatchInlineSnapshot(`
			{
			  "10_clean_sheet_streak": {
			    "description": "10 straight matches without conceding",
			    "iconKey": "shield-2",
			    "name": "10 Clean Sheets",
			    "requirement": "10 straight matches without conceding",
			  },
			  "10_win_streak": {
			    "description": "Win 10 matches in a row",
			    "iconKey": "fire-2",
			    "name": "10 Win Streak",
			    "requirement": "Win 10 matches in a row",
			  },
			  "15_clean_sheet_streak": {
			    "description": "15 straight matches without conceding",
			    "iconKey": "shield-3",
			    "name": "15 Clean Sheets",
			    "requirement": "15 straight matches without conceding",
			  },
			  "15_win_streak": {
			    "description": "Win 15 matches in a row",
			    "iconKey": "fire-3",
			    "name": "15 Win Streak",
			    "requirement": "Win 15 matches in a row",
			  },
			  "3_goals_5_games": {
			    "description": "Score 3+ goals in 5 straight matches",
			    "iconKey": "target-1",
			    "name": "Goal Machine",
			    "requirement": "Score 3+ goals in 5 straight matches",
			  },
			  "3_win_loss_redemption": {
			    "description": "Lose 3 in a row, then win 3 in a row",
			    "iconKey": "redemption",
			    "name": "3-Game Redemption",
			    "requirement": "Lose 3 in a row, then win 3 in a row",
			  },
			  "5_clean_sheet_streak": {
			    "description": "5 straight matches without conceding",
			    "iconKey": "shield-1",
			    "name": "5 Clean Sheets",
			    "requirement": "5 straight matches without conceding",
			  },
			  "5_goals_5_games": {
			    "description": "Score 5+ goals in 5 straight matches",
			    "iconKey": "target-2",
			    "name": "Sharpshooter",
			    "requirement": "Score 5+ goals in 5 straight matches",
			  },
			  "5_win_loss_redemption": {
			    "description": "Lose 5 in a row, then win 5 in a row",
			    "iconKey": "redemption",
			    "name": "5-Game Redemption",
			    "requirement": "Lose 5 in a row, then win 5 in a row",
			  },
			  "5_win_streak": {
			    "description": "Win 5 matches in a row",
			    "iconKey": "fire-1",
			    "name": "5 Win Streak",
			    "requirement": "Win 5 matches in a row",
			  },
			  "8_goals_5_games": {
			    "description": "Score 8+ goals in 5 straight matches",
			    "iconKey": "target-3",
			    "name": "Goal Overlord",
			    "requirement": "Score 8+ goals in 5 straight matches",
			  },
			  "8_win_loss_redemption": {
			    "description": "Lose 8 in a row, then win 8 in a row",
			    "iconKey": "redemption",
			    "name": "8-Game Redemption",
			    "requirement": "Lose 8 in a row, then win 8 in a row",
			  },
			  "season_winner": {
			    "description": "Finish a season at the top of the standings",
			    "iconKey": "crown",
			    "name": "Season Winner",
			    "requirement": "Finish a season at the top of the standings",
			  },
			}
		`);
	});
});

describe("getAchievement", () => {
	it("returns metadata for a known type", () => {
		expect(getAchievement("season_winner")?.name).toBe("Season Winner");
	});

	it("returns undefined for unknown types", () => {
		expect(getAchievement("not_a_real_achievement")).toBeUndefined();
	});

	it("does not resolve inherited object properties", () => {
		expect(getAchievement("toString")).toBeUndefined();
	});
});
