import { TRPCError } from "@trpc/server";
import { z } from "zod";

import type { Database } from "@scorebrawl/database";
import { LeaguePlayerDTO } from "@scorebrawl/database/dto";
import {
  getAll,
  getBestSeason,
  getLeaguePlayerWithLeagueVerification,
  getPlayerEloProgression,
  getPlayerStats,
  getRecentMatches,
  getTeammateAnalysis,
} from "@scorebrawl/database/repositories/league-player-repository";
import { findActive } from "@scorebrawl/database/repositories/season-repository";
import { createTRPCRouter, leagueProcedure } from "../trpc";

const checkSeasonSupportsPlayerProfiles = async (db: Database, leagueId: string) => {
  const activeSeason = await findActive(db, { leagueId });
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
    .query(async ({ ctx: { db, league } }) => {
      const players = await getAll(db, { leagueId: league.id });
      return z.array(LeaguePlayerDTO).parse(players);
    }),

  getById: leagueProcedure
    .input(z.object({ leagueSlug: z.string(), leaguePlayerId: z.string() }))
    .query(async ({ input: { leaguePlayerId }, ctx: { db, league } }) => {
      await checkSeasonSupportsPlayerProfiles(db, league.id);

      const player = await getLeaguePlayerWithLeagueVerification(db, {
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
    .query(async ({ input: { leaguePlayerId }, ctx: { db, league } }) => {
      await checkSeasonSupportsPlayerProfiles(db, league.id);
      return await getPlayerEloProgression(db, { leaguePlayerId });
    }),

  getRecentMatches: leagueProcedure
    .input(z.object({ leagueSlug: z.string(), leaguePlayerId: z.string() }))
    .query(async ({ input: { leaguePlayerId }, ctx: { db, league } }) => {
      await checkSeasonSupportsPlayerProfiles(db, league.id);
      return await getRecentMatches(db, { leaguePlayerId, limit: 10 });
    }),

  getBestTeammate: leagueProcedure
    .input(z.object({ leagueSlug: z.string(), leaguePlayerId: z.string() }))
    .query(async ({ input: { leaguePlayerId }, ctx: { db, league } }) => {
      await checkSeasonSupportsPlayerProfiles(db, league.id);
      const analysis = await getTeammateAnalysis(db, { leaguePlayerId });
      return analysis.bestTeammate;
    }),

  getWorstTeammate: leagueProcedure
    .input(z.object({ leagueSlug: z.string(), leaguePlayerId: z.string() }))
    .query(async ({ input: { leaguePlayerId }, ctx: { db, league } }) => {
      await checkSeasonSupportsPlayerProfiles(db, league.id);
      const analysis = await getTeammateAnalysis(db, { leaguePlayerId });
      return analysis.worstTeammate;
    }),

  getPlayerStats: leagueProcedure
    .input(z.object({ leagueSlug: z.string(), leaguePlayerId: z.string() }))
    .query(async ({ input: { leaguePlayerId }, ctx: { db, league } }) => {
      await checkSeasonSupportsPlayerProfiles(db, league.id);
      return await getPlayerStats(db, { leaguePlayerId });
    }),

  getBestSeason: leagueProcedure
    .input(z.object({ leagueSlug: z.string(), leaguePlayerId: z.string() }))
    .query(async ({ input: { leaguePlayerId }, ctx: { db, league } }) => {
      await checkSeasonSupportsPlayerProfiles(db, league.id);
      return await getBestSeason(db, { leaguePlayerId });
    }),
});
