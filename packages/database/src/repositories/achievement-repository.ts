import { createId } from "@scorebrawl/utils/id";
import { and, eq, getTableColumns } from "drizzle-orm";
import type { Database } from "../db";
import { LeaguePlayerAchievement, LeaguePlayers } from "../schema";

export const createAchievement = async (
  db: Database,
  value: Omit<typeof LeaguePlayerAchievement.$inferInsert, "id">,
) => {
  const now = new Date();
  const [result] = await db
    .insert(LeaguePlayerAchievement)
    .values({ id: createId(), ...value, updatedAt: now })
    .onConflictDoNothing()
    .returning();

  return result?.updatedAt === now;
};

export const getAchievements = async (
  db: Database,
  {
    leaguePlayerId,
    leagueId,
  }: {
    leaguePlayerId: string;
    leagueId: string;
  },
) =>
  db
    .select(getTableColumns(LeaguePlayerAchievement))
    .from(LeaguePlayerAchievement)
    .innerJoin(LeaguePlayers, eq(LeaguePlayerAchievement.leaguePlayerId, LeaguePlayers.id))
    .where(
      and(
        eq(LeaguePlayerAchievement.leaguePlayerId, leaguePlayerId),
        eq(LeaguePlayers.leagueId, leagueId),
      ),
    );
