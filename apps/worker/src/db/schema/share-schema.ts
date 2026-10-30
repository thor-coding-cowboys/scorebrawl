import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { league, user } from "./auth-schema";
import { timestampAuditFields } from "./common";
import { season } from "./league-schema";

export const leagueSetting = sqliteTable("league_setting", {
	leagueId: text("league_id")
		.primaryKey()
		.references(() => league.id, { onDelete: "cascade" }),
	allowPublicShares: integer("allow_public_shares", { mode: "boolean" }).notNull().default(false),
	...timestampAuditFields,
});

export const shareLink = sqliteTable(
	"share_link",
	{
		id: text("id").primaryKey(),
		tokenHash: text("token_hash").notNull().unique(),
		leagueId: text("league_id")
			.notNull()
			.references(() => league.id, { onDelete: "cascade" }),
		seasonId: text("season_id")
			.notNull()
			.references(() => season.id, { onDelete: "cascade" }),
		createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
		expiresAt: integer("expires_at", { mode: "timestamp" }),
		revokedAt: integer("revoked_at", { mode: "timestamp" }),
		revokedBy: text("revoked_by").references(() => user.id, { onDelete: "set null" }),
		viewCount: integer("view_count").notNull().default(0),
		lastViewedAt: integer("last_viewed_at", { mode: "timestamp" }),
		...timestampAuditFields,
	},
	(table) => [
		index("share_link_season_created_idx").on(table.seasonId, table.createdAt),
		index("share_link_league_idx").on(table.leagueId),
	]
);
