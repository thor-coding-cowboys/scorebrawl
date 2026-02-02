import { endOfDay, startOfDay } from "date-fns";
import { eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "../db";
import { LeaguePlayers } from "../schema";

export const getLeaguePlayers = async ({ leagueId }: { leagueId: string }) => {
  const leaguePlayerResult = await db.query.LeaguePlayers.findMany({
    columns: { id: true, createdAt: true, disabled: true, userId: true },
    where: eq(LeaguePlayers.leagueId, leagueId),
    with: {
      user: {
        columns: { name: true, image: true },
      },
    },
  });

  return leaguePlayerResult.map((lp) => ({
    id: lp.id,
    userId: lp.userId,
    name: lp.user.name,
    image: lp.user.image ?? undefined,
    joinedAt: lp.createdAt,
    disabled: lp.disabled,
  }));
};

export const getSeasonPlayersPointDiff = async ({
  seasonPlayerIds,
  from = startOfDay(new Date()),
  to = endOfDay(new Date()),
}: {
  seasonPlayerIds: string[];
  from?: Date;
  to?: Date;
}) => {
  const result = await db.query.MatchPlayers.findMany({
    where: (matchPlayer, { and }) =>
      and(
        inArray(matchPlayer.seasonPlayerId, seasonPlayerIds),
        gte(matchPlayer.createdAt, from),
        lte(matchPlayer.createdAt, to),
      ),
    orderBy: (matchPlayer, { asc }) => [asc(matchPlayer.createdAt)],
  });
  if (result.length === 0) {
    return [];
  }
  type MatchPlayerType = (typeof result)[0];
  type SeasonPlayerMatches = {
    seasonPlayerId: string;
    matches: MatchPlayerType[];
  };
  const seasonPlayerMatches = result.reduce((acc: SeasonPlayerMatches[], curr: MatchPlayerType) => {
    const { seasonPlayerId } = curr;
    const index = acc.findIndex(
      (item: SeasonPlayerMatches) => item.seasonPlayerId === seasonPlayerId,
    );
    index !== -1 ? acc[index]?.matches.push(curr) : acc.push({ seasonPlayerId, matches: [curr] });
    return acc;
  }, []);

  return seasonPlayerMatches.map((spm) => ({
    seasonPlayerId: spm.seasonPlayerId,
    pointsDiff:
      (spm.matches[spm.matches.length - 1]?.scoreAfter ?? 0) - (spm.matches[0]?.scoreBefore ?? 0),
  }));
};
