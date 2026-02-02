import { db } from "@/db";
import { getRankFromElo } from "@/utils/elo-util";
import { and, count, desc, eq, inArray, sql, sum } from "drizzle-orm";
import {
  LeaguePlayers,
  Leagues,
  MatchPlayers,
  Matches,
  SeasonPlayers,
  Seasons,
  Users,
} from "../schema";
import { findActive } from "./season-repository";

export const getAll = async ({ leagueId }: { leagueId: string }) => {
  // Get active season using the existing findActive function
  const activeSeason = await findActive({ leagueId });

  // If we have an active ELO season, include ELO scores
  if (
    activeSeason &&
    (activeSeason.scoreType === "elo" || activeSeason.scoreType === "elo-individual-vs-team")
  ) {
    const result = await db
      .select({
        leaguePlayerId: LeaguePlayers.id,
        joinedAt: LeaguePlayers.createdAt,
        disabled: LeaguePlayers.disabled,
        userId: Users.id,
        name: Users.name,
        image: Users.image,
        currentElo: SeasonPlayers.score,
      })
      .from(LeaguePlayers)
      .innerJoin(Users, eq(LeaguePlayers.userId, Users.id))
      .leftJoin(
        SeasonPlayers,
        and(
          eq(SeasonPlayers.leaguePlayerId, LeaguePlayers.id),
          eq(SeasonPlayers.seasonId, activeSeason.id),
        ),
      )
      .where(eq(LeaguePlayers.leagueId, leagueId));

    return result.map((lp) => ({
      leaguePlayerId: lp.leaguePlayerId,
      disabled: lp.disabled,
      joinedAt: lp.joinedAt,
      user: { userId: lp.userId, name: lp.name, image: lp.image ?? undefined },
      currentElo: lp.currentElo,
    }));
  }

  // For non-ELO seasons or no active season, return basic data
  const result = await db
    .select({
      leaguePlayerId: LeaguePlayers.id,
      joinedAt: LeaguePlayers.createdAt,
      disabled: LeaguePlayers.disabled,
      userId: Users.id,
      name: Users.name,
      image: Users.image,
    })
    .from(LeaguePlayers)
    .innerJoin(Users, eq(LeaguePlayers.userId, Users.id))
    .where(eq(LeaguePlayers.leagueId, leagueId));

  return result.map((lp) => ({
    leaguePlayerId: lp.leaguePlayerId,
    disabled: lp.disabled,
    joinedAt: lp.joinedAt,
    user: { userId: lp.userId, name: lp.name, image: lp.image ?? undefined },
  }));
};

export const findLeaguePlayerIds = (seasonPlayerIds: string[]) =>
  db
    .select({
      leaguePlayerId: SeasonPlayers.leaguePlayerId,
      seasonPlayerId: SeasonPlayers.id,
      userId: LeaguePlayers.userId,
    })
    .from(SeasonPlayers)
    .innerJoin(LeaguePlayers, eq(LeaguePlayers.id, SeasonPlayers.leaguePlayerId))
    .where(inArray(SeasonPlayers.id, seasonPlayerIds));

export const getLeaguePlayerWithLeagueVerification = async ({
  leaguePlayerId,
  leagueSlug,
}: {
  leaguePlayerId: string;
  leagueSlug: string;
}) => {
  const [result] = await db
    .select({
      leaguePlayerId: LeaguePlayers.id,
      disabled: LeaguePlayers.disabled,
      joinedAt: LeaguePlayers.createdAt,
      userId: Users.id,
      name: Users.name,
      image: Users.image,
      leagueId: Leagues.id,
      leagueName: Leagues.name,
      leagueSlug: Leagues.slug,
    })
    .from(LeaguePlayers)
    .innerJoin(Users, eq(LeaguePlayers.userId, Users.id))
    .innerJoin(Leagues, eq(LeaguePlayers.leagueId, Leagues.id))
    .where(and(eq(LeaguePlayers.id, leaguePlayerId), eq(Leagues.slug, leagueSlug)));

  if (!result) {
    return null;
  }

  return {
    leaguePlayerId: result.leaguePlayerId,
    disabled: result.disabled,
    joinedAt: result.joinedAt,
    user: {
      userId: result.userId,
      name: result.name,
      image: result.image ?? undefined,
    },
    league: {
      leagueId: result.leagueId,
      name: result.leagueName,
      slug: result.leagueSlug,
    },
  };
};

