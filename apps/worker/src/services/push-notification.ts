import { eq, inArray } from "drizzle-orm";
import type { DrizzleDB } from "../db";
import { member } from "../db/schema/auth-schema";
import { pushToken, userPreference } from "../db/schema/user-preferences-schema";

export type PushEventType = "session:start" | "match:recorded" | "achievement:unlock" | "streak";

export type PushEvent = {
	type: PushEventType;
	title: string;
	body: string;
	data: Record<string, string>;
};

type NotificationPrefs = {
	pushEnabled: boolean;
	notifySessionStarted: boolean;
	notifyMatchRecorded: boolean;
	notifyAchievementUnlocked: boolean;
	notifyStreakReached: boolean;
};

const DEFAULT_PREFS: NotificationPrefs = {
	pushEnabled: true,
	notifySessionStarted: true,
	notifyMatchRecorded: true,
	notifyAchievementUnlocked: true,
	notifyStreakReached: true,
};

const EVENT_PREFERENCE: Record<PushEventType, keyof NotificationPrefs> = {
	"session:start": "notifySessionStarted",
	"match:recorded": "notifyMatchRecorded",
	"achievement:unlock": "notifyAchievementUnlocked",
	streak: "notifyStreakReached",
};

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const BATCH_SIZE = 100;

type ExpoPushMessage = {
	to: string;
	title: string;
	body: string;
	data: Record<string, string>;
	sound: "default";
};

export async function sendLeaguePush({
	db,
	organizationId,
	excludeUserId,
	events,
}: {
	db: DrizzleDB;
	organizationId: string;
	excludeUserId?: string;
	events: PushEvent[];
}): Promise<void> {
	if (events.length === 0) return;

	try {
		const members = await db
			.select({ userId: member.userId })
			.from(member)
			.where(eq(member.organizationId, organizationId));

		const recipientIds = members.map((m) => m.userId).filter((userId) => userId !== excludeUserId);

		if (recipientIds.length === 0) return;

		const prefs = await db
			.select({
				userId: userPreference.userId,
				pushEnabled: userPreference.pushEnabled,
				notifySessionStarted: userPreference.notifySessionStarted,
				notifyMatchRecorded: userPreference.notifyMatchRecorded,
				notifyAchievementUnlocked: userPreference.notifyAchievementUnlocked,
				notifyStreakReached: userPreference.notifyStreakReached,
			})
			.from(userPreference)
			.where(inArray(userPreference.userId, recipientIds));

		const prefsMap = new Map(prefs.map((pref) => [pref.userId, pref]));

		const eligibleEventsByUser = new Map<string, PushEvent[]>();
		for (const userId of recipientIds) {
			const pref = prefsMap.get(userId) ?? DEFAULT_PREFS;
			if (!pref.pushEnabled) continue;
			const eligible = events.filter((event) => pref[EVENT_PREFERENCE[event.type]]);
			if (eligible.length > 0) eligibleEventsByUser.set(userId, eligible);
		}

		if (eligibleEventsByUser.size === 0) return;

		const tokens = await db
			.select({ token: pushToken.token, userId: pushToken.userId })
			.from(pushToken)
			.where(inArray(pushToken.userId, [...eligibleEventsByUser.keys()]));

		if (tokens.length === 0) return;

		const messages: ExpoPushMessage[] = [];
		for (const { token, userId } of tokens) {
			for (const event of eligibleEventsByUser.get(userId) ?? []) {
				messages.push({
					to: token,
					title: event.title,
					body: event.body,
					data: event.data,
					sound: "default",
				});
			}
		}

		const batches: ExpoPushMessage[][] = [];
		for (let i = 0; i < messages.length; i += BATCH_SIZE) {
			batches.push(messages.slice(i, i + BATCH_SIZE));
		}
		await Promise.allSettled(batches.map((batch) => sendBatch(db, batch)));
	} catch (error) {
		console.error("[Push] sendLeaguePush failed", error);
	}
}

async function sendBatch(db: DrizzleDB, batch: ExpoPushMessage[]): Promise<void> {
	const response = await fetch(EXPO_PUSH_URL, {
		method: "POST",
		headers: {
			Accept: "application/json",
			"Accept-Encoding": "gzip, deflate",
			"Content-Type": "application/json",
		},
		body: JSON.stringify(batch),
		signal: AbortSignal.timeout(10_000),
	});

	if (!response.ok) {
		console.error("[Push] Expo push API error", response.status, await response.text());
		return;
	}

	const result = (await response.json()) as {
		data?: Array<{ status: string; details?: { error?: string } }>;
	};

	if (!result.data) return;

	const staleTokens: string[] = [];
	result.data.forEach((ticket, index) => {
		if (ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered") {
			staleTokens.push(batch[index].to);
		}
	});

	if (staleTokens.length > 0) {
		await db.delete(pushToken).where(inArray(pushToken.token, staleTokens));
	}
}
