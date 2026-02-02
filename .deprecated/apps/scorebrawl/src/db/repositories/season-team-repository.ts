import { db } from "@/db";
import { type SQL, and, desc, eq, sql } from "drizzle-orm";
import {
  LeaguePlayers,
  LeagueTeamPlayers,
  LeagueTeams,
  Leagues,
  MatchTeams,
  Matches,
  SeasonTeams,
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
      seasonTeamId: MatchTeams.seasonTeamId,
      matchDate: sql<string>`DATE(${MatchTeams.createdAt})`.mapWith(String).as("match_date"),
      scoreBefore: MatchTeams.scoreBefore,
      scoreAfter: MatchTeams.scoreAfter,
      rnAsc:
        sql<number>`ROW_NUMBER() OVER (PARTITION BY ${MatchTeams.seasonTeamId}, DATE(${MatchTeams.createdAt}) ORDER BY ${MatchTeams.createdAt}, ${MatchTeams.id})`
          .mapWith(Number)
          .as("rn_asc"),
      rnDesc:
        sql<number>`ROW_NUMBER() OVER (PARTITION BY ${MatchTeams.seasonTeamId}, DATE(${MatchTeams.createdAt}) ORDER BY ${MatchTeams.createdAt} DESC, ${MatchTeams.id} DESC)`
          .mapWith(Number)
          .as("rn_desc"),
    })
    .from(MatchTeams)
    .innerJoin(SeasonTeams, eq(MatchTeams.seasonTeamId, SeasonTeams.id))
    .where(
      condition
        ? and(eq(SeasonTeams.seasonId, seasonId), condition)
        : eq(SeasonTeams.seasonId, seasonId),
    );
  const rankedMatches = db.$with("ranked_matches").as(subQuery);
  const firstMatchAlias = sql`${rankedMatches} "first_match"`;
  const firstMatch = subQuery.as("first_match");
  const lastMatchAlias = sql`${rankedMatches} "last_match"`;
  const lastMatch = subQuery.as("last_match");

  return db
    .with(rankedMatches)
    .select({
      seasonTeamId: SeasonTeams.id,
      matchDate: sql`"first_match"."match_date"`.mapWith(String),
      pointDiff: sql<number>`${lastMatch.scoreAfter} - ${firstMatch.scoreBefore}`.mapWith(Number),
    })
    .from(firstMatchAlias)
    .innerJoin(
      lastMatchAlias,
      and(
        eq(firstMatch.seasonTeamId, lastMatch.seasonTeamId),
        eq(sql`"first_match"."match_date"`, sql`"last_match"."match_date"`),
        eq(sql`"first_match"."rn_asc"`, 1),
        eq(sql`"last_match"."rn_desc"`, 1),
      ),
    )
    .innerJoin(SeasonTeams, eq(SeasonTeams.id, firstMatch.seasonTeamId))
    .where(eq(SeasonTeams.seasonId, seasonId))
    .groupBy(
      SeasonTeams.id,
      lastMatch.scoreAfter,
      firstMatch.scoreBefore,
      sql`"first_match"."match_date"`,
    );
};

const matchesSubqueryBuilder = ({ seasonId }: { seasonId: string }) =>
  db
    .select({
      seasonTeamId: MatchTeams.seasonTeamId,
      matchId: MatchTeams.matchId,
      result: MatchTeams.result,
      createdAt: MatchTeams.createdAt,
      rowNumber:
        sql`ROW_NUMBER() OVER (PARTITION BY ${MatchTeams.seasonTeamId} ORDER BY ${MatchTeams.createdAt} DESC)`.as(
          "rowNumber",
        ),
    })
    .from(MatchTeams)
    .innerJoin(Matches, eq(Matches.id, MatchTeams.matchId))
    .innerJoin(SeasonTeams, eq(SeasonTeams.id, MatchTeams.seasonTeamId))
    .where(eq(SeasonTeams.seasonId, seasonId))
    .as("recent_matches");

