import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { streamSSE } from "hono/streaming";
import type { HonoEnv } from "../middleware/context";
import { enforceAuthMiddleware } from "../middleware/auth";
import { eq, and } from "drizzle-orm";
import { aiConversation, aiUserSettings } from "../db/schema/ai-schema";
import { createChatStream } from "../services/ai/ai-service";

export const aiStreamRouter = new Hono<HonoEnv>().use("*", enforceAuthMiddleware).get(
	"/chat-stream",
	zValidator(
		"query",
		z.object({
			conversationId: z.string(),
		})
	),
	async (c) => {
		const { conversationId } = c.req.valid("query");
		const db = c.get("db");
		const auth = c.get("authentication");
		const env = c.env;
		const userId = auth.user.id;
		const encryptionKey = env.AI_ENCRYPTION_KEY;

		if (!encryptionKey) {
			return c.json({ error: "AI encryption key not configured" }, 500);
		}

		// Verify conversation belongs to user
		const conversation = await db
			.select({
				id: aiConversation.id,
				leagueId: aiConversation.leagueId,
			})
			.from(aiConversation)
			.where(and(eq(aiConversation.id, conversationId), eq(aiConversation.userId, userId)))
			.limit(1);

		if (conversation.length === 0) {
			return c.json({ error: "Conversation not found" }, 404);
		}

		// Get user settings
		const settings = await db
			.select({
				provider: aiUserSettings.provider,
				model: aiUserSettings.model,
				encryptedApiKey: aiUserSettings.encryptedApiKey,
			})
			.from(aiUserSettings)
			.where(eq(aiUserSettings.userId, userId))
			.limit(1);

		if (settings.length === 0) {
			return c.json({ error: "AI settings not configured" }, 400);
		}

		const s = settings[0];

		return streamSSE(c, async (stream) => {
			try {
				const chatStream = createChatStream({
					db,
					conversationId,
					encryptionKey,
					provider: s.provider as "openai" | "opencode",
					model: s.model,
					encryptedApiKey: s.encryptedApiKey,
					leagueId: conversation[0].leagueId,
					userName: auth.user.name,
				});

				for await (const event of chatStream) {
					if (event.type === "text" && event.content) {
						await stream.writeSSE({
							data: JSON.stringify({ type: "text", content: event.content }),
						});
					} else if (event.type === "tool_call") {
						await stream.writeSSE({
							data: JSON.stringify({
								type: "tool_call",
								toolName: event.toolName,
								toolArgs: event.toolArgs,
							}),
						});
					} else if (event.type === "tool_result") {
						await stream.writeSSE({
							data: JSON.stringify({
								type: "tool_result",
								toolName: event.toolName,
							}),
						});
					} else if (event.type === "chart" && event.chart) {
						await stream.writeSSE({
							data: JSON.stringify({
								type: "chart",
								chart: event.chart,
							}),
						});
					} else if (event.type === "error") {
						await stream.writeSSE({
							data: JSON.stringify({ type: "error", error: event.error }),
						});
					} else if (event.type === "done") {
						await stream.writeSSE({
							data: JSON.stringify({ type: "done" }),
						});
					}
				}
			} catch (err) {
				console.error("[AI Stream] Error:", err instanceof Error ? err.message : String(err));
				try {
					await stream.writeSSE({
						data: JSON.stringify({
							type: "error",
							error: err instanceof Error ? err.message : String(err),
						}),
					});
				} catch {
					// Stream already closed
				}
			}
		});
	}
);
