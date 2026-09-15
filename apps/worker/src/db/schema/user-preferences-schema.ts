import { sqliteTable, text, integer, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import { user } from "./auth-schema";
import { timestampAuditFields } from "./common";

export const userPreference = sqliteTable("user_preference", {
	userId: text("user_id")
		.primaryKey()
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	defaultOrganizationId: text("default_organization_id"),
	lastActiveOrganizationId: text("last_active_organization_id"),
	pushEnabled: integer("push_enabled", { mode: "boolean" }).notNull().default(true),
	notifySessionStarted: integer("notify_session_started", { mode: "boolean" })
		.notNull()
		.default(true),
	notifyMatchRecorded: integer("notify_match_recorded", { mode: "boolean" })
		.notNull()
		.default(true),
	notifyAchievementUnlocked: integer("notify_achievement_unlocked", { mode: "boolean" })
		.notNull()
		.default(true),
	notifyStreakReached: integer("notify_streak_reached", { mode: "boolean" })
		.notNull()
		.default(true),
	...timestampAuditFields,
});

export const pushToken = sqliteTable(
	"push_token",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		token: text("token").notNull(),
		platform: text("platform").notNull().default("ios"),
		deviceName: text("device_name"),
		...timestampAuditFields,
		lastSeenAt: integer("last_seen_at", { mode: "timestamp" }),
	},
	(table) => [
		uniqueIndex("push_token_token_uidx").on(table.token),
		index("push_token_userId_idx").on(table.userId),
	]
);
