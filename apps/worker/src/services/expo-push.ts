import { inArray } from "drizzle-orm";
import { z } from "zod";
import type { DrizzleDB } from "../db";
import { pushToken } from "../db/schema/user-preferences-schema";
import type { NotificationPayload } from "./notification-payload";

export type ExpoPushMessage = {
	to: string;
	title: string;
	body: string;
	data: NotificationPayload;
	sound: "default";
};

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const BATCH_SIZE = 100;

const expoTicketSchema = z.object({
	status: z.string(),
	details: z.object({ error: z.string().optional() }).optional(),
});

const expoResponseSchema = z.object({
	data: z.array(expoTicketSchema).optional(),
});

export async function sendExpoPushMessages(
	db: DrizzleDB,
	messages: ExpoPushMessage[]
): Promise<void> {
	if (messages.length === 0) return;

	const batches: ExpoPushMessage[][] = [];
	for (let i = 0; i < messages.length; i += BATCH_SIZE) {
		batches.push(messages.slice(i, i + BATCH_SIZE));
	}

	const results = await Promise.allSettled(batches.map((batch) => sendBatch(db, batch)));
	for (const result of results) {
		if (result.status === "rejected") {
			console.error("[Push] batch failed", result.reason);
		}
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

	const parsed = expoResponseSchema.safeParse(await response.json());
	if (!parsed.success || !parsed.data.data) return;

	const staleTokens = parsed.data.data.flatMap((ticket, index) => {
		const message = batch[index];
		if (!message) return [];
		return ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered"
			? [message.to]
			: [];
	});

	if (staleTokens.length > 0) {
		await db.delete(pushToken).where(inArray(pushToken.token, staleTokens));
	}
}
