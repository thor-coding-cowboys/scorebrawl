import { z } from "zod";

import { findAll } from "@/db/repositories/member-repository";
import { createTRPCRouter, leagueEditorProcedure } from "@/server/api/trpc";

export const memberRouter = createTRPCRouter({
  getAll: leagueEditorProcedure
    .input(z.object({ leagueSlug: z.string() }))
    .query(({ ctx }) => findAll({ leagueId: ctx.league.id })),
});
