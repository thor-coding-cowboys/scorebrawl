import {
  LeagueMembers,
  LeaguePlayers,
  Leagues,
  Matches,
  ScoreBrawlError,
  SeasonFixtures,
  SeasonPlayers,
  SeasonTeams,
  Seasons,
  db,
} from "@/db";
import type { ScoreType } from "@/model";
import type { SeasonCreateSchema } from "@/model";
import { createCuid } from "@scorebrawl/utils/id";
import {
  and,
  asc,
  desc,
  eq,
  getTableColumns,
  gt,
  gte,
  inArray,
  isNull,
  lt,
  lte,
  or,
  sql,
} from "drizzle-orm";
import type { z } from "zod";
import { getStanding } from "./season-player-repository";
import { slugifyWithCustomReplacement } from "./slug";

export const findOverlappingSeason = async ({
  leagueId,
  startDate,
  endDate,
}: {
  leagueId: string;
  startDate: Date;
  endDate?: Date;
}) =>
  db.query.Seasons.findFirst({
    where: and(
      eq(Seasons.leagueId, leagueId),
      gte(Seasons.endDate, startDate),
      endDate ? lte(Seasons.startDate, endDate) : sql`true`,
    ),
  });

export const getCountInfo = async ({ seasonSlug }: { seasonSlug: string }) => {
  const [matchCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(Matches)
    .innerJoin(Seasons, and(eq(Matches.seasonId, Seasons.id), eq(Seasons.slug, seasonSlug)));

  const [teamCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(SeasonTeams)
    .innerJoin(Seasons, and(eq(SeasonTeams.seasonId, Seasons.id), eq(Seasons.slug, seasonSlug)));

  const [playerCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(SeasonPlayers)
    .innerJoin(Seasons, and(eq(SeasonPlayers.seasonId, Seasons.id), eq(Seasons.slug, seasonSlug)));

  return {
    matchCount: matchCount?.count || 0,
    teamCount: teamCount?.count || 0,
    playerCount: playerCount?.count || 0,
  };
};

export const getById = async ({ seasonId }: { seasonId: string }) => {
  const [season] = await db.select().from(Seasons).where(eq(Seasons.id, seasonId));
  if (!season) {
    throw new ScoreBrawlError({
      code: "NOT_FOUND",
      message: "Season not found",
    });
  }
  return season;
};

export const getBySlug = async ({ seasonSlug }: { seasonSlug: string }) => {
  const [season] = await db.select().from(Seasons).where(eq(Seasons.slug, seasonSlug));

  if (!season) {
    throw new ScoreBrawlError({
      code: "NOT_FOUND",
      message: "Season not found",
    });
  }
  return season;
};

export const findActive = async ({ leagueId }: { leagueId: string }) => {
  const now = new Date();
  const [season] = await db
    .select(getTableColumns(Seasons))
    .from(Seasons)
    .innerJoin(Leagues, eq(Leagues.id, Seasons.leagueId))
    .where(
      and(
        eq(Seasons.leagueId, leagueId),
        lt(Seasons.startDate, now),
        or(isNull(Seasons.endDate), gt(Seasons.endDate, now)),
      ),
    );
  return season;
};

export const getSeasonPlayers = async ({
  seasonId,
}: {
  leagueId: string;
  seasonId: string;
  userId: string;
}) => {
  const seasonPlayerResult = await db.query.SeasonPlayers.findMany({
    where: eq(SeasonPlayers.seasonId, seasonId),
    extras: (_, { sql }) => ({
      matchCount:
        sql<number>`(SELECT COUNT(*) FROM match_player mp WHERE mp.season_player_id = "seasonPlayers"."id")`.as(
          "matchCount",
        ),
      winCount:
        sql<number>`(SELECT COUNT(*) FROM match_player mp WHERE mp.season_player_id = "seasonPlayers"."id" and result = 'W')`.as(
          "winCount",
        ),
      lossCount:
        sql<number>`(SELECT COUNT(*) FROM match_player mp WHERE mp.season_player_id = "seasonPlayers"."id" and result = 'L')`.as(
          "lossCount",
        ),
      drawCount:
        sql<number>`(SELECT COUNT(*) FROM match_player mp WHERE mp.season_player_id = "seasonPlayers"."id" and result = 'D')`.as(
          "drawCount",
        ),
    }),
    with: {
      leaguePlayer: {
        columns: { userId: true },
        with: {
          user: {
            columns: { image: true, name: true },
          },
        },
      },
    },
    orderBy: desc(SeasonPlayers.score),
  });
  return seasonPlayerResult.map((sp) => ({
    id: sp.id,
    leaguePlayerId: sp.leaguePlayerId,
    userId: sp.leaguePlayer.userId,
    name: sp.leaguePlayer.user.name,
    image: sp.leaguePlayer.user.image,
    score: sp.score,
    joinedAt: sp.createdAt,
    disabled: sp.disabled,
    matchCount: Number(sp.matchCount),
    winCount: Number(sp.winCount),
    lossCount: Number(sp.lossCount),
    drawCount: Number(sp.drawCount),
  }));
};

export const getAll = async ({ leagueId }: { leagueId: string }) =>
  db
    .select(getTableColumns(Seasons))
    .from(Seasons)
    .where(eq(Seasons.leagueId, leagueId))
    .orderBy(desc(Seasons.startDate));

export const update = async ({
  userId,
  seasonId,
  ...rest
}: {
  userId: string;
  seasonId: string;
  startDate?: Date;
  endDate?: Date;
  initialScore?: number;
  scoreType?: ScoreType;
  kFactor?: number;
}) => {
  const [season] = await db
    .update(Seasons)
    .set({
      updatedAt: new Date(),
      updatedBy: userId,
      ...rest,
    })
    .where(eq(Seasons.id, seasonId))
    .returning();
  return season;
};

export const updateClosedStatus = async ({
  seasonId,
  userId,
  closed,
}: {
  seasonId: string;
  userId: string;
  closed: boolean;
}) => {
  const [season] = await db
    .update(Seasons)
    .set({
      closed,
      updatedAt: new Date(),
      updatedBy: userId,
    })
    .where(eq(Seasons.id, seasonId))
    .returning();
  return season;
};

export const create = async (input: z.input<typeof SeasonCreateSchema>) => {
  const slug = await slugifySeasonName({ name: input.name });
  const now = new Date();
  let values: typeof Seasons.$inferInsert;
  if (input.scoreType === "elo") {
    values = {
      id: createCuid(),
      name: input.name,
      slug,
      leagueId: input.leagueId,
      startDate: input.startDate,
      endDate: input.endDate,
      initialScore: input.initialScore,
      kFactor: input.kFactor,
      scoreType: "elo",
      rounds: undefined,
      createdAt: now,
      updatedAt: now,
      createdBy: input.userId,
      updatedBy: input.userId,
    };
  } else {
    values = {
      id: createCuid(),
      name: input.name,
      slug,
      leagueId: input.leagueId,
      startDate: input.startDate,
      endDate: input.endDate,
      initialScore: 0,
      kFactor: -1,
      rounds: input.roundsPerPlayer,
      scoreType: "3-1-0",
      createdAt: now,
      updatedAt: now,
      createdBy: input.userId,
      updatedBy: input.userId,
    };
  }
  const seasons = await db.insert(Seasons).values(values).returning();
  const season = seasons[0] as typeof Seasons.$inferSelect;
  const players = await db.query.LeaguePlayers.findMany({
    columns: { id: true },
    where: and(eq(LeaguePlayers.leagueId, input.leagueId), eq(LeaguePlayers.disabled, false)),
  });
  const seasonPlayerValues = players.map((lp) => ({
    id: createCuid(),
    disabled: false,
    score: season.initialScore,
    leaguePlayerId: lp.id,
    seasonId: season.id,
    createdAt: now,
    updatedAt: now,
  }));
  await db.insert(SeasonPlayers).values(seasonPlayerValues);

  if (input.scoreType === "3-1-0" && input.roundsPerPlayer) {
    const seasonPlayerIds = seasonPlayerValues.map((sp) => sp.id);
    const fixtures: (typeof SeasonFixtures.$inferInsert)[] = [];

    // Create a copy of player IDs for manipulation
    const players = [...seasonPlayerIds];

    // If odd number of players, add a null (bye) player
    if (players.length % 2 !== 0) {
      // @ts-ignore - from claude
      players.push(null);
    }

    const totalPlayers = players.length; // This includes the potential bye
    const matchesPerRound = totalPlayers / 2;
    const roundsPerCompleteTournament = totalPlayers - 1;

    for (let tournament = 0; tournament < input.roundsPerPlayer; tournament++) {
      // Create a fresh copy of the players array for each tournament
      let tournamentPlayers = [...players];

      for (let roundNum = 0; roundNum < roundsPerCompleteTournament; roundNum++) {
        const actualRound = tournament * roundsPerCompleteTournament + roundNum;
        const roundFixtures: Array<{ homeId: string | null; awayId: string | null }> = [];

        // In each round, first player is fixed and others rotate clockwise
        for (let i = 0; i < matchesPerRound; i++) {
          // Pair up players from opposite ends of the array
          const homeId = tournamentPlayers[i];
          const awayId = tournamentPlayers[totalPlayers - 1 - i];

          // Only create fixture if neither player is the bye (null)
          if (homeId !== null && awayId !== null) {
            // Alternate home/away for fairness in rematches
            const finalHomeId = tournament % 2 === 0 ? homeId : awayId;
            const finalAwayId = tournament % 2 === 0 ? awayId : homeId;

            // @ts-ignore - from claude
            roundFixtures.push({ homeId: finalHomeId, awayId: finalAwayId });
          }
        }

        // Add fixtures to the final fixtures array
        for (const fixture of roundFixtures) {
          fixtures.push({
            id: createCuid(),
            homePlayerId: fixture.homeId as string,
            awayPlayerId: fixture.awayId as string,
            seasonId: season.id,
            round: actualRound + 1,
            createdAt: now,
            updatedAt: now,
          });
        }

        // Rotate players for next round (first player stays fixed)
        const rotatedPlayers = [
          tournamentPlayers[0],
          tournamentPlayers[totalPlayers - 1],
          ...tournamentPlayers.slice(1, totalPlayers - 1),
        ];
        // @ts-ignore - from claude
        tournamentPlayers = rotatedPlayers;
      }
    }

    if (fixtures.length > 0) {
      await db.insert(SeasonFixtures).values(fixtures);
    }
  }

  return season as typeof Seasons.$inferSelect;
};

export const getSeasonPlayerLatestMatches = async ({
  seasonPlayerIds,
  limit = 5,
}: {
  seasonPlayerIds: string[];
  limit?: number;
}) => {
  return db.query.SeasonPlayers.findMany({
    columns: { id: true },
    where: inArray(SeasonPlayers.id, seasonPlayerIds),
    with: {
      season: { columns: { id: true } },
      matches: {
        orderBy: (match, { desc }) => [desc(match.createdAt)],
        limit,
      },
    },
  });
};

/**
 * used by the public endpoint that is used to show the scores for Jón Þór statue
 */
export const getTodayDiff = async ({
  leagueId,
  userId,
}: {
  leagueId: string;
  userId: string;
}) => {
  const season = await findActive({ leagueId });
  if (!season) {
    return { diff: 0 };
  }
  const seasonPlayers = await getStanding({
    seasonId: season.id,
  });
  const seasonPlayer = seasonPlayers.find((sp) => sp.user.userId === userId);

  return { diff: seasonPlayer?.pointDiff ?? 0 };
};

export const findSeasonAndLeagueBySlug = async ({
  leagueSlug,
  seasonSlug,
  userId,
}: {
  leagueSlug: string;
  seasonSlug: string;
  userId: string;
}) => {
  const [league] = await db
    .select({
      leagueId: Leagues.id,
      leagueSlug: Leagues.slug,
      leagueName: Leagues.name,
      role: LeagueMembers.role,
      seasonName: Seasons.name,
      seasonId: Seasons.id,
      seasonSlug: Seasons.slug,
      startDate: Seasons.startDate,
      endDate: Seasons.endDate,
      initialScore: Seasons.initialScore,
      scoreType: Seasons.scoreType,
      closed: Seasons.closed,
    })
    .from(Seasons)
    .innerJoin(Leagues, and(eq(Leagues.slug, leagueSlug), eq(Leagues.id, Seasons.leagueId)))
    .innerJoin(LeagueMembers, eq(LeagueMembers.leagueId, Leagues.id))
    .where(and(eq(Seasons.slug, seasonSlug), eq(LeagueMembers.userId, userId)));
  return league;
};

export const findFixtures = async ({ seasonId }: { seasonId: string }) => {
  return db.query.SeasonFixtures.findMany({
    where: eq(SeasonFixtures.seasonId, seasonId),
    orderBy: [
      asc(SeasonFixtures.round),
      asc(SeasonFixtures.createdAt),
      asc(SeasonFixtures.homePlayerId),
    ],
  });
};

export const findFixtureById = async ({
  seasonId,
  fixtureId,
}: { seasonId: string; fixtureId: string }) => {
  return db.query.SeasonFixtures.findFirst({
    where: and(eq(SeasonFixtures.seasonId, seasonId), eq(SeasonFixtures.id, fixtureId)),
  });
};

export const assignMatchToFixture = async ({
  seasonId,
  fixtureId,
  matchId,
}: { seasonId: string; fixtureId: string; matchId: string }) => {
  await db
    .update(SeasonFixtures)
    .set({ matchId })
    .where(and(eq(SeasonFixtures.seasonId, seasonId), eq(SeasonFixtures.id, fixtureId)));
};

export const slugifySeasonName = async ({ name }: { name: string }) => {
  const doesLeagueSlugExists = async (_slug: string) =>
    db.select().from(Seasons).where(eq(Seasons.slug, slug)).limit(1);

  const rootSlug = slugifyWithCustomReplacement(name);
  let slug = rootSlug;
  let [slugExists] = await doesLeagueSlugExists(slug);
  let counter = 1;
  while (slugExists) {
    slug = `${rootSlug}-${counter}`;
    counter++;
    [slugExists] = await doesLeagueSlugExists(slug);
  }
  return slug;
};
