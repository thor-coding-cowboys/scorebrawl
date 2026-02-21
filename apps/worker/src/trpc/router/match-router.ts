import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createOptionalIdSchema } from "@coding-cowboys/scorebrawl-util/id-util";
import * as seasonRepository from "../../repositories/season-repository";
import * as matchRepository from "../../repositories/match-repository";
import * as seasonPlayerRepository from "../../repositories/season-player-repository";
import { broadcastSeasonEvent } from "../../routes/sse-router";
import type { AchievementQueueMessage } from "../../services/achievement-calculation";
import { seasonProcedure, leagueMemberProcedure } from "../trpc";

// Schema for optional match ID validation
const matchIdSchema = createOptionalIdSchema("match");

export const matchRouter = {
	createFromFixture: leagueMemberProcedure
		.input(
			z.object({
				seasonSlug: z.string(),
				homeScore: z.number().int().min(0),
				awayScore: z.number().int().min(0),
				fixtureId: z.string(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const season = await seasonRepository.getBySlug({
				db: ctx.db,
				seasonSlug: input.seasonSlug,
				leagueId: ctx.organizationId,
			});

			if (season.closed) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "This season is closed",
				});
			}

			// Get the fixture
			const fixture = await seasonRepository.findFixtureById({
				db: ctx.db,
				seasonId: season.id,
				fixtureId: input.fixtureId,
			});

			if (!fixture) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Fixture not found",
				});
			}

			if (fixture.matchId) {
				throw new TRPCError({
					code: "CONFLICT",
					message: "This fixture already has a match",
				});
			}

			// Create the match
			const createdMatch = await matchRepository.create({
				db: ctx.db,
				input: {
					seasonId: season.id,
					homeScore: input.homeScore,
					awayScore: input.awayScore,
					homeTeamPlayerIds: [fixture.homePlayerId],
					awayTeamPlayerIds: [fixture.awayPlayerId],
					userId: ctx.authentication.user.id,
				},
			});

			// Assign match to fixture
			await seasonRepository.assignMatchToFixture({
				db: ctx.db,
				seasonId: season.id,
				fixtureId: fixture.id,
				matchId: createdMatch.id,
			});

			// Fetch updated standings
			const standings = await seasonPlayerRepository.getStanding({
				db: ctx.db,
				seasonId: season.id,
			});

			// Broadcast match insert and standings update
			const sseEnv = ctx.env as unknown as { SEASON_SSE: DurableObjectNamespace };
			if (sseEnv.SEASON_SSE) {
				await broadcastSeasonEvent(sseEnv, ctx.organization.slug, input.seasonSlug, {
					type: "match:insert",
					data: {
						match: createdMatch,
						standings,
					},
					user: {
						id: ctx.authentication.user.id,
						name: ctx.authentication.user.name,
					},
				});
			}

			// Dispatch achievement calculation
			const seasonPlayerIds = [fixture.homePlayerId, fixture.awayPlayerId];
			await ctx.env.ACHIEVEMENT_QUEUE.send({
				seasonPlayerIds,
			} satisfies AchievementQueueMessage);

			return createdMatch;
		}),

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
				db: ctx.db,
				seasonSlug: input.seasonSlug,
				leagueId: ctx.organizationId,
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
						db: ctx.db,
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
					db: ctx.db,
					input: {
						id: input.id,
						seasonId: comp.id,
						homeScore: input.homeScore,
						awayScore: input.awayScore,
						homeTeamPlayerIds: input.homeTeamPlayerIds,
						awayTeamPlayerIds: input.awayTeamPlayerIds,
						userId: ctx.authentication.user.id,
					},
				})
				.then(async (createdMatch) => {
					// Fetch updated standings
					const standings = await seasonPlayerRepository.getStanding({
						db: ctx.db,
						seasonId: comp.id,
					});

					// Broadcast match insert and standings update
					const sseEnv = ctx.env as unknown as { SEASON_SSE: DurableObjectNamespace };
					console.log("[SSE] Broadcasting match:insert", {
						hasSseEnv: !!sseEnv.SEASON_SSE,
						leagueSlug: ctx.organization.slug,
						seasonSlug: input.seasonSlug,
					});
					if (sseEnv.SEASON_SSE) {
						await broadcastSeasonEvent(sseEnv, ctx.organization.slug, input.seasonSlug, {
							type: "match:insert",
							data: {
								match: createdMatch,
								standings,
							},
							user: {
								id: ctx.authentication.user.id,
								name: ctx.authentication.user.name,
							},
						});
						console.log("[SSE] Broadcast complete");
					}

					// Dispatch achievement calculation
					const seasonPlayerIds = [...input.homeTeamPlayerIds, ...input.awayTeamPlayerIds];
					await ctx.env.ACHIEVEMENT_QUEUE.send({
						seasonPlayerIds,
					} satisfies AchievementQueueMessage);

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
			const sseEnv = ctx.env as unknown as { SEASON_SSE: DurableObjectNamespace };
			if (sseEnv.SEASON_SSE) {
				broadcastSeasonEvent(sseEnv, ctx.organization.slug, input.seasonSlug, {
					type: "match:delete",
					data: {
						matchId: input.matchId,
						standings,
					},
					user: {
						id: ctx.authentication.user.id,
						name: ctx.authentication.user.name,
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
