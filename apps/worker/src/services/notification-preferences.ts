import {
	defaultNotificationPreferences,
	userPreference,
} from "../db/schema/user-preferences-schema";

export const NOTIFICATION_PREFERENCE_COLUMNS = {
	pushEnabled: userPreference.pushEnabled,
	notifySessionStarted: userPreference.notifySessionStarted,
	notifyMatchRecorded: userPreference.notifyMatchRecorded,
	notifyAchievementUnlocked: userPreference.notifyAchievementUnlocked,
	notifyStreakReached: userPreference.notifyStreakReached,
} as const;

export type NotificationPreferenceKey = keyof typeof NOTIFICATION_PREFERENCE_COLUMNS;

export type NotificationPrefs = typeof defaultNotificationPreferences;

export type NotificationPreferenceRow = NotificationPrefs & { userId: string };
