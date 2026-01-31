import { type PostgresJsDatabase, drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL ?? "";

export const db: PostgresJsDatabase<typeof schema> = drizzle(postgres(databaseUrl), {
  schema,
});

export const migrateDb = async () => {
  const migrateDrizzle = drizzle(postgres(databaseUrl, { max: 1 }));
  await migrate(migrateDrizzle, { migrationsFolder: "./migrations" });
};
