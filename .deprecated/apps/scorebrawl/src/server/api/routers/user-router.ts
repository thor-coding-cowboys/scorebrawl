import { z } from "zod";

import { findUserById, setDefaultLeague, updateUser } from "@/db/repositories/user-repository";
import { UserDTO } from "@/dto";
import { auth } from "@/lib/auth";
import { createTRPCRouter, leagueProcedure, protectedProcedure } from "@/server/api/trpc";
import { headers } from "next/headers";

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
  setPassword: protectedProcedure
    .input(z.object({ password: z.string() }))
    .mutation(async ({ input: { password } }) => {
      await auth.api.setPassword({
        body: { newPassword: password },
        headers: await headers(),
      });
    }),
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
