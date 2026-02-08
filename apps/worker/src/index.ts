import { Hono } from "hono";

export { contextStorage } from "hono/context-storage";
export { SeasonSSE } from "./durable-objects/season-sse";

import { contextStorage } from "hono/context-storage";
import { enforceAuthMiddleware } from "./middleware/auth";
import { contextMiddleware, type HonoEnv } from "./middleware/context";
import { authRouter } from "./routes/auth-router";
import { sseRouter } from "./routes/sse-router";
import userAssetsRouter from "./routes/user-assets-router";
import { trpcServer } from "./trpc/server";

const app = new Hono<HonoEnv>()
	.use("*", contextStorage())
	.use("*", contextMiddleware)
	.route("/api/auth", authRouter)
	.route("/api/sse", sseRouter)
	.use("/api/user-assets/*", enforceAuthMiddleware)
	.route("/api/user-assets", userAssetsRouter)
	.use("/api/trpc/*", trpcServer)
	.use("*", enforceAuthMiddleware);

export default app;
