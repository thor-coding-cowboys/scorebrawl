import { db } from "@/db";
import { createCuid } from "@scorebrawl/utils/id";
import { and, desc, eq, getTableColumns, gte, isNull, or } from "drizzle-orm";
import {
  LeagueInvites,
  LeagueMembers,
  LeaguePlayers,
  Leagues,
  SeasonPlayers,
  Seasons,
} from "../schema";
import type { LeagueMemberRole } from "../types";

export const create = async ({
  userId,
  leagueId,
  role,
  expiresAt,
}: {
  userId: string;
  leagueId: string;
  role: LeagueMemberRole;
  expiresAt?: Date;
}) => {
  const now = new Date();
  const [invite] = await db
    .insert(LeagueInvites)
    .values([
      {
        leagueId,
        id: createCuid(),
        code: createCuid(),
        createdAt: now,
        updatedAt: now,
        createdBy: userId,
        updatedBy: userId,
        role,
        expiresAt,
      },
    ])
    .returning();
  return invite;
};

export const findByCode = async (code: string) => {
  const [invite] = await db
    .select(getTableColumns(LeagueInvites))
    .from(LeagueInvites)
    .where(eq(LeagueInvites.code, code));
  return invite;
};

export const findByLeagueId = async ({ leagueId }: { leagueId: string }) =>
  db
    .select(getTableColumns(LeagueInvites))
    .from(LeagueInvites)
    .innerJoin(Leagues, eq(LeagueInvites.leagueId, Leagues.id))
    .where(eq(LeagueInvites.leagueId, leagueId))
    .orderBy(desc(LeagueInvites.expiresAt));

export const claim = async ({
  userId,
  leagueId,
  role,
}: {
  leagueId: string;
  userId: string;
  role: LeagueMemberRole;
}) => {
  const now = new Date();
  await db
    .insert(LeagueMembers)
    .values({
      id: createCuid(),
      leagueId,
      userId,
      role,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing();
  if (role !== "viewer") {
    const [leaguePlayer] = await db
      .insert(LeaguePlayers)
      .values({
        id: createCuid(),
        leagueId,
        userId,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    const futureOrOngoingSeasons = await db
      .select({ id: Seasons.id, initialScore: Seasons.initialScore })
      .from(Seasons)
      .where(
        and(eq(Seasons.leagueId, leagueId), or(gte(Seasons.endDate, now), isNull(Seasons.endDate))),
      );
    if (futureOrOngoingSeasons.length > 0) {
      await db.insert(SeasonPlayers).values(
        futureOrOngoingSeasons.map(
          ({ id, initialScore }) =>
            ({
              id: createCuid(),
              seasonId: id,
              leaguePlayerId: leaguePlayer?.id ?? "",
              score: initialScore,
              createdAt: now,
              updatedAt: now,
            }) satisfies typeof SeasonPlayers.$inferInsert,
        ),
      );
    }
  }
  const [league] = await db
    .select({ slug: Leagues.slug })
    .from(Leagues)
    .where(eq(Leagues.id, leagueId));
  return { leagueSlug: league?.slug ?? "" };
};
