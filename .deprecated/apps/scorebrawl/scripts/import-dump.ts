#!/usr/bin/env bun

import { join } from "node:path";
import { $ } from "bun";

const DB_CONFIGS = {
  e2e: "postgresql://scorebrawl:scorebrawl@localhost:65432/scorebrawl-e2e",
  dev: "postgresql://scorebrawl:scorebrawl@localhost:65432/scorebrawl",
} as const;

type DbType = keyof typeof DB_CONFIGS;

async function importDump(): Promise<void> {
  const scriptDir = import.meta.dir;

  // Parse command line arguments
  const args = process.argv.slice(2);
  let dumpFile = join(scriptDir, "anonymized-dump.sql");
  let dbType: DbType = "e2e";

  // Handle arguments: [dump-file] [--db=type] or [--db=type] [dump-file]
  for (const arg of args) {
    if (arg.startsWith("--db=")) {
      const type = arg.slice(5) as DbType;
      if (type in DB_CONFIGS) {
        dbType = type;
      } else {
        console.error(
          `❌ Invalid database type: ${type}. Valid options: ${Object.keys(DB_CONFIGS).join(", ")}`,
        );
        process.exit(1);
      }
    } else if (!arg.startsWith("--")) {
      dumpFile = arg;
    }
  }

  const dbUrl = DB_CONFIGS[dbType];

  if (!dbUrl) {
    console.error(`❌ Database URL not configured for type: ${dbType}`);
    process.exit(1);
  }

  console.log(`Importing SQL dump: ${dumpFile}`);
  console.log(`Target database (${dbType}): ${dbUrl}`);

  try {
    // Import the SQL dump using psql
    await $`psql ${dbUrl} -f ${dumpFile}`.quiet();

    console.log("✅ Database import completed successfully!");
  } catch (error) {
    console.error("❌ Error importing database:", error);
    process.exit(1);
  }
}

// Main execution
importDump();
