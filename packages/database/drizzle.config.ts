import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ||
      "postgresql://scorebrawl:scorebrawl@localhost:65535/scorebrawl_local",
  },
  migrations: {
    prefix: "timestamp",
  },
});
