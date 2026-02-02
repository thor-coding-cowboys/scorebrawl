import { migrateDb } from "@/db";

try {
  await migrateDb();
} catch (e) {
  console.error("error in migration", e);
  process.exit(1);
}
process.exit(0);
