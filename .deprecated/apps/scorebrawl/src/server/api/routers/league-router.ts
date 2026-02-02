import { create, getUserLeagues, update } from "@/db/repositories/league-repository";
import { z } from "zod";

import { LeagueCreateDTO, LeagueEditDTO } from "@/dto";
import { LeagueCreate, LeagueEdit } from "@/model";
import {
  createTRPCRouter,
  leagueEditorProcedure,
  leagueProcedure,
  protectedProcedure,
} from "@/server/api/trpc";
import { editorRoles } from "@/utils/permission-util";

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
      getUserLeagues({
        userId: ctx.session.user.id,
        search: input?.search,
      }),
    ),
  create: protectedProcedure
    .input(LeagueCreateDTO)
    .mutation(({ ctx, input }) =>
      create(LeagueCreate.parse({ ...input, userId: ctx.session.user.id })),
    ),
  update: leagueEditorProcedure
    .input(LeagueEditDTO)
    .mutation(({ ctx: { league, auth }, input }) =>
      update(LeagueEdit.parse({ ...input, userId: auth.user.id, id: league.id })),
    ),
});
