import { createAchievement } from "@/db/repositories/achievement-repository";
import { findLeaguePlayerIds } from "@/db/repositories/league-player-repository";
import {
  getGoalsConcededAgainst,
  getLastFiveMatchesGoals,
  getPlayerMatches,
} from "@/db/repositories/season-player-repository";
import type { LeagueAchievementType, leagueAchievementType } from "@/model";
import { task } from "@trigger.dev/sdk/v3";
import type { z } from "zod";

type AchievementCalculationTaskInput = {
  seasonPlayerIds: string[];
};

type MatchLeagueAchievement = (typeof leagueAchievementType)[number];

type PartialRecord<K extends string | number | symbol, T> = {
  [P in K]?: T;
};

const achievements: PartialRecord<MatchLeagueAchievement, number> = {
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

export const achievementCalculationTask = task({
  id: "achivement-calculations",
  run: async ({ seasonPlayerIds }: AchievementCalculationTaskInput /*{ctx}*/) => {
    const playerAchievementsMap: Record<string, z.output<typeof LeagueAchievementType>[]> = {};

    for (const seasonPlayerId of seasonPlayerIds) {
      const playerAchievements: z.output<typeof LeagueAchievementType>[] = [];
      const seasonPlayerMatches = await getPlayerMatches({ seasonPlayerId });

      checkRedemptionAchievement(playerAchievements, seasonPlayerMatches);

      const lastFiveMatchesGoals = await getLastFiveMatchesGoals(seasonPlayerId);
      checkGoalsScoredStreak(playerAchievements, lastFiveMatchesGoals);

      let currentWinStreak = 0;
      let currentCleanSheetStreak = 0;
      let maxLossStreak = 0;
      let currentLossStreak = 0;

      const goalsConcededAgainst = await getGoalsConcededAgainst({
        seasonPlayerId,
        matchIds: seasonPlayerMatches.map((m) => m.matchId),
      });

      const matches = seasonPlayerMatches.map((match) => {
        const goalsFromMatch = goalsConcededAgainst.find((mg) => mg.matchId === match.matchId);
        return { ...match, ...goalsFromMatch };
      });
      for (const match of matches) {
        // Update win/loss streaks
        if (match.result === "W") {
          currentWinStreak++;
          currentLossStreak = 0;
        } else if (match.result === "L") {
          currentLossStreak++;
          currentWinStreak = 0;
          maxLossStreak = currentLossStreak > maxLossStreak ? currentLossStreak : maxLossStreak;
        } else {
          currentWinStreak = 0;
          currentLossStreak = 0;
        }

        // Check for win streaks
        checkStreakAchievement(playerAchievements, currentWinStreak, [
          "5_win_streak",
          "10_win_streak",
          "15_win_streak",
        ]);

        // Update and check clean sheet streak
        if (match.goalsConceded === 0) {
          currentCleanSheetStreak++;
          checkStreakAchievement(playerAchievements, currentCleanSheetStreak, [
            "5_clean_sheet_streak",
            "10_clean_sheet_streak",
            "15_clean_sheet_streak",
          ]);
        } else {
          currentCleanSheetStreak = 0;
        }
      }
      playerAchievementsMap[seasonPlayerId] = playerAchievements;
    }
    const playerIds = await findLeaguePlayerIds(Object.keys(playerAchievementsMap));
    for (const seasonPlayerId of Object.keys(playerAchievementsMap)) {
      const player = playerIds.find((p) => p.seasonPlayerId === seasonPlayerId);
      if (player) {
        const playerAchievements = playerAchievementsMap[seasonPlayerId] ?? [];
        for (const achievement of playerAchievements) {
          await createAchievement({
            leaguePlayerId: player.leaguePlayerId,
            type: achievement,
          });
        }
      }
    }
    return playerAchievementsMap;
  },
});

const checkGoalsScoredStreak = (
  playerAchievements: z.output<typeof LeagueAchievementType>[],
  lastFiveMatchesGoals: number[],
) => {
  if (lastFiveMatchesGoals.length > 4) {
    if (lastFiveMatchesGoals.every((n) => n >= 8)) {
      playerAchievements.push("8_goals_5_games");
      playerAchievements.push("5_goals_5_games");
      playerAchievements.push("3_goals_5_games");
    } else if (lastFiveMatchesGoals.every((n) => n >= 5)) {
      playerAchievements.push("5_goals_5_games");
      playerAchievements.push("3_goals_5_games");
    } else if (lastFiveMatchesGoals.every((n) => n >= 3)) {
      playerAchievements.push("3_goals_5_games");
    }
  }
};

const checkStreakAchievement = (
  playerAchievements: z.output<typeof LeagueAchievementType>[],
  currentStreak: number,
  streakAchievements: z.output<typeof LeagueAchievementType>[],
): void => {
  for (const achievement of streakAchievements) {
    if (currentStreak === achievements[achievement] && !playerAchievements.includes(achievement)) {
      playerAchievements.push(achievement);
    }
  }
};

const checkRedemptionAchievement = (
  playerAchievements: z.output<typeof LeagueAchievementType>[],
  seasonPlayerMatches: Awaited<ReturnType<typeof getPlayerMatches>>,
): void => {
  const resultString = seasonPlayerMatches.map((m) => m.result).join("");
  const generateLossWinString = (redemptionCount: number) =>
    "W".repeat(redemptionCount) + "L".repeat(redemptionCount);

  const winLossRedemptionAchievements: MatchLeagueAchievement[] = [
    "3_win_loss_redemption",
    "5_win_loss_redemption",
    "8_win_loss_redemption",
  ];
  for (const achievement of winLossRedemptionAchievements) {
    const redemptionCount = achievements[achievement];
    if (redemptionCount && resultString.includes(generateLossWinString(redemptionCount))) {
      playerAchievements.push(achievement);
    }
  }
};
