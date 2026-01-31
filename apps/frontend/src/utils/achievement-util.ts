import type { LeagueAchievementType } from "@/dto";
import { Brain, Shield, Target, Zap } from "lucide-react";
import type { z } from "zod";

// Utility function to extract the numeric part of the achievement type
export const getNumericValue = (achievement: string): number | null => {
  const match = achievement.match(/^\d+/);
  return match ? Number.parseInt(match[0], 10) : null;
};

// Define the groups of achievements
export const achievementGroups: { [key: string]: z.output<typeof LeagueAchievementType>[] } = {
  win_streak: ["5_win_streak", "10_win_streak", "15_win_streak"],
  win_loss_redemption: ["3_win_loss_redemption", "5_win_loss_redemption", "8_win_loss_redemption"],
  clean_sheet_streak: ["5_clean_sheet_streak", "10_clean_sheet_streak", "15_clean_sheet_streak"],
  goals_5_games: ["3_goals_5_games", "5_goals_5_games", "8_goals_5_games"],
  season_winner: ["season_winner"],
};

// Function to get the top achievement per group
export const getTopAchievements = (
  achievements: z.output<typeof LeagueAchievementType>[],
): z.output<typeof LeagueAchievementType>[] => {
  const topAchievements: z.output<typeof LeagueAchievementType>[] = [];

  // Iterate over each group and find the top achievement in that group
  for (const [_, types] of Object.entries(achievementGroups)) {
    const groupAchievements = achievements.filter((a) => types.includes(a));

    if (groupAchievements.length > 0) {
      const topAchievement = groupAchievements.sort((a, b) => {
        const aValue = getNumericValue(a) ?? 0;
        const bValue = getNumericValue(b) ?? 0;
        return bValue - aValue; // Sort descending
      })[0];

      if (topAchievement) {
        topAchievements.push(topAchievement);
      }
    }
  }

  return topAchievements;
};

// Achievement display data interface
export interface AchievementDisplayData {
  labelText: string;
  title: string;
  description: string;
  image: string;
  icon: typeof Brain;
  type: z.output<typeof LeagueAchievementType>;
  unlocked: boolean;
}

// Function to map achievement type to display properties for table/badge use
export const getAchievementData = (
  type: z.output<typeof LeagueAchievementType>,
): {
  labelText: string;
  title: string;
  image: string;
  type: z.output<typeof LeagueAchievementType>;
} => {
  switch (type) {
    case "5_win_streak":
    case "10_win_streak":
    case "15_win_streak": {
      let labelText = "🥉";
      let title = "5 Win Streak";
      if (type === "10_win_streak") {
        labelText = "🥈";
        title = "10 Win Streak";
      } else if (type === "15_win_streak") {
        labelText = "🥇";
        title = "15 Win Streak";
      }
      return {
        labelText,
        title,
        image: "/achievements/win-streak-v2.jpeg",
        type,
      };
    }
    case "3_win_loss_redemption":
    case "5_win_loss_redemption":
    case "8_win_loss_redemption": {
      let labelText = "🥉";
      let title = "3 win streak after 3 losses";
      if (type === "5_win_loss_redemption") {
        labelText = "🥈";
        title = "5 win streak after 5 losses";
      } else if (type === "8_win_loss_redemption") {
        labelText = "🥇";
        title = "8 win streak after 8 losses";
      }
      return {
        labelText,
        title,
        image: "/achievements/redemption.jpeg",
        type,
      };
    }
    case "5_clean_sheet_streak":
    case "10_clean_sheet_streak":
    case "15_clean_sheet_streak": {
      let labelText = "🥉";
      let title = "5 Clean Sheet Streak";
      if (type === "10_clean_sheet_streak") {
        labelText = "🥈";
        title = "10 Clean Sheet Streak";
      } else if (type === "15_clean_sheet_streak") {
        labelText = "🥇";
        title = "15 Clean Sheet Streak";
      }
      return {
        labelText,
        title,
        image: "/achievements/clean-sheet-v2.jpeg",
        type,
      };
    }
    case "3_goals_5_games":
    case "5_goals_5_games":
    case "8_goals_5_games": {
      let labelText = "🥉";
      let title = "3 Goals 5 in a row";
      if (type === "5_goals_5_games") {
        labelText = "🥈";
        title = "5 Goals 5 in a row";
      } else if (type === "8_goals_5_games") {
        labelText = "🥇";
        title = "8 Goals 5 in a row";
      }
      return {
        labelText,
        title,
        image: "/achievements/goal-scoring-streak-v2.jpeg",
        type,
      };
    }
    case "season_winner":
      return {
        labelText: "🏆",
        title: "Season Winner",
        image: "/achievements/clean-sheet-streak.jpeg",
        type,
      };
    default:
      return {
        labelText: "💩",
        title: "Unknown",
        image: "/achievements/clean-sheet-streak.jpeg",
        type,
      };
  }
};

