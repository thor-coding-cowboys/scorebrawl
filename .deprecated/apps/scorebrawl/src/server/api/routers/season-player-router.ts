import { z } from "zod";

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
} from "@/db/repositories/season-player-repository";
import { SeasonPlayerDTO, SeasonPlayerStandingDTO } from "@/dto";
import { createTRPCRouter, seasonProcedure } from "@/server/api/trpc";

export const seasonPlayerRouter = createTRPCRouter({
  getAll: seasonProcedure
    .input(z.object({ seasonSlug: z.string(), leagueSlug: z.string() }))
    .query(async ({ ctx: { season } }) => {
      const seasonPlayers = await findAll({ seasonId: season.id });
      return z.array(SeasonPlayerDTO).parse(seasonPlayers);
    }),
  getTop: seasonProcedure
    .input(z.object({ seasonSlug: z.string(), leagueSlug: z.string() }))
    .query(async ({ ctx: { season } }) => {
      const player = await getTopPlayer({
        seasonId: season.id,
      });
      return SeasonPlayerDTO.optional().parse(player);
    }),
  getStruggling: seasonProcedure
    .input(z.object({ seasonSlug: z.string(), leagueSlug: z.string() }))
    .query(async ({ ctx: { season } }) => {
      const player = await getStruggling({
        seasonId: season.id,
      });
      return SeasonPlayerStandingDTO.optional().parse(player);
    }),
  getOnFire: seasonProcedure
    .input(z.object({ seasonSlug: z.string(), leagueSlug: z.string() }))
    .query(async ({ ctx: { season } }) => {
      const player = await getOnFire({
        seasonId: season.id,
      });
      return SeasonPlayerStandingDTO.optional().parse(player);
    }),
  getStanding: seasonProcedure
    .input(z.object({ seasonSlug: z.string(), leagueSlug: z.string() }))
    .query(async ({ ctx: { season } }) => {
      const standing = await getStanding({
        seasonId: season.id,
      });
      return z.array(SeasonPlayerStandingDTO).parse(standing);
    }),
  isInSeason: seasonProcedure
    .input(z.object({ seasonSlug: z.string(), leagueSlug: z.string() }))
    .query(async ({ ctx: { season, auth } }) =>
      isUserInSeason({
        seasonId: season.id,
        userId: auth.user.id,
      }),
    ),
  getPointProgression: seasonProcedure
    .input(z.object({ seasonSlug: z.string(), leagueSlug: z.string() }))
    .query(async ({ ctx: { season } }) => getPointProgression({ seasonId: season.id })),
  getPointDiffProgression: seasonProcedure
    .input(z.object({ seasonSlug: z.string(), leagueSlug: z.string() }))
    .query(async ({ ctx: { season } }) => getPointDiffProgression({ seasonId: season.id })),
  getTeammateStatistics: seasonProcedure
    .input(
      z.object({
        seasonSlug: z.string(),
        leagueSlug: z.string(),
        seasonPlayerId: z.string(),
      }),
    )
    .query(async ({ input: { seasonPlayerId } }) => {
      const stats = await getTeammateStatistics({
        seasonPlayerId: seasonPlayerId,
      });
      return stats;
    }),
});
