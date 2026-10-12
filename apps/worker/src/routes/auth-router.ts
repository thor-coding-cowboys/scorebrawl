import { Hono } from "hono";
import type { HonoEnv } from "../middleware/context";

export const authRouter = new Hono<{
	Bindings: HonoEnv["Bindings"];
	Variables: HonoEnv["Variables"];
}>({
	strict: false,
}).all("/*", async (c) => {
	if (c.req.path.includes("/api-key")) {
		return c.json({ error: "not_found" }, 404);
	}
	return c.get("betterAuth").handler(c.req.raw);
});
