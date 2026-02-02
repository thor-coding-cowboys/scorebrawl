import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as competitionRepository from "../../repositories/competition-repository";
import * as matchRepository from "../../repositories/match-repository";
import { competitionProcedure, organizationEditorProcedure } from "../trpc";

export const matchRouter = {
	create: organizationEditorProcedure
		.input(
			z.object({
				competitionSlug: z.string(),
				homeScore: z.number().int().min(0),
				awayScore: z.number().int().min(0),
				homeTeamPlayerIds: z.array(z.string()),
				awayTeamPlayerIds: z.array(z.string()),
			})
		)
		.mutation(async ({ ctx, input }) => {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const typedCtx = ctx as any;

			const comp = await competitionRepository.getBySlug({
				db: typedCtx.db,
				competitionSlug: input.competitionSlug,
			});

			if (comp.closed) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "This competition is closed",
				});
			}

			return matchRepository.create({
				db: typedCtx.db,
				input: {
					competitionId: comp.id,
					homeScore: input.homeScore,
					awayScore: input.awayScore,
					homeTeamPlayerIds: input.homeTeamPlayerIds,
					awayTeamPlayerIds: input.awayTeamPlayerIds,
					userId: typedCtx.authentication.user.id,
				},
			});
		}),

	remove: competitionProcedure
		.input(
			z.object({
				competitionSlug: z.string(),
				matchId: z.string(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			await matchRepository.remove({
				db: ctx.db,
				matchId: input.matchId,
				competitionId: ctx.competition.id,
			});

			return { success: true };
		}),

	getById: competitionProcedure
		.input(
			z.object({
				competitionSlug: z.string(),
				matchId: z.string(),
			})
		)
		.query(async ({ ctx, input }) => {
			return matchRepository.findById({
				db: ctx.db,
				matchId: input.matchId,
				competitionId: ctx.competition.id,
			});
		}),

	getLatest: competitionProcedure.query(async ({ ctx }) => {
		return matchRepository.findLatest({
			db: ctx.db,
			competitionId: ctx.competition.id,
		});
	}),

	getAll: competitionProcedure
		.input(
			z.object({
				competitionSlug: z.string(),
				limit: z.number().int().optional().default(30),
				offset: z.number().int().optional().default(0),
			})
		)
		.query(async ({ ctx, input }) => {
			return matchRepository.getByCompetitionId({
				db: ctx.db,
				competitionId: ctx.competition.id,
				limit: input.limit,
				offset: input.offset,
			});
		}),
} satisfies TRPCRouterRecord;
