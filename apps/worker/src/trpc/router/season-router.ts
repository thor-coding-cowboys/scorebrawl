import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as seasonRepository from "../../repositories/season-repository";
import * as playerRepository from "../../repositories/player-repository";
import { seasonProcedure, leagueEditorProcedure, leagueProcedure } from "../trpc";

const validateStartBeforeEnd = ({ startDate, endDate }: { startDate?: Date; endDate?: Date }) => {
	if (endDate && startDate && startDate > endDate) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "End date must be after start date",
		});
	}
};

export const seasonRouter = {
	getBySlug: seasonProcedure.query(({ ctx }) => ({
		id: ctx.season.id,
		slug: ctx.season.slug,
		name: ctx.season.name,
		initialScore: ctx.season.initialScore,
		scoreType: ctx.season.scoreType,
		kFactor: ctx.season.kFactor,
		startDate: ctx.season.startDate,
		endDate: ctx.season.endDate,
		rounds: ctx.season.rounds,
		closed: ctx.season.closed,
		archived: ctx.season.archived,
	})),

	getCountInfo: seasonProcedure.query(async ({ ctx, input }) => {
		return seasonRepository.getCountInfo({
			db: ctx.db,
			seasonSlug: input.seasonSlug,
		});
	}),

	findActive: leagueProcedure.query(async ({ ctx }) => {
		return seasonRepository.findActive({
			db: ctx.db,
			organizationId: ctx.organizationId,
		});
	}),

	getAll: leagueProcedure.query(async ({ ctx }) => {
		return seasonRepository.getAll({
			db: ctx.db,
			organizationId: ctx.organizationId,
		});
	}),

	getFixtures: seasonProcedure.query(async ({ ctx }) => {
		return seasonRepository.findFixtures({
			db: ctx.db,
			seasonId: ctx.season.id,
		});
	}),

	create: leagueEditorProcedure
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
					message: "League must have at least 2 players to create a season",
				});
			}

			return seasonRepository.create({
				db: typedCtx.db,
				...input,
				organizationId: typedCtx.organizationId,
				userId: typedCtx.authentication.user.id,
			});
		}),

	edit: leagueEditorProcedure
		.input(
			z.object({
				seasonSlug: z.string(),
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

			// Get season to verify it exists
			const comp = await seasonRepository.getBySlug({
				db: typedCtx.db,
				seasonSlug: input.seasonSlug,
			});

			// Check if season already started
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
						message: "Can only update name of a season that has started",
					});
				}
			}

			return seasonRepository.update({
				db: typedCtx.db,
				userId: typedCtx.authentication.user.id,
				seasonId: comp.id,
				...input,
			});
		}),

	updateClosedStatus: leagueEditorProcedure
		.input(
			z.object({
				seasonSlug: z.string(),
				closed: z.boolean(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const typedCtx = ctx as any;

			const comp = await seasonRepository.getBySlug({
				db: typedCtx.db,
				seasonSlug: input.seasonSlug,
			});

			return seasonRepository.updateClosedStatus({
				db: typedCtx.db,
				seasonId: comp.id,
				userId: typedCtx.authentication.user.id,
				closed: input.closed,
			});
		}),
} satisfies TRPCRouterRecord;
