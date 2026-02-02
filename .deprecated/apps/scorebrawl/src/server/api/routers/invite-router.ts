import { create, findByLeagueId } from "@/db/repositories/invite-repository";
import { z } from "zod";

import { InviteInputDTO } from "@/dto";
import { createTRPCRouter, leagueEditorProcedure } from "@/server/api/trpc";

export const inviteRouter = createTRPCRouter({
  getAll: leagueEditorProcedure.input(z.object({ leagueSlug: z.string() })).query(({ ctx }) =>
    findByLeagueId({
      leagueId: ctx.league.id,
    }),
  ),
  create: leagueEditorProcedure
    .input(InviteInputDTO)
    .mutation(({ input: { role, expiresAt }, ctx }) =>
      create({
        leagueId: ctx.league.id,
        userId: ctx.session.user.id,
        role: role,
        expiresAt: expiresAt,
      }),
    ),
});
