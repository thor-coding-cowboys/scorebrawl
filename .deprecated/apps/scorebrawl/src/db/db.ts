import { upstashCache } from "drizzle-orm/cache/upstash";
import { type PostgresJsDatabase, drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import * as schema from "./schema";

const devDb = (): PostgresJsDatabase<typeof schema> => {
  if (globalThis.dbCache) {
    return globalThis.dbCache;
  }
  globalThis.dbCache = drizzle(postgres(databaseUrl), {
    schema,
  });
  return globalThis.dbCache;
};

const databaseUrl = process.env.DATABASE_URL ?? "";
export const db = process.env.VERCEL
  ? drizzle(postgres(databaseUrl), {
      schema,
      cache:
        process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
          ? upstashCache({
              url: process.env.UPSTASH_REDIS_REST_URL,
              token: process.env.UPSTASH_REDIS_REST_TOKEN,
              global: true,
            })
          : undefined,
    })
  : devDb();

export const migrateDb = async () => {
  if (process.env.VERCEL) {
    await migrate(drizzle(postgres(databaseUrl)), {
      migrationsFolder: "./migrations",
    });
  } else {
    const migrateDrizzle = drizzle(postgres(databaseUrl, { max: 1 }));
    await migrate(migrateDrizzle, { migrationsFolder: "./migrations" });
  }
};
