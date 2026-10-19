import { Hono } from "hono";
import type { HonoEnv } from "../middleware/context";
import { sessionsV1Router } from "./sessions-v1";

export const leagueRouter = new Hono<HonoEnv>()
	.route("/sessions", sessionsV1Router)
	.route("/:leagueId/sessions", sessionsV1Router);
