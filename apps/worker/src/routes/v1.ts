import { Hono } from "hono";
import { asc, eq } from "drizzle-orm";
import type { HonoEnv } from "../middleware/context";
import { league, member, user } from "../db/schema/auth-schema";
import { requirePersonalApiKeyScope } from "./api-key-auth";

export const v1Router = new Hono<HonoEnv>();

v1Router.get("/me", requirePersonalApiKeyScope({ profile: ["read"] }), async (c) => {
	const userId = c.get("personalApiKey")?.userId;
	if (!userId) return c.json({ error: "invalid_api_key" }, 401);
	const [me] = await c
		.get("db")
		.select({ id: user.id, name: user.name, email: user.email })
		.from(user)
		.where(eq(user.id, userId))
		.limit(1);
	if (!me) return c.json({ error: "invalid_api_key" }, 401);
	return c.json({ user: me });
});

v1Router.get("/leagues", requirePersonalApiKeyScope({ league: ["read"] }), async (c) => {
	const userId = c.get("personalApiKey")?.userId;
	if (!userId) return c.json({ error: "invalid_api_key" }, 401);
	const leagues = await c
		.get("db")
		.select({ id: league.id, name: league.name, slug: league.slug, role: member.role })
		.from(member)
		.innerJoin(league, eq(league.id, member.organizationId))
		.where(eq(member.userId, userId))
		.orderBy(asc(league.name));
	return c.json({ leagues });
});
