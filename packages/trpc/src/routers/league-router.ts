import {
  create,
  getUserLeagues,
  update,
} from "@scorebrawl/database/repositories/league-repository";
import { z } from "zod";

import { LeagueCreateDTO, LeagueEditDTO } from "@scorebrawl/database/dto";
import { LeagueCreate, LeagueEdit } from "@scorebrawl/database/model";
import {
  createTRPCRouter,
  leagueEditorProcedure,
  leagueProcedure,
  protectedProcedure,
} from "../trpc";
import { editorRoles } from "../trpc";

export const leagueRouter = createTRPCRouter({
  hasEditorAccess: leagueProcedure
    .input(z.object({ leagueSlug: z.string() }))
    .query(({ ctx }) => editorRoles.some((role) => ctx.role === role)),
  getLeagueBySlugAndRole: leagueProcedure
    .input(z.object({ leagueSlug: z.string() }))
    .query(({ ctx: { league, role } }) => ({
      ...league,
      logoUrl: league.logoUrl ?? undefined,
      role,
    })),
  getAll: protectedProcedure
    .input(z.object({ search: z.string().optional() }).optional())
    .query(({ ctx, input }) =>
      getUserLeagues(ctx.db, {
        userId: ctx.session.user.id,
        search: input?.search,
      }),
    ),
  create: protectedProcedure
    .input(LeagueCreateDTO)
    .mutation(({ ctx, input }) =>
      create(ctx.db, LeagueCreate.parse({ ...input, userId: ctx.session.user.id })),
    ),
  update: leagueEditorProcedure
    .input(LeagueEditDTO)
    .mutation(({ ctx: { league, session, db }, input }) =>
      update(db, LeagueEdit.parse({ ...input, userId: session.user.id, id: league.id })),
    ),
});
