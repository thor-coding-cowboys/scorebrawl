import { Hono } from "hono";
import { cors } from "hono/cors";
import { eq } from "drizzle-orm";

export { contextStorage } from "hono/context-storage";
export { SeasonSSE } from "./durable-objects/season-sse";

import { contextStorage } from "hono/context-storage";
import { getDb } from "./db";
import { league } from "./db/schema/auth-schema";
import { enforceAuthMiddleware } from "./middleware/auth";
import { contextMiddleware, type HonoEnv } from "./middleware/context";
import { authRouter } from "./routes/auth-router";
import { leaguesV1Router } from "./routes/leagues-v1";
import { mcpRouter } from "./routes/mcp-router";
import { matchesV1Router } from "./routes/matches-v1";
import { sseRouter, broadcastSeasonEvent } from "./routes/sse-router";
import { userAssetsRouter } from "./routes/user-assets-router";
import {
	calculateAchievements,
	buildAchievementUnlockEvents,
	type AchievementQueueMessage,
} from "./services/achievement-calculation";
import { sendLeaguePush } from "./services/push-notification";
import { seedLeague, type SeedInput } from "./services/seed";
import { achievementUnlocked } from "./services/notification-events";
import { trpcServer } from "./trpc/server";

const app = new Hono<HonoEnv>()
	.use("*", contextStorage())
	.use("*", contextMiddleware)
	.use(
		"/api/*",
		cors({
			origin: (origin) => {
				if (!origin) return origin;
				const { hostname } = new URL(origin);
				return hostname === "localhost" || hostname.endsWith(".localhost") ? origin : undefined;
			},
			credentials: true,
		})
	)
	.get("/api/version", (c) => {
		const version = c.env.VERSION || "local";
		return c.json({ version });
	})
	.route("/api/auth", authRouter)
	.route("/api/sse", sseRouter)
	.route("/api/v1/leagues/:leagueId/seasons/:seasonId/matches", matchesV1Router)
	.route("/api/v1/leagues", leaguesV1Router)
	.use("/api/user-assets/*", enforceAuthMiddleware)
	.route("/api/user-assets", userAssetsRouter)
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
					const newAchievements = await calculateAchievements(db, body.seasonPlayerIds);
					for (const event of buildAchievementUnlockEvents(newAchievements)) {
						await broadcastSeasonEvent(env, body.leagueSlug, body.seasonSlug, event);
					}

					if (newAchievements.length > 0) {
						const [leagueRow] = await db
							.select({ id: league.id })
							.from(league)
							.where(eq(league.slug, body.leagueSlug))
							.limit(1);

						if (leagueRow) {
							await sendLeaguePush({
								db,
								organizationId: leagueRow.id,
								events: newAchievements.map((achievement) =>
									achievementUnlocked(
										{
											type: "achievement:unlock",
											leagueSlug: body.leagueSlug,
											seasonSlug: body.seasonSlug,
											playerId: achievement.playerId,
										},
										{ playerName: achievement.name, achievementType: achievement.type }
									)
								),
							});
						}
					}
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
