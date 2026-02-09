import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createOptionalIdSchema } from "@coding-cowboys/scorebrawl-util/id-util";
import * as seasonRepository from "../../repositories/season-repository";
import * as matchRepository from "../../repositories/match-repository";
import * as seasonPlayerRepository from "../../repositories/season-player-repository";
import { broadcastSeasonEvent } from "../../routes/sse-router";
import {
	seasonProcedure,
	leagueMemberProcedure,
	type LeagueContext,
	type SeasonContext,
} from "../trpc";

// Schema for optional match ID validation
const matchIdSchema = createOptionalIdSchema("match");

export const matchRouter = {
	create: leagueMemberProcedure
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

			return matchRepository
				.create({
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
				})
				.then(async (createdMatch) => {
					// Fetch updated standings
					const standings = await seasonPlayerRepository.getStanding({
						db: typedCtx.db,
						seasonId: comp.id,
					});

					// Broadcast match insert and standings update
					const sseEnv = typedCtx.env as unknown as { SEASON_SSE: DurableObjectNamespace };
					console.log("[SSE] Broadcasting match:insert", {
						hasSseEnv: !!sseEnv.SEASON_SSE,
						leagueSlug: typedCtx.organization.slug,
						seasonSlug: input.seasonSlug,
					});
					if (sseEnv.SEASON_SSE) {
						await broadcastSeasonEvent(sseEnv, typedCtx.organization.slug, input.seasonSlug, {
							type: "match:insert",
							data: {
								match: createdMatch,
								standings,
							},
							user: {
								id: typedCtx.authentication.user.id,
								name: typedCtx.authentication.user.name,
							},
						});
						console.log("[SSE] Broadcast complete");
					}

					return createdMatch;
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
			const typedCtx = ctx as unknown as SeasonContext;

			await matchRepository.remove({
				db: ctx.db,
				matchId: input.matchId,
				seasonId: ctx.season.id,
			});

			// Fetch updated standings
			const standings = await seasonPlayerRepository.getStanding({
				db: ctx.db,
				seasonId: ctx.season.id,
			});

			// Broadcast match delete and standings update
			const sseEnv = typedCtx.env as unknown as { SEASON_SSE: DurableObjectNamespace };
			if (sseEnv.SEASON_SSE) {
				broadcastSeasonEvent(sseEnv, typedCtx.organization.slug, input.seasonSlug, {
					type: "match:delete",
					data: {
						matchId: input.matchId,
						standings,
					},
					user: {
						id: typedCtx.authentication.user.id,
						name: typedCtx.authentication.user.name,
					},
				});
			}

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
