import { Hono } from "hono";

export { contextStorage } from "hono/context-storage";
export { SeasonSSE } from "./durable-objects/season-sse";

import { contextStorage } from "hono/context-storage";
import { getDb } from "./db";
import { user } from "./db/schema";
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
import { runBulkSeed, type SeedQueueMessage } from "./services/bulk-seed";
import { seedLeague, type SeedInput } from "./services/seed";
import { trpcServer } from "./trpc/server";

const app = new Hono<HonoEnv>()
	.use("*", contextStorage())
	.use("*", contextMiddleware)
	// Health check endpoint - also triggers auto-seed on first request
	.get("/api/health", async (c) => {
		const db = c.get("db");

		// Only auto-seed if AUTO_SEED_PREVIEW env var is set (preview environments only)
		const autoSeedEnabled = c.env.AUTO_SEED_PREVIEW === "true" || c.env.AUTO_SEED_PREVIEW === "1";
		let seedQueued = false;

		if (autoSeedEnabled) {
			// Check if database is empty (no users yet)
			const userCount = await db.$count(user);

			if (userCount === 0) {
				console.log("[Auto-Seed] Database empty, queueing seed...");
				// Queue seed request - 4 members, 15 matches for preview
				c.executionCtx.waitUntil(
					c.env.SEED_QUEUE.send({
						action: "bulk-seed",
						memberCount: 4,
						matchCount: 15,
					})
				);
				seedQueued = true;
			}
		}

		return c.json({
			status: "ok",
			autoSeed: autoSeedEnabled,
			seedQueued,
		});
	})
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

type QueueMessage = AchievementQueueMessage | SeedQueueMessage | SeedInput;

export default {
	fetch: app.fetch,
	async queue(batch: MessageBatch<QueueMessage>, env: Env) {
		const db = getDb(env.DB);
		for (const msg of batch.messages) {
			const body = msg.body;

			// Handle bulk-seed queue messages (auto-seed for preview environments)
			if ("action" in body && body.action === "bulk-seed") {
				try {
					console.log("[Seed Queue] Starting bulk seed:", {
						memberCount: body.memberCount,
						matchCount: body.matchCount,
					});
					const result = await runBulkSeed(db, {
						memberCount: body.memberCount,
						matchCount: body.matchCount,
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
			} else if ("leagueSlug" in body) {
				// Handle admin-triggered seed (from seed dialog)
				if (!env.SEED_ALLOWED) {
					console.warn("[Seed Queue] SEED_ALLOWED not set, skipping");
					msg.ack();
					return;
				}
				try {
					console.log("[Seed Queue] Starting admin seed:", {
						leagueName: body.leagueName,
						memberCount: body.memberCount,
						matchCount: body.matchCount,
					});
					const result = await seedLeague(db, body);
					console.log("[Seed Queue] Admin seed completed:", result);
					msg.ack();
				} catch (error) {
					console.error("[Seed Queue] Admin seed failed:", error);
					msg.ack(); // Don't retry - max_retries is 0 anyway
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
