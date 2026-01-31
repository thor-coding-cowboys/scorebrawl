import path from "node:path";
import { fileURLToPath } from "node:url";
import * as schema from "@scorebrawl/database/schema";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { setup as setupInfra, stop as stopInfra } from "./infra";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set test database URL before anything else
process.env.DATABASE_URL =
  "postgresql://scorebrawl_test:test_secret@localhost:5433/scorebrawl_test";

export async function setup() {
  const testClient = postgres(process.env.DATABASE_URL);
  const testDb = drizzle(testClient, { schema });

  try {
    await setupInfra({
      initDb: () => testDb,
      migrationsFolder: path.resolve(__dirname, "../../../apps/scorebrawl/migrations"),
    });
  } catch (e) {
    console.error("❌ Failed to set up test environment ❌", e);
    process.exit(1);
  } finally {
    await testClient.end();
  }
}

export async function teardown() {
  await stopInfra();
}
