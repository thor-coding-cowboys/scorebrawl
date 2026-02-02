import { z } from "zod";
import { LeagueAchievementType } from "./achievement";

export const notificationType = ["achievement"] as const;

export const NotificationType = z.enum(notificationType);

export const LeagueAchievementNotificationData = z.object({
  leagueAchievementType: LeagueAchievementType,
});
export const NotificationData = LeagueAchievementNotificationData;
