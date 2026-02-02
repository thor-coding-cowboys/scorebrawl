import type { Config } from "drizzle-kit";

export default {
  out: "./migrations",
  schema: "./src/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  migrations: {
    prefix: "timestamp",
  },
} satisfies Config;
