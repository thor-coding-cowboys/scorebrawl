//

import {
  getSeasonPlayerAvatars,
  getSeasonTeamAvatars,
  getUserAvatar,
} from "@/db/repositories/user-repository";
import { createTRPCRouter, protectedProcedure, seasonProcedure } from "@/server/api/trpc";
import { z } from "zod";

export const avatarRouter = createTRPCRouter({
  getByUserId: protectedProcedure
    .input(z.object({ userId: z.string() }))
    .query(({ input: { userId } }) => getUserAvatar({ userId })),
  getBySeasonTeamIds: seasonProcedure
    .input(
      z.object({
        leagueSlug: z.string(),
        seasonSlug: z.string(),
        seasonTeamIds: z.array(z.string()).min(1),
      }),
    )
    .query(({ input: { seasonTeamIds } }) => getSeasonTeamAvatars({ seasonTeamIds })),
  getBySeasonPlayerIds: seasonProcedure
    .input(
      z.object({
        leagueSlug: z.string(),
        seasonSlug: z.string(),
        seasonPlayerIds: z.array(z.string()).min(1),
      }),
    )
    .query(async ({ input: { seasonPlayerIds } }) => {
      const result = await getSeasonPlayerAvatars({ seasonPlayerIds });
      return result.map((r) => ({
        ...r,
        image: r.image ?? undefined,
      }));
    }),
});
