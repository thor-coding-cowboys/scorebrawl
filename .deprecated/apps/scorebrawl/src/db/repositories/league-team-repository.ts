import { db } from "@/db";
import {
  LeaguePlayers,
  LeagueTeamPlayers,
  LeagueTeams,
  Leagues,
  ScoreBrawlError,
  SeasonPlayers,
  SeasonTeams,
  Users,
} from "@/db";
import type { LeagueTeamInput } from "@/model";
import { createCuid } from "@scorebrawl/utils/id";
import { and, asc, eq, getTableColumns, inArray, sql } from "drizzle-orm";
import type { z } from "zod";

export const getLeagueTeams = async ({ leagueId }: { leagueId: string }) => {
  return db.query.LeagueTeams.findMany({
    where: (team, { eq }) => eq(team.leagueId, leagueId),
    orderBy: asc(LeagueTeams.name),
    with: {
      players: {
        columns: {},
        with: {
          leaguePlayer: {
            columns: { id: true },
            with: {
              user: {
                columns: { id: true, name: true, image: true },
              },
            },
          },
        },
      },
    },
  });
};

export const getOrInsertTeam = async ({
  now,
  season,
  players,
}: {
  now: Date;
  season: { id: string; initialScore: number; leagueId: string };
  players: { leaguePlayer: { id: string; user: { name: string } } }[];
}) => {
  const [teamIdResult] = await db
    .select({ teamId: LeagueTeamPlayers.teamId })
    .from(LeagueTeamPlayers)
    .where(
      inArray(
        LeagueTeamPlayers.leaguePlayerId,
        players.map((p) => p.leaguePlayer.id),
      ),
    )
    .groupBy(LeagueTeamPlayers.teamId)
    .having(sql`COUNT(DISTINCT ${LeagueTeamPlayers.leaguePlayerId}) = ${players.length}`);

  let teamId = teamIdResult?.teamId;

  if (!teamId) {
    teamId = createCuid();
    await db.insert(LeagueTeams).values({
      id: teamId,
      name: players.map((p) => p.leaguePlayer.user.name.split(" ")[0]).join(" & "),
      leagueId: season.leagueId,
      updatedAt: now,
      createdAt: now,
    });

    await db.insert(LeagueTeamPlayers).values(
      players.map((p) => ({
        id: createCuid(),
        teamId: teamId as string,
        leaguePlayerId: p.leaguePlayer.id,
        createdAt: now,
        updatedAt: now,
      })),
    );

    const seasonTeamId = createCuid();
    await db.insert(SeasonTeams).values({
      id: seasonTeamId,
      teamId: teamId,
      seasonId: season.id,
      score: season.initialScore,
      createdAt: now,
      updatedAt: now,
    });

    return { seasonTeamId, score: season.initialScore };
  }
  const seasonTeam = await db.query.SeasonTeams.findFirst({
    columns: { id: true, score: true },
    where: (st, { and, eq }) => and(eq(st.teamId, teamId as string), eq(st.seasonId, season.id)),
  });
  if (!seasonTeam) {
    const seasonTeamId = createCuid();
    await db.insert(SeasonTeams).values({
      id: seasonTeamId,
      seasonId: season.id,
      teamId: teamId,
      score: season.initialScore,
      createdAt: now,
      updatedAt: now,
    });
    return { seasonTeamId, score: season.initialScore };
  }
  return { seasonTeamId: seasonTeam.id, score: seasonTeam.score };
};

export const update = async ({
  leagueSlug,
  teamId,
  name,
  userId,
  isEditor,
}: z.infer<typeof LeagueTeamInput>) => {
  const [leagueTeam] = await db
    .select({ id: LeagueTeams.id })
    .from(LeagueTeams)
    .innerJoin(Leagues, eq(Leagues.id, LeagueTeams.leagueId))
    .where(and(eq(LeagueTeams.id, teamId), eq(Leagues.slug, leagueSlug)));
  if (!leagueTeam) {
    throw new ScoreBrawlError({
      code: "NOT_FOUND",
      message: "Team not found in league",
    });
  }

  if (!isEditor) {
    const [result] = await db
      .select({ id: LeagueTeams.id })
      .from(LeagueTeams)
      .innerJoin(Leagues, eq(Leagues.id, LeagueTeams.leagueId))
      .innerJoin(LeagueTeamPlayers, eq(LeagueTeamPlayers.teamId, LeagueTeams.id))
      .innerJoin(LeaguePlayers, eq(LeaguePlayers.id, LeagueTeamPlayers.leaguePlayerId))
      .innerJoin(Users, eq(Users.id, LeaguePlayers.userId))
      .where(and(eq(Leagues.slug, leagueSlug), eq(LeagueTeams.id, teamId), eq(Users.id, userId)));
    if (!result) {
      throw new ScoreBrawlError({
        code: "FORBIDDEN",
        message: "User is not authorized to update team",
      });
    }
  }
  return db
    .update(LeagueTeams)
    .set({
      name: name,
      updatedAt: new Date(),
    })
    .where(and(eq(LeagueTeams.id, teamId)))
    .returning();
};

export const getBySeasonPlayerIds = async ({
  seasonPlayerIds,
}: {
  seasonPlayerIds: string[];
}) => {
  const [team] = await db
    .select(getTableColumns(LeagueTeams))
    .from(LeagueTeamPlayers)
    .innerJoin(LeagueTeams, eq(LeagueTeams.id, LeagueTeamPlayers.teamId))
    .innerJoin(SeasonTeams, eq(SeasonTeams.teamId, LeagueTeams.id))
    .innerJoin(SeasonPlayers, eq(SeasonPlayers.seasonId, SeasonTeams.seasonId))
    .where(inArray(SeasonPlayers.id, seasonPlayerIds));
  return team;
};
