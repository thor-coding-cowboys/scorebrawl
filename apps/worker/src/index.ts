import { Hono } from "hono";

export { contextStorage } from "hono/context-storage";
export { SeasonSSE } from "./durable-objects/season-sse";

import { contextStorage } from "hono/context-storage";
import { getDb } from "./db";
import { enforceAuthMiddleware } from "./middleware/auth";
import { contextMiddleware, type HonoEnv } from "./middleware/context";
import { authRouter } from "./routes/auth-router";
import { deviceRouter } from "./routes/device-router";
import { sseRouter } from "./routes/sse-router";
import userAssetsRouter from "./routes/user-assets-router";
import {
	calculateAchievements,
	type AchievementQueueMessage,
} from "./services/achievement-calculation";
import {
	runBulkSeed,
	type SeedQueueMessage,
} from "./services/bulk-seed";
import { trpcServer } from "./trpc/server";

const app = new Hono<HonoEnv>()
	.use("*", contextStorage())
	.use("*", contextMiddleware)
	.route("/api/auth", authRouter)
	.route("/api/device", deviceRouter)
	.route("/api/sse", sseRouter)
	.use("/api/user-assets/*", enforceAuthMiddleware)
	.route("/api/user-assets", userAssetsRouter)
	.use("/api/trpc/*", trpcServer)
	.use("*", async (c, next) => {
		// Device routes handle their own auth via API key
		if (c.req.path.startsWith("/api/device/") || c.req.path.startsWith("/api/device")) {
			return next();
		}
		return enforceAuthMiddleware(c, next);
	});

type QueueMessage = AchievementQueueMessage | SeedQueueMessage;

export default {
	fetch: app.fetch,
	async queue(batch: MessageBatch<QueueMessage>, env: Env) {
		const db = getDb(env.DB);
		for (const msg of batch.messages) {
			const body = msg.body;
			
			// Handle seed queue messages
			if ('action' in body && body.action === "bulk-seed") {
				try {
					console.log("[Seed Queue] Starting bulk seed:", { memberCount: body.memberCount, matchCount: body.matchCount });
					const result = await runBulkSeed(db, { 
						memberCount: body.memberCount, 
						matchCount: body.matchCount 
					});
					
					if (result.success) {
						console.log("[Seed Queue] Bulk seed completed:", result.stats);
						msg.ack();
					} else {
						console.error("[Seed Queue] Bulk seed failed:", result.message);
						msg.retry();
					}
				} catch (error) {
					console.error("[Seed Queue] Failed to process message:", error);
					msg.retry();
				}
			} else {
				// Handle achievement queue messages
				try {
					await calculateAchievements(db, (body as AchievementQueueMessage).seasonPlayerIds);
					msg.ack();
				} catch (error) {
					console.error("[Achievement Queue] Failed to process message:", error);
					msg.retry();
				}
			}
		}
	},
};
