import { Hono } from "hono";

export { contextStorage } from "hono/context-storage";

import { contextStorage } from "hono/context-storage";
import { enforceAuthMiddleware } from "./middleware/auth";
import { contextMiddleware, type HonoEnv } from "./middleware/context";
import { authRouter } from "./routes/auth-router";
import { trpcServer } from "./trpc/server";

const app = new Hono<HonoEnv>()
	.use("*", contextStorage())
	.use("*", contextMiddleware)
	.route("/api/auth", authRouter)
	.use("/api/trpc/*", trpcServer)
	.use("*", enforceAuthMiddleware);

export default app;
