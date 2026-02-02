import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as competitionRepository from "../../repositories/competition-repository";
import * as playerRepository from "../../repositories/player-repository";
import { competitionProcedure, organizationEditorProcedure, organizationProcedure } from "../trpc";

const validateStartBeforeEnd = ({ startDate, endDate }: { startDate?: Date; endDate?: Date }) => {
	if (endDate && startDate && startDate > endDate) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "End date must be after start date",
		});
	}
};

export const competitionRouter = {
	getBySlug: competitionProcedure.query(({ ctx }) => ({
		id: ctx.competition.id,
		slug: ctx.competition.slug,
		name: ctx.competition.name,
		initialScore: ctx.competition.initialScore,
		scoreType: ctx.competition.scoreType,
		kFactor: ctx.competition.kFactor,
		startDate: ctx.competition.startDate,
		endDate: ctx.competition.endDate,
		rounds: ctx.competition.rounds,
		closed: ctx.competition.closed,
		archived: ctx.competition.archived,
	})),

	getCountInfo: competitionProcedure.query(async ({ ctx, input }) => {
		return competitionRepository.getCountInfo({
			db: ctx.db,
			competitionSlug: input.competitionSlug,
		});
	}),

	findActive: organizationProcedure.query(async ({ ctx }) => {
		return competitionRepository.findActive({
			db: ctx.db,
			organizationId: ctx.organizationId,
		});
	}),

	getAll: organizationProcedure.query(async ({ ctx }) => {
		return competitionRepository.getAll({
			db: ctx.db,
			organizationId: ctx.organizationId,
		});
	}),

	getFixtures: competitionProcedure.query(async ({ ctx }) => {
		return competitionRepository.findFixtures({
			db: ctx.db,
			competitionId: ctx.competition.id,
		});
	}),

	create: organizationEditorProcedure
		.input(
			z.object({
				name: z.string().min(1).max(100),
				initialScore: z.number().int(),
				scoreType: z.enum(["elo", "3-1-0", "elo-individual-vs-team"]),
				kFactor: z.number().int(),
				startDate: z.date(),
				endDate: z.date().optional(),
				rounds: z.number().int().optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			validateStartBeforeEnd(input);

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const typedCtx = ctx as any;

			// Check if at least 2 players exist
			const players = await playerRepository.getAll({
				db: typedCtx.db,
				organizationId: typedCtx.organizationId,
			});

			if (players.length < 2) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Organization must have at least 2 players to create a competition",
				});
			}

			return competitionRepository.create({
				db: typedCtx.db,
				...input,
				organizationId: typedCtx.organizationId,
				userId: typedCtx.authentication.user.id,
			});
		}),

	edit: organizationEditorProcedure
		.input(
			z.object({
				competitionSlug: z.string(),
				name: z.string().min(1).max(100).optional(),
				startDate: z.date().optional(),
				endDate: z.date().optional(),
				initialScore: z.number().int().optional(),
				kFactor: z.number().int().optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			validateStartBeforeEnd(input);

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const typedCtx = ctx as any;

			// Get competition to verify it exists
			const comp = await competitionRepository.getBySlug({
				db: typedCtx.db,
				competitionSlug: input.competitionSlug,
			});

			// Check if competition already started
			if (comp.startDate < new Date()) {
				const restrictedFields = [
					input.startDate,
					input.endDate,
					input.initialScore,
					input.kFactor,
				].some((f) => f !== undefined);

				if (restrictedFields) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "Can only update name of a competition that has started",
					});
				}
			}

			return competitionRepository.update({
				db: typedCtx.db,
				userId: typedCtx.authentication.user.id,
				competitionId: comp.id,
				...input,
			});
		}),

	updateClosedStatus: organizationEditorProcedure
		.input(
			z.object({
				competitionSlug: z.string(),
				closed: z.boolean(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const typedCtx = ctx as any;

			const comp = await competitionRepository.getBySlug({
				db: typedCtx.db,
				competitionSlug: input.competitionSlug,
			});

			return competitionRepository.updateClosedStatus({
				db: typedCtx.db,
				competitionId: comp.id,
				userId: typedCtx.authentication.user.id,
				closed: input.closed,
			});
		}),
} satisfies TRPCRouterRecord;
