import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth-schema";
import { timestampAuditFields } from "./common";

export const userPreference = sqliteTable("user_preference", {
	userId: text("user_id")
		.primaryKey()
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	defaultOrganizationId: text("default_organization_id"),
	lastActiveOrganizationId: text("last_active_organization_id"),
	...timestampAuditFields,
});
