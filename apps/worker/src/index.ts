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

export default {
	fetch: app.fetch,
	async queue(batch: MessageBatch<AchievementQueueMessage>, env: Env) {
		const db = getDb(env.DB);
		for (const msg of batch.messages) {
			try {
				await calculateAchievements(db, msg.body.seasonPlayerIds);
				msg.ack();
			} catch (error) {
				console.error("[Achievement Queue] Failed to process message:", error);
				msg.retry();
			}
		}
	},
};
