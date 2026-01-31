import { z } from "zod";

import { getAchievements } from "@scorebrawl/database/repositories/achievement-repository";
import { createTRPCRouter, leagueProcedure } from "../trpc";

export const achievementRouter = createTRPCRouter({
  getUserAchievements: leagueProcedure
    .input(z.object({ leagueSlug: z.string(), leaguePlayerId: z.string() }))
    .query(({ ctx, input }) =>
      getAchievements(ctx.db, {
        leagueId: ctx.league.id,
        leaguePlayerId: input.leaguePlayerId,
      }),
    ),
});
