import { createMiddleware } from "hono/factory";
import { and, eq } from "drizzle-orm";
import type { HonoEnv } from "../middleware/context";
import { league, member } from "../db/schema/auth-schema";

function hasRequiredPermissions(
	permissions: Record<string, string[]>,
	required: Record<string, string[]>
) {
	return Object.entries(required).every(([resource, actions]) =>
		actions.every((action) => permissions[resource]?.includes(action))
	);
}

export function requireApiKeyScope(required: Record<string, string[]>) {
	return createMiddleware<HonoEnv>(async (c, next) => {
		const auth = c.get("betterAuth");
		const db = c.get("db");
		const key =
			c.req.header("x-api-key") ?? c.req.header("authorization")?.replace(/^Bearer /i, "");
		if (!key) {
			return c.json({ error: "missing_api_key" }, 401);
		}
		const result = await auth.api.verifyApiKey({ body: { key } });
		if (!result.valid || !result.key) {
			if (result.error?.code?.includes("RATE_LIMIT")) {
				return c.json(
					{
						error: "rate_limited",
						error_description: result.error.message ?? null,
					},
					429
				);
			}
			return c.json(
				{
					error: "invalid_api_key",
					error_description: result.error?.message ?? null,
				},
				401
			);
		}
		const permissions = (result.key.permissions ?? {}) as Record<string, string[]>;
		if (!hasRequiredPermissions(permissions, required)) {
			return c.json({ error: "insufficient_scope" }, 403);
		}
		const leagueId = c.req.param("leagueId");
		if (result.key.referenceId !== leagueId) {
			return c.json({ error: "wrong_league" }, 403);
		}
		const [org] = await db
			.select({ id: league.id, slug: league.slug, name: league.name })
			.from(league)
			.where(eq(league.id, leagueId))
			.limit(1);
		if (!org) {
			return c.json({ error: "league_not_found" }, 404);
		}
		const metadata = (result.key.metadata ?? {}) as { createdByUserId?: string };
		const createdByUserId = metadata.createdByUserId;
		if (!createdByUserId) {
			return c.json({ error: "invalid_api_key" }, 401);
		}
		const [creatorMember] = await db
			.select({ role: member.role })
			.from(member)
			.where(and(eq(member.organizationId, leagueId), eq(member.userId, createdByUserId)))
			.limit(1);
		if (!creatorMember || creatorMember.role !== "owner") {
			return c.json({ error: "key_owner_not_owner" }, 403);
		}
		c.set("apiKey", {
			keyId: result.key.id,
			organizationId: result.key.referenceId,
			userId: createdByUserId,
			keyName: result.key.name ?? "API Key",
			organization: { id: org.id, slug: org.slug, name: org.name },
			permissions,
		});
		await next();
	});
}
