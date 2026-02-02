import { db } from "@/db";
import type { SeasonPlayerDTO } from "@/dto";
import { type SQL, and, desc, eq, inArray, sql } from "drizzle-orm";
import type z from "zod";
import {
  LeaguePlayers,
  Leagues,
  MatchPlayers,
  Matches,
  SeasonPlayers,
  Seasons,
  Users,
} from "../schema";

export const getPointDiffProgression = async ({
  seasonId,
  condition,
}: {
  seasonId: string;
  condition?: SQL<unknown>;
}) => {
  const subQuery = db
    .select({
      seasonPlayerId: MatchPlayers.seasonPlayerId,
      matchDate: sql<string>`DATE(${MatchPlayers.createdAt})`.mapWith(String).as("match_date"),
      scoreBefore: MatchPlayers.scoreBefore,
      scoreAfter: MatchPlayers.scoreAfter,
      rnAsc:
        sql<number>`ROW_NUMBER() OVER (PARTITION BY ${MatchPlayers.seasonPlayerId}, DATE(${MatchPlayers.createdAt}) ORDER BY ${MatchPlayers.createdAt}, ${MatchPlayers.id})`
          .mapWith(Number)
          .as("rn_asc"),
      rnDesc:
        sql<number>`ROW_NUMBER() OVER (PARTITION BY ${MatchPlayers.seasonPlayerId}, DATE(${MatchPlayers.createdAt}) ORDER BY ${MatchPlayers.createdAt} DESC, ${MatchPlayers.id} DESC)`
          .mapWith(Number)
          .as("rn_desc"),
    })
    .from(MatchPlayers)
    .innerJoin(SeasonPlayers, eq(MatchPlayers.seasonPlayerId, SeasonPlayers.id))
    .where(
      condition
        ? and(eq(SeasonPlayers.seasonId, seasonId), condition)
        : eq(SeasonPlayers.seasonId, seasonId),
    );
  const rankedMatches = db.$with("ranked_matches").as(subQuery);
  const firstMatchAlias = sql`${rankedMatches} "first_match"`;
  const firstMatch = subQuery.as("first_match");
  const lastMatchAlias = sql`${rankedMatches} "last_match"`;
  const lastMatch = subQuery.as("last_match");

  return db
    .with(rankedMatches)
    .select({
      seasonPlayerId: SeasonPlayers.id,
      matchDate: sql`"first_match"."match_date"`.mapWith(String),
      pointDiff: sql<number>`${lastMatch.scoreAfter} - ${firstMatch.scoreBefore}`.mapWith(Number),
    })
    .from(firstMatchAlias)
    .innerJoin(
      lastMatchAlias,
      and(
        eq(firstMatch.seasonPlayerId, lastMatch.seasonPlayerId),
        eq(sql`"first_match"."match_date"`, sql`"last_match"."match_date"`),
        eq(sql`"first_match"."rn_asc"`, 1),
        eq(sql`"last_match"."rn_desc"`, 1),
      ),
    )
    .innerJoin(SeasonPlayers, eq(SeasonPlayers.id, firstMatch.seasonPlayerId))
    .where(eq(SeasonPlayers.seasonId, seasonId))
    .groupBy(
      SeasonPlayers.id,
      lastMatch.scoreAfter,
      firstMatch.scoreBefore,
      sql`"first_match"."match_date"`,
    );
};

export const findAll = async ({ seasonId }: { seasonId: string }) => {
  const result = await db
    .select({
      seasonPlayerId: SeasonPlayers.id,
      leaguePlayerId: SeasonPlayers.leaguePlayerId,
      score: SeasonPlayers.score,
      userId: Users.id,
      name: Users.name,
      image: Users.image,
    })
    .from(SeasonPlayers)
    .innerJoin(Seasons, eq(Seasons.id, SeasonPlayers.seasonId))
    .innerJoin(LeaguePlayers, eq(LeaguePlayers.id, SeasonPlayers.leaguePlayerId))
    .innerJoin(Users, eq(Users.id, LeaguePlayers.userId))
    .where(eq(Seasons.id, seasonId));

  return result.map(
    (sp) =>
      ({
        seasonPlayerId: sp.seasonPlayerId,
        leaguePlayerId: sp.leaguePlayerId,
        score: sp.score,
        user: {
          userId: sp.userId,
          name: sp.name,
          image: sp.image ?? undefined,
        },
      }) satisfies z.infer<typeof SeasonPlayerDTO>,
  );
};

