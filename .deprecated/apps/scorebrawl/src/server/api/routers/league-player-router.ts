import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  getAll,
  getBestSeason,
  getLeaguePlayerWithLeagueVerification,
  getPlayerEloProgression,
  getPlayerStats,
  getRecentMatches,
  getTeammateAnalysis,
} from "@/db/repositories/league-player-repository";
import { findActive } from "@/db/repositories/season-repository";
import { LeaguePlayerDTO } from "@/dto";
import { createTRPCRouter, leagueProcedure } from "@/server/api/trpc";

const checkSeasonSupportsPlayerProfiles = async (leagueId: string) => {
  const activeSeason = await findActive({ leagueId });
  if (!activeSeason) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "No active season found",
    });
  }

  if (activeSeason.scoreType === "3-1-0") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Player profiles are not available for 3-1-0 seasons",
    });
  }

  return activeSeason;
};

export const leaguePlayerRouter = createTRPCRouter({
  getAll: leagueProcedure
    .input(z.object({ leagueSlug: z.string() }))
    .query(async ({ ctx: { league } }) => {
      const players = await getAll({ leagueId: league.id });
      return z.array(LeaguePlayerDTO).parse(players);
    }),

  getById: leagueProcedure
    .input(z.object({ leagueSlug: z.string(), leaguePlayerId: z.string() }))
    .query(async ({ input: { leaguePlayerId }, ctx: { league } }) => {
      await checkSeasonSupportsPlayerProfiles(league.id);

      const player = await getLeaguePlayerWithLeagueVerification({
        leaguePlayerId,
        leagueSlug: league.slug,
      });

      if (!player) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Player not found in this league",
        });
      }

      return player;
    }),

  getEloProgression: leagueProcedure
    .input(z.object({ leagueSlug: z.string(), leaguePlayerId: z.string() }))
    .query(async ({ input: { leaguePlayerId }, ctx: { league } }) => {
      await checkSeasonSupportsPlayerProfiles(league.id);
      return await getPlayerEloProgression({ leaguePlayerId });
    }),

  getRecentMatches: leagueProcedure
    .input(z.object({ leagueSlug: z.string(), leaguePlayerId: z.string() }))
    .query(async ({ input: { leaguePlayerId }, ctx: { league } }) => {
      await checkSeasonSupportsPlayerProfiles(league.id);
      return await getRecentMatches({ leaguePlayerId, limit: 10 });
    }),

  getBestTeammate: leagueProcedure
    .input(z.object({ leagueSlug: z.string(), leaguePlayerId: z.string() }))
    .query(async ({ input: { leaguePlayerId }, ctx: { league } }) => {
      await checkSeasonSupportsPlayerProfiles(league.id);
      const analysis = await getTeammateAnalysis({ leaguePlayerId });
      return analysis.bestTeammate;
    }),

  getWorstTeammate: leagueProcedure
    .input(z.object({ leagueSlug: z.string(), leaguePlayerId: z.string() }))
    .query(async ({ input: { leaguePlayerId }, ctx: { league } }) => {
      await checkSeasonSupportsPlayerProfiles(league.id);
      const analysis = await getTeammateAnalysis({ leaguePlayerId });
      return analysis.worstTeammate;
    }),

  getPlayerStats: leagueProcedure
    .input(z.object({ leagueSlug: z.string(), leaguePlayerId: z.string() }))
    .query(async ({ input: { leaguePlayerId }, ctx: { league } }) => {
      await checkSeasonSupportsPlayerProfiles(league.id);
      return await getPlayerStats({ leaguePlayerId });
    }),

  getBestSeason: leagueProcedure
    .input(z.object({ leagueSlug: z.string(), leaguePlayerId: z.string() }))
    .query(async ({ input: { leaguePlayerId }, ctx: { league } }) => {
      await checkSeasonSupportsPlayerProfiles(league.id);
      return await getBestSeason({ leaguePlayerId });
    }),
});
