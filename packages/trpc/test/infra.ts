import { execSync } from "node:child_process";
import type * as schema from "@scorebrawl/database/schema";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

let wasAlreadyRunning = false;

export const getComposeFilePath = () => {
  const repoRoot = execSync("git rev-parse --show-toplevel", { encoding: "utf-8" }).trim();
  return `${repoRoot}/dev/scorebrawl-local-infra/docker-compose.yml`;
};

const isRunning = (composeFilePath: string): boolean => {
  try {
    const result = execSync(`docker compose -f ${composeFilePath} ps --format json`, {
      encoding: "utf-8",
    });
    const containers = JSON.parse(result);
    return (
      Array.isArray(containers) &&
      containers.length > 0 &&
      containers.every((c) => c.State === "running")
    );
  } catch {
    return false;
  }
};

export const setup = async ({
  initDb,
  migrationsFolder,
}: {
  initDb: () => PostgresJsDatabase<typeof schema>;
  migrationsFolder: string;
}) => {
  const composeFilePath = getComposeFilePath();

  wasAlreadyRunning = isRunning(composeFilePath);

  if (wasAlreadyRunning) {
    console.log("ℹ️ Infrastructure already running, skipping start");
  } else {
    console.log("🚀 Starting test database...");
    execSync(`docker compose -f ${composeFilePath} up --wait -d`, {
      stdio: "inherit",
    });
  }

  console.log("🔄 Running migrations...");
  const db = initDb();
  await migrate(db, { migrationsFolder });

  console.log("✅ Integration test infrastructure is ready");
};

export const stop = async () => {
  if (wasAlreadyRunning) {
    console.log("ℹ️ Infrastructure was already running, leaving it up");
    return;
  }

  console.log("⌛️ Stopping test infrastructure...");
  const dockerComposeTestFullPath = getComposeFilePath();
  execSync(`docker compose -f ${dockerComposeTestFullPath} stop`, {
    stdio: "inherit",
  });
  console.log("✅ Test infrastructure stopped");
};