const matchesSubqueryBuilder = ({ seasonId }: { seasonId: string }) =>
  db
    .select({
      seasonPlayerId: MatchPlayers.seasonPlayerId,
      leaguePlayerId: SeasonPlayers.leaguePlayerId,
      score: SeasonPlayers.score,
      matchId: MatchPlayers.matchId,
      result: MatchPlayers.result,
      createdAt: Matches.createdAt,
      rowNumber:
        sql`ROW_NUMBER() OVER (PARTITION BY ${MatchPlayers.seasonPlayerId} ORDER BY ${Matches.createdAt} DESC)`.as(
          "rowNumber",
        ),
    })
    .from(MatchPlayers)
    .innerJoin(Matches, eq(Matches.id, MatchPlayers.matchId))
    .innerJoin(SeasonPlayers, eq(SeasonPlayers.id, MatchPlayers.seasonPlayerId))
    .where(eq(SeasonPlayers.seasonId, seasonId))
    .as("recent_matches");

export const getStanding = async ({ seasonId }: { seasonId: string }) => {
  const matchesSubquery = matchesSubqueryBuilder({ seasonId });

  const playerStats = await db
    .select({
      seasonPlayerId: matchesSubquery.seasonPlayerId,
      totalGames: sql<number>`COUNT(*)`.mapWith(Number).as("totalGames"),
      wins: sql<number>`SUM(CASE WHEN ${matchesSubquery.result} = 'W' THEN 1 ELSE 0 END)`
        .mapWith(Number)
        .as("wins"),
      losses: sql<number>`SUM(CASE WHEN ${matchesSubquery.result} = 'L' THEN 1 ELSE 0 END)`
        .mapWith(Number)
        .as("losses"),
      draws: sql<number>`SUM(CASE WHEN ${matchesSubquery.result} = 'D' THEN 1 ELSE 0 END)`
        .mapWith(Number)
        .as("draws"),
      recentResults:
        sql`STRING_AGG(${matchesSubquery.result}, ',' ORDER BY ${matchesSubquery.createdAt} DESC)`.as(
          "recentResults",
        ),
    })
    .from(matchesSubquery)
    .groupBy(matchesSubquery.seasonPlayerId);

  const players = await db
    .select({
      seasonPlayerId: SeasonPlayers.id,
      leaguePlayerId: SeasonPlayers.leaguePlayerId,
      score: SeasonPlayers.score,
      userId: Users.id,
      name: Users.name,
      image: Users.image,
    })
    .from(SeasonPlayers)
    .innerJoin(LeaguePlayers, eq(LeaguePlayers.id, SeasonPlayers.leaguePlayerId))
    .innerJoin(Users, eq(Users.id, LeaguePlayers.userId))
    .where(eq(SeasonPlayers.seasonId, seasonId))
    .orderBy(desc(SeasonPlayers.score));

  const pointDiff = await getPointDiffProgression({
    seasonId,
    condition: eq(sql`DATE(${MatchPlayers.createdAt})`, sql`CURRENT_DATE`),
  });

  return players.map((p) => {
    const stats = playerStats.find((ps) => ps.seasonPlayerId === p.seasonPlayerId);
    const form = (stats?.recentResults as string)?.split(",")?.slice(0, 5) ?? [];

    return {
      seasonPlayerId: p.seasonPlayerId,
      leaguePlayerId: p.leaguePlayerId,
      score: p.score,
      matchCount: stats?.totalGames ?? 0,
      winCount: stats?.wins ?? 0,
      lossCount: stats?.losses ?? 0,
      drawCount: stats?.draws ?? 0,
      form: (form as ("W" | "D" | "L")[]).reverse(),
      pointDiff: pointDiff.find((pd) => pd.seasonPlayerId === p.seasonPlayerId)?.pointDiff ?? 0,
      user: { userId: p.userId, name: p.name, image: p.image ?? undefined },
    };
  });
};

