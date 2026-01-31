import { z } from "zod";

import { SeasonCreateDTOSchema, SeasonEditDTOSchema } from "@scorebrawl/database/dto";
import { SeasonCreateSchema, SeasonEditSchema } from "@scorebrawl/database/model";
import { getLeaguePlayers } from "@scorebrawl/database/repositories/player-repository";
import {
  create,
  findActive,
  findFixtures,
  getAll,
  getBySlug,
  getCountInfo,
  update,
  updateClosedStatus,
} from "@scorebrawl/database/repositories/season-repository";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, leagueEditorProcedure, leagueProcedure, seasonProcedure } from "../trpc";

const validateStartBeforeEnd = ({
  startDate,
  endDate,
}: {
  startDate?: Date;
  endDate?: Date;
}) => {
  if (endDate && startDate && startDate > endDate) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "End date must be after start date",
    });
  }
};

export const seasonRouter = createTRPCRouter({
  getBySlug: seasonProcedure
    .input(z.object({ leagueSlug: z.string(), seasonSlug: z.string() }))
    .query(({ ctx: { season } }) => season),
  getCountInfo: seasonProcedure
    .input(z.object({ leagueSlug: z.string(), seasonSlug: z.string() }))
    .query(async ({ input: { seasonSlug } }) => getCountInfo({ seasonSlug })),
  findActive: leagueProcedure
    .input(z.object({ leagueSlug: z.string() }))
    .query(async ({ ctx }) => findActive({ leagueId: ctx.league.id })),
  findBySlug: seasonProcedure
    .input(z.object({ leagueSlug: z.string(), seasonSlug: z.string() }))
    .query(async ({ ctx: { season } }) => season),
  getAll: leagueProcedure
    .input(z.object({ leagueSlug: z.string() }))
    .query(async ({ ctx }) => getAll({ leagueId: ctx.league.id })),
  getFixtures: seasonProcedure
    .input(z.object({ leagueSlug: z.string(), seasonSlug: z.string() }))
    .query(async ({ ctx: { season } }) => {
      return findFixtures({ seasonId: season.id });
    }),
  create: leagueEditorProcedure.input(SeasonCreateDTOSchema).mutation(async ({ input, ctx }) => {
    validateStartBeforeEnd(input);

    const leaguePlayers = await getLeaguePlayers({ leagueId: ctx.league.id });
    if (leaguePlayers.length < 2) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "League must have at least 2 players to create a season",
      });
    }
    return create(
      SeasonCreateSchema.parse({
        userId: ctx.session.user.id,
        leagueId: ctx.league.id,
        ...input,
      }),
    );
  }),
  edit: leagueEditorProcedure.input(SeasonEditDTOSchema).mutation(async ({ ctx, input }) => {
    validateStartBeforeEnd(input);
    const season = await getBySlug({
      seasonSlug: input.seasonSlug,
    });
    if (
      season.startDate < new Date() &&
      (input.startDate !== undefined ||
        input.endDate !== undefined ||
        input.initialScore !== undefined ||
        input.scoreType !== undefined ||
        input.kFactor !== undefined)
    ) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Can only update name of a season that has started",
      });
    }
    const updatedSeason = await update(
      SeasonEditSchema.parse({
        leagueId: ctx.league.id,
        userId: ctx.session.user.id,
        ...input,
      }),
    );
    if (!updatedSeason) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Season not found",
      });
    }
    return updatedSeason;
  }),
  updateClosedStatus: leagueEditorProcedure
    .input(z.object({ leagueSlug: z.string(), seasonSlug: z.string(), closed: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const season = await getBySlug({ seasonSlug: input.seasonSlug });
      if (season.leagueId !== ctx.league.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Season not found",
        });
      }
      return updateClosedStatus({
        seasonId: season.id,
        userId: ctx.session.user.id,
        closed: input.closed,
      });
    }),
});
