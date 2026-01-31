import { and, eq } from "drizzle-orm";
import type { Database } from "../db";
import { LeagueMembers, Leagues, Users } from "../schema";

export const findAll = async (db: Database, { leagueId }: { leagueId: string }) => {
  return (
    await db
      .select({
        memberId: LeagueMembers.id,
        role: LeagueMembers.role,
        userId: LeagueMembers.userId,
        name: Users.name,
        image: Users.image,
      })
      .from(LeagueMembers)
      .innerJoin(Users, eq(Users.id, LeagueMembers.userId))
      .innerJoin(Leagues, eq(Leagues.id, LeagueMembers.leagueId))
      .where(and(eq(Leagues.id, leagueId)))
  ).map((lm) => ({
    ...lm,
    image: lm.image ?? undefined,
  }));
};
