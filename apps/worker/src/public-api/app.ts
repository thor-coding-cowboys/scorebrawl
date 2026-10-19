import { Hono } from "hono";
import { cors } from "hono/cors";
import type { HonoEnv } from "../middleware/context";
import { leagueRouter } from "../routes/league-router";
import { v1Router } from "../routes/v1";
import { publicApiErrorHandler } from "./error-handler";
import { generatePublicApiSpec } from "./openapi";

/**
 * Public API surface (`/v1` and `/leagues/v1`), mounted as a sub-app so its
 * error handling does not leak into tRPC, MCP, or the web app routes.
 */
export const publicApiApp = new Hono<HonoEnv>()
	.onError(publicApiErrorHandler)
	.get("/v1/openapi.json", cors({ origin: "*" }), async (c) =>
		c.json(await generatePublicApiSpec())
	)
	.route("/v1", v1Router)
	.route("/leagues/v1", leagueRouter);
