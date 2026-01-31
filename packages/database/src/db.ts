import { type PostgresJsDatabase, drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL ?? "";

// Export type for use in other packages
export type Database = PostgresJsDatabase<typeof schema>;

// Create database connection with Cloudflare Workers-compatible configuration:
// - max: 1 limits connection pool to 1 connection
// - idle_timeout: 1 closes idle connections immediately
// - connect_timeout: 10 prevents hanging connections
// This minimizes connection reuse across request contexts
export function createDb(): PostgresJsDatabase<typeof schema> {
  const client = postgres(databaseUrl, {
    max: 1,
    idle_timeout: 1,
    connect_timeout: 10,
  });

  return drizzle(client, {
    schema,
  });
}

// Legacy export for backwards compatibility (scripts, migrations, etc.)
// WARNING: This should NOT be used in Cloudflare Workers request handlers
export const db: PostgresJsDatabase<typeof schema> = createDb();

export const migrateDb = async () => {
  const migrateDrizzle = drizzle(postgres(databaseUrl, { max: 1 }));
  await migrate(migrateDrizzle, { migrationsFolder: "./migrations" });
};
