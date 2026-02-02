import { sql } from "drizzle-orm";
import { integer } from "drizzle-orm/sqlite-core";

export const timestampAuditFields = {
	createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
	updatedAt: integer("updated_at", { mode: "timestamp" })
		.default(sql`(unixepoch())`)
		.notNull()
		.$onUpdate((): Date => new Date()),
	deletedAt: integer("deleted_at", { mode: "timestamp" }),
};
