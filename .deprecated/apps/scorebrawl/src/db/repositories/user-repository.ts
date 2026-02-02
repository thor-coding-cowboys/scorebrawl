import { db } from "@/db";
import { fullName } from "@scorebrawl/utils/string";
import { eq, inArray } from "drizzle-orm";
import {
  LeaguePlayers,
  LeagueTeamPlayers,
  LeagueTeams,
  SeasonPlayers,
  SeasonTeams,
  Users,
} from "../schema";

export const getUserAvatar = async ({ userId }: { userId: string }) => {
  const [userAvatar] = await db
    .select({ name: Users.name, image: Users.image })
    .from(Users)
    .where(eq(Users.id, userId));
  return { name: userAvatar?.name ?? "", image: userAvatar?.image ?? "" };
};

export const getSeasonTeamAvatars = async ({
  seasonTeamIds,
}: {
  seasonTeamIds: string[];
}) => {
  const rawResults = await db
    .select({
      teamId: SeasonTeams.id,
      userId: Users.id,
      image: Users.image,
      name: Users.name,
    })
    .from(LeagueTeamPlayers)
    .innerJoin(LeagueTeams, eq(LeagueTeams.id, LeagueTeamPlayers.teamId))
    .innerJoin(LeaguePlayers, eq(LeaguePlayers.id, LeagueTeamPlayers.leaguePlayerId))
    .innerJoin(Users, eq(Users.id, LeaguePlayers.userId))
    .innerJoin(SeasonTeams, eq(SeasonTeams.teamId, LeagueTeams.id))
    .where(inArray(SeasonTeams.id, seasonTeamIds));

  // Process the results to group players by team
  const resultMap = new Map<
    string,
    {
      teamId: string;
      players: { userId: string; image?: string; name: string }[];
    }
  >();

  for (const row of rawResults) {
    if (!resultMap.has(row.teamId)) {
      resultMap.set(row.teamId, { teamId: row.teamId, players: [] });
    }
    resultMap.get(row.teamId)?.players.push({
      userId: row.userId,
      image: row.image ?? undefined,
      name: row.name,
    });
  }

  return Array.from(resultMap.values());
};

export const getSeasonPlayerAvatars = ({
  seasonPlayerIds,
}: {
  seasonPlayerIds: Array<string>;
}) => {
  return db
    .select({
      userId: Users.id,
      image: Users.image,
      name: Users.name,
    })
    .from(SeasonPlayers)
    .innerJoin(LeaguePlayers, eq(LeaguePlayers.id, SeasonPlayers.leaguePlayerId))
    .innerJoin(Users, eq(Users.id, LeaguePlayers.userId))
    .where(inArray(SeasonPlayers.id, seasonPlayerIds));
};

export const findUserById = async ({ id }: { id: string }) => {
  const [user] = await db.select().from(Users).where(eq(Users.id, id));
  return user;
};

export const setDefaultLeague = async ({
  leagueId,
  userId,
}: {
  leagueId: string;
  userId: string;
}) => {
  const [user] = await db
    .update(Users)
    .set({ defaultLeagueId: leagueId })
    .where(eq(Users.id, userId))
    .returning();
  return user;
};

export const updateUser = async ({
  id,
  name,
  image,
}: {
  id: string;
  name?: string;
  image?: string;
}) => {
  const updateData: { name?: string; image?: string; updatedAt: Date } = {
    updatedAt: new Date(),
  };

  if (name !== undefined) {
    updateData.name = name;
  }

  if (image !== undefined) {
    updateData.image = image;
  }

  const [user] = await db.update(Users).set(updateData).where(eq(Users.id, id)).returning();
  return user;
};

export const upsertUser = async ({
  id,
  firstName,
  lastName,
  image,
  email,
  createdAt,
  updatedAt,
}: {
  id: string;
  firstName: string | null;
  lastName: string | null;
  image?: string;
  email?: string;
  createdAt: number;
  updatedAt: number;
}) => {
  await db
    .insert(Users)
    .values({
      id,
      name: fullName({
        firstName,
        lastName,
      }),
      email,
      emailVerified: !!email,
      image,
      createdAt: new Date(createdAt),
      updatedAt: new Date(updatedAt),
    })
    .onConflictDoUpdate({
      target: Users.id,
      set: {
        name: fullName({
          firstName,
          lastName,
        }),
        image,
        updatedAt: new Date(updatedAt),
      },
    });
};
