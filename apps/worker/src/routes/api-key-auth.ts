import { createMiddleware } from "hono/factory";
import { and, eq } from "drizzle-orm";
import { defaultKeyHasher } from "@better-auth/api-key";
import type { HonoEnv } from "../middleware/context";
import { apikey, league, member } from "../db/schema/auth-schema";
import { PERSONAL_API_KEY_CONFIG_ID } from "../lib/better-auth";

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
		const [stored] = await db
			.select({ referenceId: apikey.referenceId, slug: league.slug, name: league.name })
			.from(apikey)
			.innerJoin(league, eq(league.id, apikey.referenceId))
			.where(eq(apikey.key, await defaultKeyHasher(key)))
			.limit(1);
		if (!stored) {
			return c.json({ error: "invalid_api_key", error_description: null }, 401);
		}
		const pathLeagueId = c.req.param("leagueId");
		if (pathLeagueId !== undefined && stored.referenceId !== pathLeagueId) {
			return c.json({ error: "wrong_league" }, 403);
		}
		const leagueId = stored.referenceId;
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
			organizationId: leagueId,
			userId: createdByUserId,
			keyName: result.key.name ?? "API Key",
			organization: { id: leagueId, slug: stored.slug, name: stored.name },
			permissions,
		});
		await next();
	});
}

export function requirePersonalApiKeyScope(required: Record<string, string[]>) {
	return createMiddleware<HonoEnv>(async (c, next) => {
		const key =
			c.req.header("x-api-key") ?? c.req.header("authorization")?.replace(/^Bearer /i, "");
		if (!key) {
			return c.json({ error: "missing_api_key" }, 401);
		}
		const result = await c
			.get("betterAuth")
			.api.verifyApiKey({ body: { key, configId: PERSONAL_API_KEY_CONFIG_ID } });
		if (!result.valid || !result.key) {
			if (result.error?.code?.includes("RATE_LIMIT")) {
				return c.json(
					{ error: "rate_limited", error_description: result.error.message ?? null },
					429
				);
			}
			return c.json(
				{ error: "invalid_api_key", error_description: result.error?.message ?? null },
				401
			);
		}
		const permissions = (result.key.permissions ?? {}) as Record<string, string[]>;
		if (!hasRequiredPermissions(permissions, required)) {
			return c.json({ error: "insufficient_scope" }, 403);
		}
		c.set("personalApiKey", {
			keyId: result.key.id,
			userId: result.key.referenceId,
			permissions,
		});
		await next();
	});
}
