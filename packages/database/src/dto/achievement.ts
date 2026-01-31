import { z } from "zod";

export const leagueAchievementType = [
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

export const LeagueAchievementType = z.enum(leagueAchievementType);
