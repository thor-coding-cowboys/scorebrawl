import { and, eq, inArray, isNotNull, ne } from "drizzle-orm";
import type { DrizzleDB } from "../db";
import { member } from "../db/schema/auth-schema";
import { player, seasonPlayer, sessionPlayer } from "../db/schema/league-schema";
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
	type NotificationPreferenceRow,
	type NotificationPreferenceKey,
} from "./notification-preferences";

const EVENT_PREFERENCE: Record<NotificationEventType, NotificationPreferenceKey> = {
	"session:start": "notifySessionStarted",
	"session:teams": "notifyTeamsFormed",
	"match:recorded": "notifyMatchRecorded",
	"achievement:unlock": "notifyAchievementUnlocked",
	streak: "notifyStreakReached",
};

export function selectEligibleEventsByUser(
	recipientIds: string[],
	prefs: NotificationPreferenceRow[],
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

export async function sendPushToUserIds({
	db,
	userIds,
	events,
}: {
	db: DrizzleDB;
	userIds: string[];
	events: PushEvent[];
}): Promise<void> {
	if (events.length === 0 || userIds.length === 0) return;

	try {
		const recipientIds = [...new Set(userIds)];

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
				threadId: event.payload.type,
			}))
		);

		await sendExpoPushMessages(db, messages);
	} catch (error) {
		console.error("[Push] sendPushToUserIds failed", error);
	}
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

		await sendPushToUserIds({ db, userIds: members.map((m) => m.userId), events });
	} catch (error) {
		console.error("[Push] sendLeaguePush failed", error);
	}
}

export async function sendSessionPush({
	db,
	sessionId,
	events,
}: {
	db: DrizzleDB;
	sessionId: string;
	events: PushEvent[];
}): Promise<void> {
	if (events.length === 0) return;

	try {
		const recipients = await db
			.selectDistinct({ userId: player.userId })
			.from(sessionPlayer)
			.innerJoin(seasonPlayer, eq(sessionPlayer.seasonPlayerId, seasonPlayer.id))
			.innerJoin(player, eq(seasonPlayer.playerId, player.id))
			.where(
				and(
					eq(sessionPlayer.sessionId, sessionId),
					ne(sessionPlayer.status, "out"),
					isNotNull(player.userId)
				)
			);

		await sendPushToUserIds({
			db,
			userIds: recipients
				.map((recipient) => recipient.userId)
				.filter((userId): userId is string => userId !== null),
			events,
		});
	} catch (error) {
		console.error("[Push] sendSessionPush failed", error);
	}
}
