import { z } from "zod";

import { UserDTO } from "@scorebrawl/database/dto";
import {
  findUserById,
  setDefaultLeague,
  updateUser,
} from "@scorebrawl/database/repositories/user-repository";
import { createTRPCRouter, leagueProcedure, protectedProcedure } from "../trpc";

export const userRouter = createTRPCRouter({
  me: protectedProcedure.query(async ({ ctx }) => {
    const user = await findUserById({ id: ctx.session.user.id });
    return UserDTO.parse({
      userId: user?.id,
      name: user?.name,
      image: user?.image ?? undefined,
      defaultLeagueId: user?.defaultLeagueId ?? undefined,
    });
  }),
  // Note: setPassword is app-specific and should be implemented in the app layer
  // It requires access to the auth instance and Next.js headers
  update: protectedProcedure
    .input(
      z.object({
        name: z.string().optional(),
        image: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await updateUser({
        id: ctx.session.user.id,
        name: input.name,
        image: input.image,
      });
    }),
  setDefaultLeague: leagueProcedure.input(z.object({ leagueSlug: z.string() })).query(({ ctx }) =>
    setDefaultLeague({
      leagueId: ctx.league.id,
      userId: ctx.session.user.id,
    }),
  ),
});
