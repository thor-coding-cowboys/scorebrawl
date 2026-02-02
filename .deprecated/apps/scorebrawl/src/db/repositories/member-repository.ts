import { db } from "@/db";
import { and, eq } from "drizzle-orm";
import { LeagueMembers, Leagues, Users } from "../schema";

export const findAll = async ({ leagueId }: { leagueId: string }) => {
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
