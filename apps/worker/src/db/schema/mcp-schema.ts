import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user, league } from "./auth-schema";
import { timestampAuditFields } from "./common";

export const mcpAuthCode = sqliteTable("mcp_auth_code", {
	code: text("code").primaryKey().notNull(),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	organizationId: text("organization_id")
		.notNull()
		.references(() => league.id, { onDelete: "cascade" }),
	expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
	consumedAt: integer("consumed_at", { mode: "timestamp" }),
	...timestampAuditFields,
});

export const mcpToken = sqliteTable("mcp_token", {
	id: text("id").primaryKey().notNull(),
	tokenHash: text("token_hash").notNull().unique(),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	organizationId: text("organization_id")
		.notNull()
		.references(() => league.id, { onDelete: "cascade" }),
	lastUsedAt: integer("last_used_at", { mode: "timestamp" }),
	expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
	revokedAt: integer("revoked_at", { mode: "timestamp" }),
	...timestampAuditFields,
});