export const getTopPlayer = async ({ seasonId }: { seasonId: string }) => {
  const [topPlayer] = await db
    .select({
      seasonPlayerId: SeasonPlayers.id,
      leaguePlayerId: LeaguePlayers.id,
      score: SeasonPlayers.score,
      userId: Users.id,
      name: Users.name,
      image: Users.image,
    })
    .from(SeasonPlayers)
    .innerJoin(Seasons, and(eq(Seasons.id, SeasonPlayers.seasonId)))
    .innerJoin(Leagues, eq(Seasons.leagueId, Leagues.id))
    .innerJoin(LeaguePlayers, eq(LeaguePlayers.id, SeasonPlayers.leaguePlayerId))
    .innerJoin(Users, eq(Users.id, LeaguePlayers.userId))
    .where(eq(SeasonPlayers.seasonId, seasonId))
    .orderBy(desc(SeasonPlayers.score));

  return {
    seasonPlayerId: topPlayer?.seasonPlayerId,
    leaguePlayerId: topPlayer?.leaguePlayerId,
    score: topPlayer?.score,
    user: {
      userId: topPlayer?.userId,
      name: topPlayer?.name,
      image: topPlayer?.image ?? undefined,
    },
  };
};

export const getPointProgression = async ({
  seasonId,
}: {
  seasonId: string;
}) => {
  const rankedScores = db.$with("ranked_scores").as(
    db
      .select({
        seasonPlayerId: MatchPlayers.seasonPlayerId,
        seasonId: SeasonPlayers.seasonId,
        score: MatchPlayers.scoreAfter,
        createdAt: MatchPlayers.createdAt,
        date: sql`DATE(${MatchPlayers.createdAt})`.as("date"),
        rowNumber:
          sql<number>`ROW_NUMBER() OVER (PARTITION BY ${MatchPlayers.seasonPlayerId}, DATE(${MatchPlayers.createdAt}) ORDER BY ${MatchPlayers.createdAt} DESC, ${MatchPlayers.id} DESC)`.as(
            "rowNumber",
          ),
      })
      .from(MatchPlayers)
      .innerJoin(SeasonPlayers, eq(SeasonPlayers.id, MatchPlayers.seasonPlayerId))
      .where(eq(SeasonPlayers.seasonId, seasonId)),
  );

  return db
    .with(rankedScores)
    .select({
      seasonPlayerId: rankedScores.seasonPlayerId,
      score: rankedScores.score,
      createdAt: rankedScores.createdAt,
      date: rankedScores.date,
    })
    .from(rankedScores)
    .where(and(eq(rankedScores.seasonId, seasonId), eq(rankedScores.rowNumber, 1)))
    .orderBy(rankedScores.seasonPlayerId, rankedScores.date);
};

