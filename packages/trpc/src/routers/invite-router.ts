import { create, findByLeagueId } from "@scorebrawl/database/repositories/invite-repository";
import { z } from "zod";

import { InviteInputDTO } from "@scorebrawl/database/dto";
import { createTRPCRouter, leagueEditorProcedure } from "../trpc";

export const inviteRouter = createTRPCRouter({
  getAll: leagueEditorProcedure.input(z.object({ leagueSlug: z.string() })).query(({ ctx }) =>
    findByLeagueId(ctx.db, {
      leagueId: ctx.league.id,
    }),
  ),
  create: leagueEditorProcedure
    .input(InviteInputDTO)
    .mutation(({ input: { role, expiresAt }, ctx }) =>
      create(ctx.db, {
        leagueId: ctx.league.id,
        userId: ctx.session.user.id,
        role: role,
        expiresAt: expiresAt,
      }),
    ),
});