// Function to get full achievement display data for profile page
export const getFullAchievementData = (
  userAchievements: z.output<typeof LeagueAchievementType>[],
): AchievementDisplayData[] => {
  const allAchievements: AchievementDisplayData[] = [
    {
      labelText: "🔄",
      title: "Rising Phoenix",
      description: (() => {
        if (userAchievements.includes("8_win_loss_redemption"))
          return "Turn 8 losses into 8 wins in a row";
        if (userAchievements.includes("5_win_loss_redemption"))
          return "Turn 5 losses into 5 wins in a row";
        if (userAchievements.includes("3_win_loss_redemption"))
          return "Turn 3 losses into 3 wins in a row";
        return "Turn a losing streak into a winning streak";
      })(),
      image: "/achievements/redemption.jpeg",
      icon: Zap,
      type: "3_win_loss_redemption",
      unlocked:
        userAchievements.includes("3_win_loss_redemption") ||
        userAchievements.includes("5_win_loss_redemption") ||
        userAchievements.includes("8_win_loss_redemption"),
    },
    {
      labelText: "🎯",
      title: "Goal Machine",
      description: (() => {
        if (userAchievements.includes("8_goals_5_games"))
          return "Score 8+ goals in 5 consecutive matches";
        if (userAchievements.includes("5_goals_5_games"))
          return "Score 5+ goals in 5 consecutive matches";
        if (userAchievements.includes("3_goals_5_games"))
          return "Score 3+ goals in 5 consecutive matches";
        return "Score goals consistently in consecutive matches";
      })(),
      image: "/achievements/goal-scoring-streak-v2.jpeg",
      icon: Target,
      type: "3_goals_5_games",
      unlocked:
        userAchievements.includes("3_goals_5_games") ||
        userAchievements.includes("5_goals_5_games") ||
        userAchievements.includes("8_goals_5_games"),
    },
    {
      labelText: "🛡️",
      title: "Guardian",
      description: (() => {
        if (userAchievements.includes("15_clean_sheet_streak"))
          return "Maintain 15 clean sheets in a row";
        if (userAchievements.includes("10_clean_sheet_streak"))
          return "Maintain 10 clean sheets in a row";
        if (userAchievements.includes("5_clean_sheet_streak"))
          return "Maintain 5 clean sheets in a row";
        return "Maintain clean sheet streaks";
      })(),
      image: "/achievements/clean-sheet-v2.jpeg",
      icon: Shield,
      type: "5_clean_sheet_streak",
      unlocked:
        userAchievements.includes("5_clean_sheet_streak") ||
        userAchievements.includes("10_clean_sheet_streak") ||
        userAchievements.includes("15_clean_sheet_streak"),
    },
    {
      labelText: "🧠",
      title: "Winning Streak Master",
      description: (() => {
        if (userAchievements.includes("15_win_streak")) return "Achieve 15 wins in a row";
        if (userAchievements.includes("10_win_streak")) return "Achieve 10 wins in a row";
        if (userAchievements.includes("5_win_streak")) return "Achieve 5 wins in a row";
        return "Achieve winning streaks";
      })(),
      image: "/achievements/win-streak-v2.jpeg",
      icon: Brain,
      type: "5_win_streak",
      unlocked:
        userAchievements.includes("5_win_streak") ||
        userAchievements.includes("10_win_streak") ||
        userAchievements.includes("15_win_streak"),
    },
  ];

  return allAchievements;
};
