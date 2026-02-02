import { db } from "@/db";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { LeagueMembers, Leagues } from "../schema";

export const canReadLeaguesCriteria = ({ userId }: { userId: string }) =>
  inArray(
    Leagues.id,
    db
      .select({ data: Leagues.id })
      .from(Leagues)
      .innerJoin(LeagueMembers, eq(LeagueMembers.leagueId, Leagues.id))
      .where(and(eq(LeagueMembers.userId, userId), isNotNull(Leagues.id))),
  );