export const getPlayerEloProgression = async ({
  leaguePlayerId,
}: {
  leaguePlayerId: string;
}) => {
  const progression = await db
    .select({
      seasonName: Seasons.name,
      seasonSlug: Seasons.slug,
      startDate: Seasons.startDate,
      endDate: Seasons.endDate,
      finalScore: SeasonPlayers.score,
      initialScore: Seasons.initialScore,
      matchCount: count(MatchPlayers.id),
    })
    .from(SeasonPlayers)
    .innerJoin(Seasons, eq(SeasonPlayers.seasonId, Seasons.id))
    .innerJoin(LeaguePlayers, eq(SeasonPlayers.leaguePlayerId, LeaguePlayers.id))
    .leftJoin(MatchPlayers, eq(MatchPlayers.seasonPlayerId, SeasonPlayers.id))
    .where(eq(SeasonPlayers.leaguePlayerId, leaguePlayerId))
    .groupBy(SeasonPlayers.id, Seasons.id)
    .orderBy(Seasons.startDate);

  return progression.map((season) => ({
    season: season.seasonName,
    slug: season.seasonSlug,
    elo: season.finalScore,
    matches: season.matchCount,
    startDate: season.startDate,
    endDate: season.endDate,
  }));
};

export const getBestSeason = async ({
  leaguePlayerId,
}: {
  leaguePlayerId: string;
}) => {
  const [bestSeason] = await db
    .select({
      seasonName: Seasons.name,
      seasonSlug: Seasons.slug,
      startDate: Seasons.startDate,
      endDate: Seasons.endDate,
      finalScore: SeasonPlayers.score,
      initialScore: Seasons.initialScore,
      matchCount: count(MatchPlayers.id),
    })
    .from(SeasonPlayers)
    .innerJoin(Seasons, eq(SeasonPlayers.seasonId, Seasons.id))
    .innerJoin(LeaguePlayers, eq(SeasonPlayers.leaguePlayerId, LeaguePlayers.id))
    .leftJoin(MatchPlayers, eq(MatchPlayers.seasonPlayerId, SeasonPlayers.id))
    .where(eq(SeasonPlayers.leaguePlayerId, leaguePlayerId))
    .groupBy(SeasonPlayers.id, Seasons.id)
    .orderBy(desc(SeasonPlayers.score))
    .limit(1);

  if (!bestSeason) {
    return null;
  }

  return {
    season: bestSeason.seasonName,
    slug: bestSeason.seasonSlug,
    elo: bestSeason.finalScore,
    matches: bestSeason.matchCount,
    startDate: bestSeason.startDate,
    endDate: bestSeason.endDate,
  };
};

export const getPlayerStats = async ({
  leaguePlayerId,
}: {
  leaguePlayerId: string;
}) => {
  // Get current season stats
  const currentSeasonQuery = await db
    .select({
      currentElo: SeasonPlayers.score,
      seasonName: Seasons.name,
    })
    .from(SeasonPlayers)
    .innerJoin(Seasons, eq(SeasonPlayers.seasonId, Seasons.id))
    .where(eq(SeasonPlayers.leaguePlayerId, leaguePlayerId))
    .orderBy(desc(Seasons.startDate))
    .limit(1);

  // Get total stats across all seasons
  const totalStatsQuery = await db
    .select({
      totalMatches: count(MatchPlayers.id),
      wins: sum(sql<number>`CASE WHEN ${MatchPlayers.result} = 'W' THEN 1 ELSE 0 END`),
      losses: sum(sql<number>`CASE WHEN ${MatchPlayers.result} = 'L' THEN 1 ELSE 0 END`),
      draws: sum(sql<number>`CASE WHEN ${MatchPlayers.result} = 'D' THEN 1 ELSE 0 END`),
    })
    .from(SeasonPlayers)
    .leftJoin(MatchPlayers, eq(MatchPlayers.seasonPlayerId, SeasonPlayers.id))
    .where(eq(SeasonPlayers.leaguePlayerId, leaguePlayerId));

  const [currentSeasonStats] = currentSeasonQuery;
  const [totalStats] = totalStatsQuery;

  if (!currentSeasonStats || !totalStats) {
    return null;
  }

  const totalMatches = totalStats.totalMatches || 0;
  const wins = Number(totalStats.wins) || 0;
  const losses = Number(totalStats.losses) || 0;
  const winRate = totalMatches > 0 ? (wins / totalMatches) * 100 : 0;

  return {
    currentElo: currentSeasonStats.currentElo,
    totalMatches,
    wins,
    losses,
    winRate: Math.round(winRate * 10) / 10,
    currentSeason: currentSeasonStats.seasonName,
    rank: getRankFromElo(currentSeasonStats.currentElo).name,
    team: null, // Will be implemented when team system is ready
  };
};

