import { z } from "zod";

import { findAll } from "@scorebrawl/database/repositories/member-repository";
import { createTRPCRouter, leagueEditorProcedure } from "../trpc";

export const memberRouter = createTRPCRouter({
  getAll: leagueEditorProcedure
    .input(z.object({ leagueSlug: z.string() }))
    .query(({ ctx }) => findAll(ctx.db, { leagueId: ctx.league.id })),
});
