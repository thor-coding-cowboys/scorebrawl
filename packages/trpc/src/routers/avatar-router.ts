//

import {
  getSeasonPlayerAvatars,
  getSeasonTeamAvatars,
  getUserAvatar,
} from "@scorebrawl/database/repositories/user-repository";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure, seasonProcedure } from "../trpc";

export const avatarRouter = createTRPCRouter({
  getByUserId: protectedProcedure
    .input(z.object({ userId: z.string() }))
    .query(({ ctx, input: { userId } }) => getUserAvatar(ctx.db, { userId })),
  getBySeasonTeamIds: seasonProcedure
    .input(
      z.object({
        leagueSlug: z.string(),
        seasonSlug: z.string(),
        seasonTeamIds: z.array(z.string()).min(1),
      }),
    )
    .query(({ ctx, input: { seasonTeamIds } }) => getSeasonTeamAvatars(ctx.db, { seasonTeamIds })),
  getBySeasonPlayerIds: seasonProcedure
    .input(
      z.object({
        leagueSlug: z.string(),
        seasonSlug: z.string(),
        seasonPlayerIds: z.array(z.string()).min(1),
      }),
    )
    .query(async ({ ctx, input: { seasonPlayerIds } }) => {
      const result = await getSeasonPlayerAvatars(ctx.db, { seasonPlayerIds });
      return result.map((r) => ({
        ...r,
        image: r.image ?? undefined,
      }));
    }),
});
