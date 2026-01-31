import { LeagueTeamInputDTO } from "@scorebrawl/database/dto";
import {
  getBySeasonPlayerIds,
  getLeagueTeams,
  update,
} from "@scorebrawl/database/repositories/league-team-repository";
import { z } from "zod";
import { createTRPCRouter, leagueProcedure, seasonProcedure } from "../trpc";
import { editorRoles } from "../trpc";

export const leagueTeamRouter = createTRPCRouter({
  getAll: leagueProcedure
    .input(z.object({ leagueSlug: z.string() }))
    .query(async ({ ctx: { db, league } }) => {
      const leagueTeams = await getLeagueTeams(db, { leagueId: league.id });
      return leagueTeams.map((lt) => ({
        id: lt.id,
        name: lt.name,
        createdAt: lt.createdAt,
        players: lt.players.map((p) => ({
          userId: p.leaguePlayer.user.id,
          leaguePlayerId: p.leaguePlayer.id,
          name: p.leaguePlayer.user.name,
          image: p.leaguePlayer.user.image ?? undefined,
        })),
      }));
    }),
  getBySeasonPlayerIds: seasonProcedure
    .input(
      z.object({
        leagueSlug: z.string(),
        seasonSlug: z.string(),
        seasonPlayerIds: z.array(z.string()),
      }),
    )
    .query(({ ctx, input: { seasonPlayerIds } }) =>
      getBySeasonPlayerIds(ctx.db, { seasonPlayerIds }),
    ),
  update: leagueProcedure.input(LeagueTeamInputDTO).mutation(async ({ input, ctx }) =>
    update(ctx.db, {
      ...input,
      userId: ctx.session.user.id,
      isEditor: editorRoles.includes(ctx.role),
    }),
  ),
});
