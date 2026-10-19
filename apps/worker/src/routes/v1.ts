import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { describeRoute } from "hono-openapi";
import { asc, eq } from "drizzle-orm";
import type { HonoEnv } from "../middleware/context";
import { league, member, user } from "../db/schema/auth-schema";
import { requirePersonalApiKeyScope } from "./api-key-auth";
import { apiKeySecurity, apiResponses, jsonResponse } from "../public-api/openapi/responses";
import { listLeaguesResponseSchema, meResponseSchema } from "../public-api/schemas/v1";

export const v1Router = new Hono<HonoEnv>()
	.get(
		"/me",
		describeRoute({
			summary: "Get the calling user",
			description:
				"Returns the user the personal API key belongs to. Requires a personal API key with `profile:read`.",
			tags: ["Personal"],
			security: apiKeySecurity,
			responses: apiResponses(
				{ 200: jsonResponse("The calling user", meResponseSchema) },
				{ auth: "personal" }
			),
		}),
		requirePersonalApiKeyScope({ profile: ["read"] }),
		async (c) => {
			const userId = c.get("personalApiKey")?.userId;
			if (!userId) {
				throw new HTTPException(401, { res: c.json({ error: "invalid_api_key" }, 401) });
			}
			const [me] = await c
				.get("db")
				.select({ id: user.id, name: user.name, email: user.email })
				.from(user)
				.where(eq(user.id, userId))
				.limit(1);
			if (!me) {
				throw new HTTPException(401, { res: c.json({ error: "invalid_api_key" }, 401) });
			}
			return c.json(meResponseSchema.parse({ user: me }));
		}
	)
	.get(
		"/leagues",
		describeRoute({
			summary: "List the calling user's leagues",
			description:
				"Returns every league the user is a member of, with the user's role. Requires a personal API key with `league:read`.",
			tags: ["Personal"],
			security: apiKeySecurity,
			responses: apiResponses(
				{ 200: jsonResponse("The user's leagues", listLeaguesResponseSchema) },
				{ auth: "personal" }
			),
		}),
		requirePersonalApiKeyScope({ league: ["read"] }),
		async (c) => {
			const userId = c.get("personalApiKey")?.userId;
			if (!userId) {
				throw new HTTPException(401, { res: c.json({ error: "invalid_api_key" }, 401) });
			}
			const leagues = await c
				.get("db")
				.select({ id: league.id, name: league.name, slug: league.slug, role: member.role })
				.from(member)
				.innerJoin(league, eq(league.id, member.organizationId))
				.where(eq(member.userId, userId))
				.orderBy(asc(league.name));
			return c.json(listLeaguesResponseSchema.parse({ leagues }));
		}
	);
