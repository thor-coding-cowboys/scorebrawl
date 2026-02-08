import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createOptionalIdSchema } from "@coding-cowboys/scorebrawl-util/id-util";
import * as seasonRepository from "../../repositories/season-repository";
import * as matchRepository from "../../repositories/match-repository";
import { seasonProcedure, leagueEditorProcedure, type LeagueContext } from "../trpc";

// Schema for optional match ID validation
const matchIdSchema = createOptionalIdSchema("match");

export const matchRouter = {
	create: leagueEditorProcedure
		.input(
			z.object({
				id: matchIdSchema,
				seasonSlug: z.string(),
				homeScore: z.number().int().min(0),
				awayScore: z.number().int().min(0),
				homeTeamPlayerIds: z.array(z.string()),
				awayTeamPlayerIds: z.array(z.string()),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const typedCtx = ctx as unknown as LeagueContext;

			// Validate teams have at least one player each
			if (input.homeTeamPlayerIds.length === 0 || input.awayTeamPlayerIds.length === 0) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Each team must have at least one player",
				});
			}

			// Validate teams have equal number of players
			if (input.homeTeamPlayerIds.length !== input.awayTeamPlayerIds.length) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Teams must have equal number of players",
				});
			}

			const comp = await seasonRepository.getBySlug({
				db: typedCtx.db,
				seasonSlug: input.seasonSlug,
				leagueId: typedCtx.organizationId,
			});

			if (comp.closed) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "This season is closed",
				});
			}

			// If an ID is provided, verify it doesn't already exist
			if (input.id) {
				try {
					await matchRepository.findById({
						db: typedCtx.db,
						matchId: input.id,
						seasonId: comp.id,
					});
					// If we get here, the match exists
					throw new TRPCError({
						code: "CONFLICT",
						message: "A match with this ID already exists",
					});
				} catch (error) {
					// If it's our conflict error, rethrow it
					if (error instanceof TRPCError) throw error;
					// Otherwise, the match doesn't exist (expected), continue
				}
			}

			return matchRepository.create({
				db: typedCtx.db,
				input: {
					id: input.id,
					seasonId: comp.id,
					homeScore: input.homeScore,
					awayScore: input.awayScore,
					homeTeamPlayerIds: input.homeTeamPlayerIds,
					awayTeamPlayerIds: input.awayTeamPlayerIds,
					userId: typedCtx.authentication.user.id,
				},
			});
		}),

	remove: seasonProcedure
		.input(
			z.object({
				seasonSlug: z.string(),
				matchId: z.string(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			await matchRepository.remove({
				db: ctx.db,
				matchId: input.matchId,
				seasonId: ctx.season.id,
			});

			return { success: true };
		}),

	getById: seasonProcedure
		.input(
			z.object({
				seasonSlug: z.string(),
				matchId: z.string(),
			})
		)
		.query(async ({ ctx, input }) => {
			return matchRepository.getMatchWithPlayers({
				db: ctx.db,
				matchId: input.matchId,
			});
		}),

	getLatest: seasonProcedure.query(async ({ ctx }) => {
		const match = await matchRepository.findLatest({
			db: ctx.db,
			seasonId: ctx.season.id,
		});

		if (!match) return null;

		return matchRepository.getMatchWithPlayers({
			db: ctx.db,
			matchId: match.id,
		});
	}),

	getAll: seasonProcedure
		.input(
			z.object({
				seasonSlug: z.string(),
				limit: z.number().int().optional().default(30),
				offset: z.number().int().optional().default(0),
			})
		)
		.query(async ({ ctx, input }) => {
			return matchRepository.getBySeasonId({
				db: ctx.db,
				seasonId: ctx.season.id,
				limit: input.limit,
				offset: input.offset,
			});
		}),
} satisfies TRPCRouterRecord;