export const getStanding = async ({ seasonId }: { seasonId: string }) => {
  const matchesSubquery = matchesSubqueryBuilder({ seasonId });

  const teamStats = await db
    .select({
      seasonTeamId: matchesSubquery.seasonTeamId,
      totalGames: sql<number>`COUNT(*)`.as("totalGames"),
      wins: sql<number>`SUM(CASE WHEN ${matchesSubquery.result} = 'W' THEN 1 ELSE 0 END)`.as(
        "wins",
      ),
      losses: sql<number>`SUM(CASE WHEN ${matchesSubquery.result} = 'L' THEN 1 ELSE 0 END)`.as(
        "losses",
      ),
      draws: sql<number>`SUM(CASE WHEN ${matchesSubquery.result} = 'D' THEN 1 ELSE 0 END)`.as(
        "draws",
      ),
      recentResults:
        sql`STRING_AGG(${matchesSubquery.result}, ',' ORDER BY ${matchesSubquery.createdAt} DESC)`.as(
          "recentResults",
        ),
    })
    .from(matchesSubquery)
    .groupBy(matchesSubquery.seasonTeamId);
  const teams = await db
    .select({
      name: LeagueTeams.name,
      seasonTeamId: SeasonTeams.id,
      score: SeasonTeams.score,
    })
    .from(SeasonTeams)
    .innerJoin(LeagueTeams, eq(LeagueTeams.id, SeasonTeams.teamId))
    .where(eq(SeasonTeams.seasonId, seasonId))
    .orderBy(desc(SeasonTeams.score));

  const pointDiff = await getPointDiffProgression({
    seasonId,
    condition: eq(sql`DATE(${MatchTeams.createdAt})`, sql`CURRENT_DATE`),
  });

  return teams.map((p) => {
    const stats = teamStats.find((ps) => ps.seasonTeamId === p.seasonTeamId);
    const form = (stats?.recentResults as string)?.split(",")?.slice(0, 5) ?? [];

    return {
      seasonTeamId: p.seasonTeamId,
      name: p.name,
      score: p.score,
      matchCount: stats?.totalGames ?? 0,
      winCount: stats?.wins ?? 0,
      lossCount: stats?.losses ?? 0,
      drawCount: stats?.draws ?? 0,
      form: (form as ("W" | "D" | "L")[]).reverse(),
      pointDiff: pointDiff.find((pd) => pd.seasonTeamId === p.seasonTeamId)?.pointDiff ?? 0,
    };
  });
};

export const getTopTeam = async ({ seasonSlug }: { seasonSlug: string }) => {
  const topTeamSubquery = db
    .select({
      seasonTeamId: SeasonTeams.id,
      maxScore: SeasonTeams.score,
    })
    .from(SeasonTeams)
    .innerJoin(Seasons, and(eq(Seasons.id, SeasonTeams.seasonId), eq(Seasons.slug, seasonSlug)))
    .orderBy(desc(SeasonTeams.score))
    .limit(1)
    .as("top_team");

  return db
    .select({
      seasonTeamId: SeasonTeams.id,
      id: Users.id,
      teamName: LeagueTeams.name,
      name: Users.name,
      image: Users.image,
      score: SeasonTeams.score,
    })
    .from(SeasonTeams)
    .innerJoin(topTeamSubquery, eq(topTeamSubquery.seasonTeamId, SeasonTeams.id))
    .innerJoin(Seasons, and(eq(Seasons.id, SeasonTeams.seasonId), eq(Seasons.slug, seasonSlug)))
    .innerJoin(Leagues, eq(Seasons.leagueId, Leagues.id))
    .innerJoin(LeagueTeams, eq(LeagueTeams.id, SeasonTeams.teamId))
    .innerJoin(LeagueTeamPlayers, eq(LeagueTeamPlayers.teamId, LeagueTeams.id))
    .innerJoin(LeaguePlayers, eq(LeaguePlayers.id, LeagueTeamPlayers.leaguePlayerId))
    .innerJoin(Users, eq(Users.id, LeaguePlayers.userId));
};
