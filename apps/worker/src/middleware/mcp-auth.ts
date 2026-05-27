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
			tokenId: mcpToken.id,
			userId: mcpToken.userId,
			organizationId: mcpToken.organizationId,
			userName: userTable.name,
			userEmail: userTable.email,
			userEmailVerified: userTable.emailVerified,
			userImage: userTable.image,
			userCreatedAt: userTable.createdAt,
			userUpdatedAt: userTable.updatedAt,
			userRole: userTable.role,
			userBanned: userTable.banned,
			userBanReason: userTable.banReason,
			userBanExpires: userTable.banExpires,
		})
		.from(mcpToken)
		.innerJoin(userTable, eq(userTable.id, mcpToken.userId))
		.where(and(eq(mcpToken.tokenHash, tokenHash), isNull(mcpToken.revokedAt)))
		.limit(1);

	if (!row) {
		throw new HTTPException(401, { message: "Unauthorized" });
	}

	c.set("authentication", {
		user: {
			id: row.userId,
			name: row.userName,
			email: row.userEmail,
			emailVerified: row.userEmailVerified,
			image: row.userImage,
			createdAt: row.userCreatedAt,
			updatedAt: row.userUpdatedAt,
			role: row.userRole,
			banned: row.userBanned,
			banReason: row.userBanReason,
			banExpires: row.userBanExpires,
		},
		session: {
			id: `mcp-${row.tokenId}`,
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
		db.update(mcpToken).set({ lastUsedAt: new Date() }).where(eq(mcpToken.id, row.tokenId))
	);

	await next();
});
