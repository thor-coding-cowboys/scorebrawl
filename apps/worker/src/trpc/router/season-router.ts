import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createOptionalIdSchema } from "@coding-cowboys/scorebrawl-util/id-util";
import * as seasonRepository from "../../repositories/season-repository";
import * as playerRepository from "../../repositories/player-repository";
import {
	seasonProcedure,
	leagueEditorProcedure,
	leagueProcedure,
	type LeagueContext,
} from "../trpc";

const validateStartBeforeEnd = ({ startDate, endDate }: { startDate?: Date; endDate?: Date }) => {
	if (endDate && startDate && startDate > endDate) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "End date must be after start date",
		});
	}
};

// Schema for optional season ID validation
const seasonIdSchema = createOptionalIdSchema("season");

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
			leagueId: ctx.organizationId,
		});
	}),

	findAllActive: leagueProcedure.query(async ({ ctx }) => {
		return seasonRepository.findAllActive({
			db: ctx.db,
			leagueId: ctx.organizationId,
		});
	}),

	getAll: leagueProcedure.query(async ({ ctx }) => {
		return seasonRepository.getAll({
			db: ctx.db,
			leagueId: ctx.organizationId,
		});
	}),

	checkSlugAvailability: leagueProcedure
		.input(z.object({ slug: z.string() }))
		.query(async ({ ctx, input }) => {
			try {
				await seasonRepository.getBySlug({
					db: ctx.db,
					seasonSlug: input.slug,
					leagueId: ctx.organizationId,
				});
				return { available: false };
			} catch {
				return { available: true };
			}
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
				id: seasonIdSchema,
				name: z.string().min(1).max(100),
				slug: z
					.string()
					.min(1)
					.max(100)
					.regex(/^[a-z0-9-]+$/, "Slug must only contain lowercase letters, numbers, and hyphens")
					.optional(),
				initialScore: z.number().int(),
				scoreType: z.enum(["elo", "3-1-0"]),
				kFactor: z.number().int(),
				startDate: z.date(),
				endDate: z.date().optional(),
				rounds: z.number().int().optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			validateStartBeforeEnd(input);

			const typedCtx = ctx as unknown as LeagueContext;

			// If an ID is provided, verify it doesn't already exist
			if (input.id) {
				try {
					await seasonRepository.getById({
						db: typedCtx.db,
						seasonId: input.id,
					});
					// If we get here, the season exists
					throw new TRPCError({
						code: "CONFLICT",
						message: "A season with this ID already exists",
					});
				} catch (error) {
					// If it's our conflict error, rethrow it
					if (error instanceof TRPCError) throw error;
					// Otherwise, the season doesn't exist (expected), continue
				}
			}

			// Check if at least 2 players exist
			const players = await playerRepository.getAll({
				db: typedCtx.db,
				leagueId: typedCtx.organizationId,
			});

			if (players.length < 2) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "League must have at least 2 players to create a season",
				});
			}

			return seasonRepository.create({
				db: typedCtx.db,
				id: input.id,
				...input,
				leagueId: typedCtx.organizationId,
				userId: typedCtx.authentication.user.id,
			});
		}),

	edit: leagueEditorProcedure
		.input(
			z.object({
				seasonSlug: z.string(),
				name: z.string().min(1).max(100).optional(),
				slug: z
					.string()
					.min(1)
					.max(100)
					.regex(/^[a-z0-9-]+$/, "Slug must only contain lowercase letters, numbers, and hyphens")
					.optional(),
				startDate: z.date().optional(),
				endDate: z.date().optional(),
				initialScore: z.number().int().optional(),
				kFactor: z.number().int().optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			validateStartBeforeEnd(input);

			const typedCtx = ctx as unknown as LeagueContext;

			// Get season to verify it exists
			const comp = await seasonRepository.getBySlug({
				db: typedCtx.db,
				seasonSlug: input.seasonSlug,
				leagueId: typedCtx.organizationId,
			});

			// Check if season has matches registered
			const countInfo = await seasonRepository.getCountInfoById({
				db: typedCtx.db,
				seasonId: comp.id,
			});

			if (countInfo.matchCount > 0) {
				const restrictedFields = [
					input.startDate,
					input.endDate,
					input.initialScore,
					input.kFactor,
				].some((f) => f !== undefined);

				if (restrictedFields) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "Can only update name, slug, and dates of a season with registered matches",
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
			const typedCtx = ctx as unknown as LeagueContext;

			const comp = await seasonRepository.getBySlug({
				db: typedCtx.db,
				seasonSlug: input.seasonSlug,
				leagueId: typedCtx.organizationId,
			});

			return seasonRepository.updateClosedStatus({
				db: typedCtx.db,
				seasonId: comp.id,
				userId: typedCtx.authentication.user.id,
				closed: input.closed,
			});
		}),
} satisfies TRPCRouterRecord;
