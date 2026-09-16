import { eq, inArray } from "drizzle-orm";
import type { DrizzleDB } from "../db";
import { member } from "../db/schema/auth-schema";
import {
	defaultNotificationPreferences,
	pushToken,
	userPreference,
} from "../db/schema/user-preferences-schema";
import { type ExpoPushMessage, sendExpoPushMessages } from "./expo-push";
import type { PushEvent } from "./notification-events";
import type { NotificationEventType } from "./notification-payload";
import {
	NOTIFICATION_PREFERENCE_COLUMNS,
	type NotificationPrefs,
	type NotificationPreferenceKey,
} from "./notification-preferences";

const EVENT_PREFERENCE: Record<NotificationEventType, NotificationPreferenceKey> = {
	"session:start": "notifySessionStarted",
	"match:recorded": "notifyMatchRecorded",
	"achievement:unlock": "notifyAchievementUnlocked",
	streak: "notifyStreakReached",
};

export function selectEligibleEventsByUser(
	recipientIds: string[],
	prefs: Array<NotificationPrefs & { userId: string }>,
	events: PushEvent[]
): Map<string, PushEvent[]> {
	const prefsMap = new Map(prefs.map((pref) => [pref.userId, pref]));

	const eligibleEventsByUser = new Map<string, PushEvent[]>();
	for (const userId of recipientIds) {
		const pref = prefsMap.get(userId) ?? defaultNotificationPreferences;
		if (!pref.pushEnabled) continue;
		const eligible = events.filter(
			(event) => userId !== event.excludeUserId && pref[EVENT_PREFERENCE[event.payload.type]]
		);
		if (eligible.length > 0) eligibleEventsByUser.set(userId, eligible);
	}

	return eligibleEventsByUser;
}

export async function sendLeaguePush({
	db,
	organizationId,
	events,
}: {
	db: DrizzleDB;
	organizationId: string;
	events: PushEvent[];
}): Promise<void> {
	if (events.length === 0) return;

	try {
		const members = await db
			.select({ userId: member.userId })
			.from(member)
			.where(eq(member.organizationId, organizationId));

		const recipientIds = members.map((m) => m.userId);

		if (recipientIds.length === 0) return;

		const prefs = await db
			.select({ userId: userPreference.userId, ...NOTIFICATION_PREFERENCE_COLUMNS })
			.from(userPreference)
			.where(inArray(userPreference.userId, recipientIds));

		const eligibleEventsByUser = selectEligibleEventsByUser(recipientIds, prefs, events);

		if (eligibleEventsByUser.size === 0) return;

		const tokens = await db
			.select({ token: pushToken.token, userId: pushToken.userId })
			.from(pushToken)
			.where(inArray(pushToken.userId, [...eligibleEventsByUser.keys()]));

		if (tokens.length === 0) return;

		const messages: ExpoPushMessage[] = tokens.flatMap(({ token, userId }) =>
			(eligibleEventsByUser.get(userId) ?? []).map((event) => ({
				to: token,
				title: event.title,
				body: event.body,
				data: event.payload,
				sound: "default" as const,
			}))
		);

		await sendExpoPushMessages(db, messages);
	} catch (error) {
		console.error("[Push] sendLeaguePush failed", error);
	}
}