const onFireStrugglingQuery = async ({
  seasonId,
  onFire,
}: {
  onFire: boolean;
  seasonId: string;
}) => {
  const recentMatchesSubquery = matchesSubqueryBuilder({ seasonId });
  const last5MatchesSubquery = db
    .select()
    .from(recentMatchesSubquery)
    .where(sql`${recentMatchesSubquery.rowNumber} <= 5`)
    .as("last_5_matches");

  const [playerStats] = await db
    .select({
      seasonPlayerId: last5MatchesSubquery.seasonPlayerId,
      leaguePlayerId: last5MatchesSubquery.leaguePlayerId,
      score: last5MatchesSubquery.score,
      totalGames: sql<number>`COUNT(*)`.mapWith(Number).as("totalGames"),
      wins: sql<number>`SUM(CASE WHEN ${last5MatchesSubquery.result} = 'W' THEN 1 ELSE 0 END)`
        .mapWith(Number)
        .as("wins"),
      losses: sql<number>`SUM(CASE WHEN ${last5MatchesSubquery.result} = 'L' THEN 1 ELSE 0 END)`
        .mapWith(Number)
        .as("losses"),
      draws: sql<number>`SUM(CASE WHEN ${last5MatchesSubquery.result} = 'D' THEN 1 ELSE 0 END)`
        .mapWith(Number)
        .as("draws"),
      recentResults:
        sql`STRING_AGG(${last5MatchesSubquery.result}, ',' ORDER BY ${last5MatchesSubquery.createdAt} DESC)`.as(
          "recentResults",
        ),
    })
    .from(last5MatchesSubquery)
    .groupBy(
      last5MatchesSubquery.seasonPlayerId,
      last5MatchesSubquery.leaguePlayerId,
      last5MatchesSubquery.score,
    )
    .orderBy(
      desc(onFire ? sql`wins` : sql`losses`),
      desc(sql`draws`),
      desc(onFire ? sql`losses` : sql`wins`),
    )
    .limit(1);

  if (!playerStats) {
    return undefined;
  }

  const [userInfo] = await db
    .select({
      userId: Users.id,
      name: Users.name,
      image: Users.image,
    })
    .from(SeasonPlayers)
    .innerJoin(LeaguePlayers, eq(LeaguePlayers.id, SeasonPlayers.leaguePlayerId))
    .innerJoin(Users, eq(Users.id, LeaguePlayers.userId))
    .where(eq(SeasonPlayers.id, playerStats.seasonPlayerId));

  const form = (playerStats?.recentResults as string)?.split(",")?.slice(0, 5) ?? [];
  return {
    seasonPlayerId: playerStats?.seasonPlayerId,
    leaguePlayerId: playerStats?.leaguePlayerId,
    score: playerStats?.score,
    matchCount: playerStats?.totalGames,
    winCount: playerStats?.wins,
    lossCount: playerStats?.losses,
    drawCount: playerStats?.draws,
    form: (form as ("W" | "D" | "L")[]).reverse(),
    user: {
      userId: userInfo?.userId,
      name: userInfo?.name,
      image: userInfo?.image ?? undefined,
    },
  };
};

export const getOnFire = async ({ seasonId }: { seasonId: string }) =>
  onFireStrugglingQuery({ seasonId, onFire: true });

export const getStruggling = async ({ seasonId }: { seasonId: string }) =>
  onFireStrugglingQuery({ seasonId, onFire: false });

export const getPlayerMatches = async ({
  seasonPlayerId,
}: {
  seasonPlayerId: string;
}) => {
  const result = await db
    .select({
      matchId: Matches.id,
      createdAt: Matches.createdAt,
      result: MatchPlayers.result,
      scoreAfter: MatchPlayers.scoreAfter,
      scoreBefore: MatchPlayers.scoreBefore,
    })
    .from(MatchPlayers)
    .innerJoin(Matches, eq(Matches.id, MatchPlayers.matchId))
    .where(eq(MatchPlayers.seasonPlayerId, seasonPlayerId))
    .orderBy(desc(Matches.createdAt));

  return result.map((match) => ({
    matchId: match.matchId,
    createdAt: match.createdAt,
    result: match.result,
    scoreAfter: match.scoreAfter,
    scoreBefore: match.scoreBefore,
  }));
};

export const getGoalsConcededAgainst = async ({
  matchIds,
  seasonPlayerId,
}: {
  matchIds: string[];
  seasonPlayerId: string;
}) => {
  const results = await db
    .select({
      matchId: MatchPlayers.matchId,
      goalsConceded: sql<number>`
        CASE 
          WHEN ${MatchPlayers.homeTeam} = true THEN ${Matches.awayScore}
          ELSE ${Matches.homeScore}
        END
      `,
    })
    .from(MatchPlayers)
    .innerJoin(Matches, eq(MatchPlayers.matchId, Matches.id))
    .where(
      and(inArray(MatchPlayers.matchId, matchIds), eq(MatchPlayers.seasonPlayerId, seasonPlayerId)),
    )
    .execute();

  return results;
};

export const getLastFiveMatchesGoals = async (seasonPlayerId: string) => {
  const result = await db
    .select({
      matchId: MatchPlayers.matchId,
      goalsScored: sql<number>`
          CASE 
            WHEN ${MatchPlayers.homeTeam} = true THEN ${Matches.homeScore}
            ELSE ${Matches.awayScore}
          END
        `,
    })
    .from(MatchPlayers)
    .innerJoin(Matches, eq(MatchPlayers.matchId, Matches.id))
    .where(eq(MatchPlayers.seasonPlayerId, seasonPlayerId))
    .orderBy(desc(Matches.createdAt))
    .limit(5)
    .execute();

  return result.map((r) => r.goalsScored);
};
