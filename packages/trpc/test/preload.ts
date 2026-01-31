import * as schema from "@scorebrawl/database/schema";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { beforeEach } from "vitest";

beforeEach(async () => {
  // Create test database instance
  const testClient = postgres(process.env.DATABASE_URL ?? "");
  const testDb = drizzle(testClient, { schema });
  // Clean database before each test using TRUNCATE CASCADE
  const tableNames = [
    '"match_player"',
    '"season_team_match"',
    '"match"',
    '"season_fixture"',
    '"season_player"',
    '"season_team"',
    '"season"',
    '"league_player_achievement"',
    '"league_team_player"',
    '"league_team"',
    '"league_player"',
    '"league_member"',
    '"league_invite"',
    '"league"',
    '"verification"',
    '"account"',
    '"session"',
    '"user"',
  ];

  // Use raw SQL for fast cleanup with CASCADE
  await testDb.execute(sql.raw(`TRUNCATE TABLE ${tableNames.join(", ")} CASCADE`));
});
