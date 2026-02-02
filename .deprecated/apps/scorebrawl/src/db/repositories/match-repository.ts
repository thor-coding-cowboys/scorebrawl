import {
  MatchPlayers,
  MatchTeams,
  Matches,
  ScoreBrawlError,
  SeasonPlayers,
  SeasonTeams,
  Seasons,
  db,
} from "@/db";
import type { Match, MatchInput, MatchResultSymbol } from "@/model";
import { CalculationStrategy, Player, TeamMatch } from "@ihs7/ts-elo";
import { createCuid } from "@scorebrawl/utils/id";
import { type SQL, and, count, desc, eq, getTableColumns, inArray, sql } from "drizzle-orm";
import type z from "zod";
import { getOrInsertTeam } from "./league-team-repository";

export const create = async ({
  seasonId,
  homeTeamSeasonPlayerIds,
  awayTeamSeasonPlayerIds,
  homeScore,
  awayScore,
  userId,
}: z.infer<typeof MatchInput>) => {
  const [seasonById] = await db
    .select(getTableColumns(Seasons))
    .from(Seasons)
    .where(eq(Seasons.id, seasonId));
  const season = seasonById as typeof Seasons.$inferSelect;
  if (homeTeamSeasonPlayerIds.length !== awayTeamSeasonPlayerIds.length) {
    throw new ScoreBrawlError({
      code: "BAD_REQUEST",
      message: "Team sizes must be equal",
    });
  }

  const homeSeasonPlayers = await findAndValidateSeasonPlayers({
    seasonId,
    seasonPlayerIds: homeTeamSeasonPlayerIds,
  });
  const awaySeasonPlayers = await findAndValidateSeasonPlayers({
    seasonId,
    seasonPlayerIds: awayTeamSeasonPlayerIds,
  });

  const now = new Date();

  const individualMatchResult = calculateMatchResult({
    season,
    homeScore: homeScore,
    awayScore: awayScore,
    homePlayers: homeSeasonPlayers,
    awayPlayers: awaySeasonPlayers,
  });

  const [match] = await db
    .insert(Matches)
    .values({
      id: createCuid(),
      homeScore: homeScore,
      awayScore: awayScore,
      homeExpectedElo: individualMatchResult.homeTeam.winningOdds,
      awayExpectedElo: individualMatchResult.awayTeam.winningOdds,
      seasonId,
      createdBy: userId,
      updatedBy: userId,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  let homeTeamResult: MatchResultSymbol = "D";
  let awayTeamResult: MatchResultSymbol = "D";
  if (homeScore > awayScore) {
    homeTeamResult = "W";
    awayTeamResult = "L";
  } else if (homeScore < awayScore) {
    homeTeamResult = "L";
    awayTeamResult = "W";
  }

  const matchPlayerValues = [
    ...awaySeasonPlayers.map((player) => ({
      id: createCuid(),
      matchId: match?.id ?? "",
      scoreBefore: player.score,
      eloBefore: player.score,
      eloAfter: individualMatchResult.awayTeam.players.find((p) => p.id === player.id)
        ?.scoreAfter as number,
      scoreAfter: individualMatchResult.awayTeam.players.find((p) => p.id === player.id)
        ?.scoreAfter as number,
      seasonPlayerId: player.id,
      homeTeam: false,
      result: awayTeamResult,
      createdAt: now,
      updatedAt: now,
    })),
    ...homeSeasonPlayers.map((player) => ({
      id: createCuid(),
      matchId: match?.id ?? "",
      eloBefore: player.score,
      scoreBefore: player.score,
      eloAfter: individualMatchResult.homeTeam.players.find((p) => p.id === player.id)
        ?.scoreAfter as number,
      scoreAfter: individualMatchResult.homeTeam.players.find((p) => p.id === player.id)
        ?.scoreAfter as number,
      seasonPlayerId: player.id,
      homeTeam: true,
      result: homeTeamResult,
      createdAt: now,
      updatedAt: now,
    })),
  ];
  await db.insert(MatchPlayers).values(matchPlayerValues);

  for (const playerResult of [
    ...individualMatchResult.homeTeam.players,
    ...individualMatchResult.awayTeam.players,
  ]) {
    await db
      .update(SeasonPlayers)
      .set({ score: playerResult.scoreAfter })
      .where(eq(SeasonPlayers.id, playerResult.id));
  }

  if (homeSeasonPlayers.length > 1 && awaySeasonPlayers.length > 1) {
    const { seasonTeamId: homeSeasonTeamId, score: homeSeasonTeamScore } = await getOrInsertTeam({
      season,
      now,
      players: homeSeasonPlayers,
    });
    const { seasonTeamId: awaySeasonTeamId, score: awaySeasonTeamScore } = await getOrInsertTeam({
      season,
      now,
      players: awaySeasonPlayers,
    });

    const teamMatchResult = calculateMatchResult({
      season,
      homeScore: homeScore,
      awayScore: awayScore,
      homePlayers: [{ id: homeSeasonTeamId, score: homeSeasonTeamScore }],
      awayPlayers: [{ id: awaySeasonTeamId, score: awaySeasonTeamScore }],
    });

    await db.insert(MatchTeams).values([
      {
        id: createCuid(),
        matchId: match?.id ?? "",
        seasonTeamId: homeSeasonTeamId,
        scoreBefore: homeSeasonTeamScore,
        scoreAfter: teamMatchResult.homeTeam.players.find((r) => r.id === homeSeasonTeamId)
          ?.scoreAfter as number,
        result: homeTeamResult,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: createCuid(),
        matchId: match?.id ?? "",
        seasonTeamId: awaySeasonTeamId,
        scoreBefore: awaySeasonTeamScore,
        scoreAfter: teamMatchResult.awayTeam.players.find((r) => r.id === awaySeasonTeamId)
          ?.scoreAfter as number,
        result: awayTeamResult,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    for (const teamResult of [
      ...teamMatchResult.homeTeam.players,
      ...teamMatchResult.awayTeam.players,
    ]) {
      await db
        .update(SeasonTeams)
        .set({ score: teamResult.scoreAfter })
        .where(eq(SeasonTeams.id, teamResult.id));
    }
  }

  return {
    id: match?.id ?? "",
    homeScore: homeScore,
    awayScore: awayScore,
    createdAt: now,
    homeTeamSeasonPlayerIds,
    awayTeamSeasonPlayerIds,
  } satisfies z.infer<typeof Match>;
};

export const getBySeasonId = async ({
  seasonId,
  page = 1,
  limit = 30,
}: {
  seasonId: string;
  page?: number;
  limit?: number;
}) => {
  const [result, [countResult]] = await Promise.all([
    db.query.Matches.findMany({
      where: (match, { eq }) => eq(match.seasonId, seasonId),
      with: {
        matchPlayers: {
          columns: { homeTeam: true, seasonPlayerId: true },
        },
      },
      offset: (page - 1) * limit,
      limit,
      orderBy: (match, { desc }) => [desc(match.createdAt)],
    }),
    db.select({ count: count() }).from(Matches).where(eq(Matches.seasonId, seasonId)),
  ]);

  return {
    matches: result.map(
      (match) =>
        ({
          id: match.id,
          homeScore: match.homeScore,
          awayScore: match.awayScore,
          createdAt: match.createdAt,
          homeTeamSeasonPlayerIds: match.matchPlayers
            .filter((p) => p.homeTeam)
            .map((p) => p.seasonPlayerId),
          awayTeamSeasonPlayerIds: match.matchPlayers
            .filter((p) => !p.homeTeam)
            .map((p) => p.seasonPlayerId),
        }) satisfies z.infer<typeof Match>,
    ),
    totalCount: countResult?.count ?? 0,
    page,
    limit,
    totalPages: Math.ceil((countResult?.count ?? 0) / limit),
  };
};

export const findLatest = async ({ seasonId }: { seasonId: string }) => {
  const match = await db.query.Matches.findFirst({
    with: {
      matchPlayers: { columns: { seasonPlayerId: true, homeTeam: true } },
    },
    where: (match, { eq }) => eq(match.seasonId, seasonId),
    orderBy: desc(Matches.createdAt),
  });

  return (
    match && {
      id: match.id,
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      createdAt: match.createdAt,
      homeTeamSeasonPlayerIds: match.matchPlayers
        .filter((p) => p.homeTeam)
        .map((p) => p.seasonPlayerId),
      awayTeamSeasonPlayerIds: match.matchPlayers
        .filter((p) => !p.homeTeam)
        .map((p) => p.seasonPlayerId),
    }
  );
};

export const findById = async ({ seasonId, matchId }: { seasonId: string; matchId: string }) => {
  const match = await db.query.Matches.findFirst({
    with: {
      matchPlayers: { columns: { seasonPlayerId: true, homeTeam: true } },
    },
    where: (match, { eq }) => and(eq(match.seasonId, seasonId), eq(match.id, matchId)),
    orderBy: desc(Matches.createdAt),
  });

  return (
    match && {
      id: match.id,
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      createdAt: match.createdAt,
      homeTeamSeasonPlayerIds: match.matchPlayers
        .filter((p) => p.homeTeam)
        .map((p) => p.seasonPlayerId),
      awayTeamSeasonPlayerIds: match.matchPlayers
        .filter((p) => !p.homeTeam)
        .map((p) => p.seasonPlayerId),
    }
  );
};

const findAndValidateSeasonPlayers = async ({
  seasonId,
  seasonPlayerIds,
}: {
  seasonId: string;
  seasonPlayerIds: string[];
}) => {
  const players = await db.query.SeasonPlayers.findMany({
    where: and(eq(SeasonPlayers.seasonId, seasonId), inArray(SeasonPlayers.id, seasonPlayerIds)),
    with: {
      leaguePlayer: {
        columns: { id: true },
        with: { user: { columns: { name: true } } },
      },
    },
  });
  if (players.length !== seasonPlayerIds.length) {
    throw new ScoreBrawlError({
      code: "BAD_REQUEST",
      message: "some players in home team not part of season",
    });
  }
  return players;
};

export const remove = async ({
  matchId,
  seasonId,
}: {
  matchId: string;
  seasonId: string;
}) => {
  const [match] = await db
    .select({
      ...getTableColumns(Matches),
      isLatest: sql`CASE WHEN ${Matches.id} = ${db
        .select({ id: Matches.id })
        .from(Matches)
        .innerJoin(Seasons, eq(Seasons.id, Matches.seasonId))
        .where(eq(Matches.seasonId, seasonId))
        .orderBy(desc(Matches.createdAt))
        .limit(1)} THEN true ELSE false END`.as("isLatest"),
    })
    .from(Matches)
    .where(and(eq(Matches.id, matchId), eq(Matches.seasonId, seasonId)))
    .limit(1);
  if (!match) {
    throw new ScoreBrawlError({
      code: "NOT_FOUND",
      message: "Match not found",
    });
  }
  if (!match.isLatest) {
    throw new ScoreBrawlError({
      code: "FORBIDDEN",
      message: "Only the last match can be deleted",
    });
  }

  const seasonPlayerIds = await db
    .select({ seasonPlayerId: MatchPlayers.seasonPlayerId })
    .from(SeasonPlayers)
    .innerJoin(MatchPlayers, eq(MatchPlayers.seasonPlayerId, SeasonPlayers.id))
    .where(eq(MatchPlayers.matchId, matchId));
  await revertScores({ matchId });
  await revertTeamScores({ matchId });
  await db.delete(MatchPlayers).where(eq(MatchPlayers.matchId, match.id));
  await db.delete(MatchTeams).where(eq(MatchTeams.matchId, match.id));
  await db.delete(Matches).where(eq(Matches.id, match.id));

  return seasonPlayerIds.map((sp) => sp.seasonPlayerId);
};

const revertScores = async ({ matchId }: { matchId: string }) => {
  const players = await db.select().from(MatchPlayers).where(eq(MatchPlayers.matchId, matchId));
  const playerUpdateData = players.map((mp) => ({
    id: mp.seasonPlayerId,
    score: mp.scoreBefore,
  }));
  const sqlChunks: SQL[] = [];

  sqlChunks.push(sql`case`);
  for (const update of playerUpdateData) {
    sqlChunks.push(sql`when id = ${update.id} then ${update.score}`);
  }
  sqlChunks.push(sql`else score end`);
  const finalSql: SQL = sql.join(sqlChunks, sql.raw(" "));

  await db
    .update(SeasonPlayers)
    .set({ score: finalSql })
    .where(
      inArray(
        SeasonPlayers.id,
        playerUpdateData.map((sp) => sp.id),
      ),
    );
};

const revertTeamScores = async ({ matchId }: { matchId: string }) => {
  const teams = await db.select().from(MatchTeams).where(eq(MatchTeams.matchId, matchId));
  const teamUpdateData = teams.map((mt) => ({
    id: mt.seasonTeamId,
    score: mt.scoreBefore,
  }));
  const sqlChunks: SQL[] = [];

  sqlChunks.push(sql`case`);
  for (const update of teamUpdateData) {
    sqlChunks.push(sql`when id = ${update.id} then ${update.score}`);
  }
  sqlChunks.push(sql`else score end`);
  const finalSql: SQL = sql.join(sqlChunks, sql.raw(" "));

  await db
    .update(SeasonTeams)
    .set({ score: finalSql })
    .where(
      inArray(
        SeasonTeams.id,
        teamUpdateData.map((sp) => sp.id),
      ),
    );
};

type CalculateMatchTeamResult = {
  winningOdds: number;
  players: { id: string; scoreAfter: number }[];
};

const calculateMatchResult = ({
  season,
  homeScore,
  awayScore,
  homePlayers,
  awayPlayers,
}: {
  season: typeof Seasons.$inferSelect;
  homeScore: number;
  awayScore: number;
  homePlayers: { id: string; score: number }[];
  awayPlayers: { id: string; score: number }[];
}): {
  homeTeam: CalculateMatchTeamResult;
  awayTeam: CalculateMatchTeamResult;
} => {
  if (season.scoreType === "elo" || season.scoreType === "elo-individual-vs-team") {
    return calculateElo(season, homeScore, homePlayers, awayScore, awayPlayers);
  }

  if (season.scoreType === "3-1-0") {
    return calculate310(homePlayers, homeScore, awayScore, awayPlayers);
  }

  throw new ScoreBrawlError({
    message: "Oh my lord!",
    code: "INTERNAL_SERVER_ERROR",
  });
};

const calculateElo = (
  season: typeof Seasons.$inferSelect,
  homeScore: number,
  homePlayers: {
    id: string;
    score: number;
  }[],
  awayScore: number,
  awayPlayers: { id: string; score: number }[],
) => {
  const eloIndividualMatch = new TeamMatch({
    kFactor: season.kFactor,
    calculationStrategy:
      season.scoreType === "elo"
        ? CalculationStrategy.AVERAGE_TEAMS
        : CalculationStrategy.WEIGHTED_TEAMS,
  });
  const eloHomeTeam = eloIndividualMatch.addTeam("home", homeScore);
  for (const p of homePlayers) {
    eloHomeTeam.addPlayer(new Player(p.id, p.score));
  }
  const eloAwayTeam = eloIndividualMatch.addTeam("away", awayScore);
  for (const p of awayPlayers) {
    eloAwayTeam.addPlayer(new Player(p.id, p.score));
  }
  const eloMatchResult = eloIndividualMatch.calculate();
  return {
    homeTeam: {
      winningOdds: eloHomeTeam.expectedScoreAgainst(eloAwayTeam),
      players: eloHomeTeam.players.map((p) => ({
        id: p.identifier,
        scoreAfter: eloMatchResult.results.find((r) => r.identifier === p.identifier)
          ?.rating as number,
      })),
    },
    awayTeam: {
      winningOdds: eloAwayTeam.expectedScoreAgainst(eloHomeTeam),
      players: eloAwayTeam.players.map((p) => ({
        id: p.identifier,
        scoreAfter: eloMatchResult.results.find((r) => r.identifier === p.identifier)
          ?.rating as number,
      })),
    },
  };
};

const calculate310 = (
  homePlayers: { id: string; score: number }[],
  homeScore: number,
  awayScore: number,
  awayPlayers: {
    id: string;
    score: number;
  }[],
) => ({
  homeTeam: {
    winningOdds: 0.5,
    players: homePlayers.map((p) => ({
      id: p.id,
      scoreAfter: p.score + (homeScore > awayScore ? 3 : homeScore === awayScore ? 1 : 0),
    })),
  },
  awayTeam: {
    winningOdds: 0.5,
    players: awayPlayers.map((p) => ({
      id: p.id,
      scoreAfter: p.score + (awayScore > homeScore ? 3 : awayScore === homeScore ? 1 : 0),
    })),
  },
});