export const getRecentMatches = async ({
  leaguePlayerId,
  limit = 10,
}: {
  leaguePlayerId: string;
  limit?: number;
}) => {
  const recentMatches = await db
    .select({
      matchId: Matches.id,
      homeScore: Matches.homeScore,
      awayScore: Matches.awayScore,
      createdAt: Matches.createdAt,
      playerResult: MatchPlayers.result,
      playerHomeTeam: MatchPlayers.homeTeam,
      scoreBefore: MatchPlayers.scoreBefore,
      scoreAfter: MatchPlayers.scoreAfter,
      opponentName: sql<string>`
        CASE 
          WHEN ${MatchPlayers.homeTeam} = true 
          THEN (
            SELECT STRING_AGG(u.name, ', ')
            FROM match_player mp2 
            JOIN season_player sp2 ON mp2.season_player_id = sp2.id
            JOIN league_player lp2 ON sp2.league_player_id = lp2.id
            JOIN "user" u ON lp2.user_id = u.id
            WHERE mp2.match_id = ${Matches.id} AND mp2.home_team = false
          )
          ELSE (
            SELECT STRING_AGG(u.name, ', ')
            FROM match_player mp2 
            JOIN season_player sp2 ON mp2.season_player_id = sp2.id
            JOIN league_player lp2 ON sp2.league_player_id = lp2.id
            JOIN "user" u ON lp2.user_id = u.id
            WHERE mp2.match_id = ${Matches.id} AND mp2.home_team = true
          )
        END
      `,
    })
    .from(MatchPlayers)
    .innerJoin(SeasonPlayers, eq(MatchPlayers.seasonPlayerId, SeasonPlayers.id))
    .innerJoin(Matches, eq(MatchPlayers.matchId, Matches.id))
    .where(eq(SeasonPlayers.leaguePlayerId, leaguePlayerId))
    .orderBy(desc(Matches.createdAt))
    .limit(limit);

  return recentMatches.map((match) => {
    const playerScore = match.playerHomeTeam ? match.homeScore : match.awayScore;
    const opponentScore = match.playerHomeTeam ? match.awayScore : match.homeScore;

    return {
      date: match.createdAt.toISOString().split("T")[0],
      opponent: match.opponentName || "Unknown Opponent",
      score: `${playerScore}-${opponentScore}`,
      result: match.playerResult,
      eloChange: match.scoreAfter - match.scoreBefore,
    };
  });
};

export const getTeammateAnalysis = async ({
  leaguePlayerId,
}: {
  leaguePlayerId: string;
}) => {
  // Get matches where this player played with teammates
  const teammateStats = await db
    .select({
      teammateUserId: sql<string>`teammate_user.id`,
      teammateName: sql<string>`teammate_user.name`,
      teammateImage: sql<string>`teammate_user.image`,
      matchesPlayed: count(sql`DISTINCT ${Matches.id}`),
      wins: sum(sql<number>`CASE WHEN ${MatchPlayers.result} = 'W' THEN 1 ELSE 0 END`),
      losses: sum(sql<number>`CASE WHEN ${MatchPlayers.result} = 'L' THEN 1 ELSE 0 END`),
      eloGained: sum(sql<number>`${MatchPlayers.scoreAfter} - ${MatchPlayers.scoreBefore}`),
    })
    .from(MatchPlayers)
    .innerJoin(SeasonPlayers, eq(MatchPlayers.seasonPlayerId, SeasonPlayers.id))
    .innerJoin(Matches, eq(MatchPlayers.matchId, Matches.id))
    .innerJoin(
      sql`match_player teammate_mp`,
      sql`teammate_mp.match_id = ${Matches.id} 
          AND teammate_mp.home_team = ${MatchPlayers.homeTeam} 
          AND teammate_mp.season_player_id != ${SeasonPlayers.id}`,
    )
    .innerJoin(sql`season_player teammate_sp`, sql`teammate_mp.season_player_id = teammate_sp.id`)
    .innerJoin(sql`league_player teammate_lp`, sql`teammate_sp.league_player_id = teammate_lp.id`)
    .innerJoin(sql`"user" teammate_user`, sql`teammate_lp.user_id = teammate_user.id`)
    .where(eq(SeasonPlayers.leaguePlayerId, leaguePlayerId))
    .groupBy(sql`teammate_user.id`, sql`teammate_user.name`, sql`teammate_user.image`)
    .having(sql`COUNT(DISTINCT ${Matches.id}) >= 3`)
    .orderBy(desc(sql`COUNT(DISTINCT ${Matches.id})`));

  const teammates = teammateStats.map((teammate) => {
    const matches = teammate.matchesPlayed || 0;
    const wins = Number(teammate.wins) || 0;
    const losses = Number(teammate.losses) || 0;
    const winRate = matches > 0 ? (wins / matches) * 100 : 0;
    const eloGained = Number(teammate.eloGained) || 0;

    return {
      name: teammate.teammateName,
      avatar: teammate.teammateImage,
      matchesTogether: matches,
      wins,
      losses,
      winRate: Math.round(winRate * 10) / 10,
      eloGained,
      eloLost: eloGained < 0 ? Math.abs(eloGained) : 0,
    };
  });

  const bestTeammate =
    teammates.length > 0
      ? teammates.reduce((best, current) => (current.winRate > best.winRate ? current : best))
      : null;

  const worstTeammate =
    teammates.length > 0
      ? teammates.reduce((worst, current) => (current.winRate < worst.winRate ? current : worst))
      : null;

  return {
    bestTeammate,
    worstTeammate,
    allTeammates: teammates,
  };
};
