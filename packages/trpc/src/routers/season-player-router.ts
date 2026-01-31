import { z } from "zod";

import { SeasonPlayerDTO, SeasonPlayerStandingDTO } from "@scorebrawl/database/dto";
import {
  findAll,
  getOnFire,
  getPointDiffProgression,
  getPointProgression,
  getStanding,
  getStruggling,
  getTeammateStatistics,
  getTopPlayer,
  isUserInSeason,
} from "@scorebrawl/database/repositories/season-player-repository";
import { createTRPCRouter, seasonProcedure } from "../trpc";

export const seasonPlayerRouter = createTRPCRouter({
  getAll: seasonProcedure
    .input(z.object({ seasonSlug: z.string(), leagueSlug: z.string() }))
    .query(async ({ ctx: { db, season } }) => {
      const seasonPlayers = await findAll(db, { seasonId: season.id });
      return z.array(SeasonPlayerDTO).parse(seasonPlayers);
    }),
  getTop: seasonProcedure
    .input(z.object({ seasonSlug: z.string(), leagueSlug: z.string() }))
    .query(async ({ ctx: { db, season } }) => {
      const player = await getTopPlayer(db, {
        seasonId: season.id,
      });
      return SeasonPlayerDTO.optional().parse(player);
    }),
  getStruggling: seasonProcedure
    .input(z.object({ seasonSlug: z.string(), leagueSlug: z.string() }))
    .query(async ({ ctx: { db, season } }) => {
      const player = await getStruggling(db, {
        seasonId: season.id,
      });
      return SeasonPlayerStandingDTO.optional().parse(player);
    }),
  getOnFire: seasonProcedure
    .input(z.object({ seasonSlug: z.string(), leagueSlug: z.string() }))
    .query(async ({ ctx: { db, season } }) => {
      const player = await getOnFire(db, {
        seasonId: season.id,
      });
      return SeasonPlayerStandingDTO.optional().parse(player);
    }),
  getStanding: seasonProcedure
    .input(z.object({ seasonSlug: z.string(), leagueSlug: z.string() }))
    .query(async ({ ctx: { db, season } }) => {
      const standing = await getStanding(db, {
        seasonId: season.id,
      });
      return z.array(SeasonPlayerStandingDTO).parse(standing);
    }),
  isInSeason: seasonProcedure
    .input(z.object({ seasonSlug: z.string(), leagueSlug: z.string() }))
    .query(async ({ ctx: { db, season, session } }) =>
      isUserInSeason(db, {
        seasonId: season.id,
        userId: session.user.id,
      }),
    ),
  getPointProgression: seasonProcedure
    .input(z.object({ seasonSlug: z.string(), leagueSlug: z.string() }))
    .query(async ({ ctx: { db, season } }) => getPointProgression(db, { seasonId: season.id })),
  getPointDiffProgression: seasonProcedure
    .input(z.object({ seasonSlug: z.string(), leagueSlug: z.string() }))
    .query(async ({ ctx: { db, season } }) => getPointDiffProgression(db, { seasonId: season.id })),
  getTeammateStatistics: seasonProcedure
    .input(
      z.object({
        seasonSlug: z.string(),
        leagueSlug: z.string(),
        seasonPlayerId: z.string(),
      }),
    )
    .query(async ({ ctx, input: { seasonPlayerId } }) => {
      const stats = await getTeammateStatistics(ctx.db, {
        seasonPlayerId: seasonPlayerId,
      });
      return stats;
    }),
});
