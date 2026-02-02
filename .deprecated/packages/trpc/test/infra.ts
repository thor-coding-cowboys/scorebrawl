import { execSync } from "node:child_process";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

export const getComposeFilePath = () => {
  const repoRoot = execSync("git rev-parse --show-toplevel", { encoding: "utf-8" }).trim();
  return `${repoRoot}/docker-compose.test.yml`;
};

const testId = "scorebrawl-it";
export const getProjectName = () => `scorebrawl-test-${testId}`;

export const setup = async ({
  initDb,
  migrationsFolder,
}: {
  initDb: () => PostgresJsDatabase;
  migrationsFolder: string;
}) => {
  const composeFilePath = getComposeFilePath();
  const projectName = getProjectName();

  console.log("🚀 Starting test database...");
  execSync(`docker compose -p ${projectName} -f ${composeFilePath} up --wait -d`, {
    stdio: "inherit",
  });

  console.log("🔄 Running migrations...");
  const db = initDb();
  await migrate(db, { migrationsFolder });

  console.log("✅ Integration test infrastructure is ready");
};

export const stop = async () => {
  console.log("⌛️ Stopping test infrastructure...");
  const dockerComposeTestFullPath = getComposeFilePath();
  execSync(`docker compose -p ${getProjectName()} -f ${dockerComposeTestFullPath} stop`, {
    stdio: "inherit",
  });
  console.log("✅ Test infrastructure stopped");
};
