import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { and, eq, isNull } from "drizzle-orm";
import type { HonoEnv, AuthType } from "./context";
import { mcpToken } from "../db/schema/mcp-schema";
import { user as userTable } from "../db/schema/auth-schema";
import { hashToken } from "../lib/mcp-tokens";

export const mcpAuthMiddleware = createMiddleware<HonoEnv>(async (c, next) => {
	const header = c.req.header("authorization");
	if (!header || !header.toLowerCase().startsWith("bearer ")) {
		throw new HTTPException(401, { message: "Missing bearer token." });
	}
	const presented = header.slice("bearer ".length).trim();
	if (!presented.startsWith("scbr_")) {
		throw new HTTPException(401, { message: "Invalid token." });
	}

	const db = c.get("db");
	const tokenHash = await hashToken(presented);

	const [row] = await db
		.select({
			id: mcpToken.id,
			userId: mcpToken.userId,
			organizationId: mcpToken.organizationId,
			revokedAt: mcpToken.revokedAt,
		})
		.from(mcpToken)
		.where(and(eq(mcpToken.tokenHash, tokenHash), isNull(mcpToken.revokedAt)))
		.limit(1);

	if (!row) {
		throw new HTTPException(401, { message: "Unauthorized" });
	}

	const [u] = await db.select().from(userTable).where(eq(userTable.id, row.userId)).limit(1);
	if (!u) {
		throw new HTTPException(401, { message: "Unauthorized" });
	}

	c.set("authentication", {
		user: u,
		session: {
			id: `mcp-${row.id}`,
			userId: row.userId,
			activeOrganizationId: row.organizationId,
			createdAt: new Date(),
			updatedAt: new Date(),
			expiresAt: new Date(Date.now() + 60 * 60 * 1000),
			token: "",
			ipAddress: null,
			userAgent: null,
		},
	} as AuthType);

	// Best-effort last-used bump (no await blocking the request)
	c.executionCtx.waitUntil(
		db.update(mcpToken).set({ lastUsedAt: new Date() }).where(eq(mcpToken.id, row.id))
	);

	await next();
});
