import { Hono } from "hono";

export { contextStorage } from "hono/context-storage";
export { SeasonSSE } from "./durable-objects/season-sse";

import { contextStorage } from "hono/context-storage";
import { getDb } from "./db";
import { enforceAuthMiddleware } from "./middleware/auth";
import { contextMiddleware, type HonoEnv } from "./middleware/context";
import { aiStreamRouter } from "./routes/ai-stream";
import { authRouter } from "./routes/auth-router";
import { mcpAuthRouter } from "./routes/mcp-auth-router";
import { mcpRouter } from "./routes/mcp-router";
import { sseRouter } from "./routes/sse-router";
import { userAssetsRouter } from "./routes/user-assets-router";
import {
	calculateAchievements,
	type AchievementQueueMessage,
} from "./services/achievement-calculation";
import { seedLeague, type SeedInput } from "./services/seed";
import { trpcServer } from "./trpc/server";

const app = new Hono<HonoEnv>()
	.use("*", contextStorage())
	.use("*", contextMiddleware)
	.get("/api/version", (c) => {
		const version = c.env.VERSION || "local";
		return c.json({ version });
	})
	.route("/api/auth", authRouter)
	.route("/api/sse", sseRouter)
	.use("/api/user-assets/*", enforceAuthMiddleware)
	.route("/api/user-assets", userAssetsRouter)
	.use("/api/ai/*", enforceAuthMiddleware)
	.route("/api/ai", aiStreamRouter)
	.route("/api/mcp-auth", mcpAuthRouter)
	.use("/api/mcp/*", enforceAuthMiddleware)
	.route("/api/mcp", mcpRouter)
	.use("/api/trpc/*", trpcServer)
	.use("*", async (c, next) => {
		return enforceAuthMiddleware(c, next);
	});

export default {
	fetch: app.fetch,
	async queue(batch: MessageBatch<AchievementQueueMessage | SeedInput>, env: Env) {
		const db = getDb(env.DB);
		for (const msg of batch.messages) {
			try {
				const body = msg.body;
				if ("seasonPlayerIds" in body) {
					await calculateAchievements(db, body.seasonPlayerIds);
				} else if ("leagueSlug" in body) {
					if (!env.SEED_ALLOWED) {
						console.warn("[Seed Queue] SEED_ALLOWED not set, skipping seed job");
						msg.ack();
						continue;
					}
					await seedLeague(db, body);
				}
				msg.ack();
			} catch (error) {
				console.error("[Queue] Failed to process message:", error);
				msg.retry();
			}
		}
	},
};
