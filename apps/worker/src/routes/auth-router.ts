import { Hono } from "hono";
import type { HonoEnv } from "../middleware/context";

export const authRouter = new Hono<{
	Bindings: HonoEnv["Bindings"];
	Variables: HonoEnv["Variables"];
}>({
	strict: false,
}).on(["POST", "GET"], "/*", (c) => c.get("betterAuth").handler(c.req.raw));
