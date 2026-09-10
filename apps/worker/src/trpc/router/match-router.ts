import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createOptionalIdSchema } from "@coding-cowboys/scorebrawl-util/id-util";
import * as seasonRepository from "../../repositories/season-repository";
import * as matchRepository from "../../repositories/match-repository";
import * as seasonPlayerRepository from "../../repositories/season-player-repository";
import { broadcastSeasonEvent } from "../../routes/sse-router";
import {
	createOneVnMatch,
	finalizeMatchCreation,
	type MatchCreationContext,
} from "../../services/match-creation";
import { seasonProcedure, leagueMemberProcedure } from "../trpc";

const matchIdSchema = createOptionalIdSchema("match");

function buildMatchCtx(ctx: {
	db: MatchCreationContext["db"];
	env: MatchCreationContext["env"];
	waitUntil: MatchCreationContext["waitUntil"];
	organization: { slug: string };
	authentication: { user: { id: string; name: string } };
}): MatchCreationContext {
	return {
		db: ctx.db,
		env: ctx.env,
		waitUntil: ctx.waitUntil,
		organization: { slug: ctx.organization.slug },
		user: { id: ctx.authentication.user.id, name: ctx.authentication.user.name },
	};
}

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

			await seasonRepository.assignMatchToFixture({
				db: ctx.db,
				seasonId: season.id,
				fixtureId: fixture.id,
				matchId: createdMatch.id,
			});

			return finalizeMatchCreation({
				ctx: buildMatchCtx(ctx),
				seasonSlug: input.seasonSlug,
				seasonId: season.id,
				createdMatch,
				seasonPlayerIds: [fixture.homePlayerId, fixture.awayPlayerId],
				scoreType: season.scoreType,
			});
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
			if (input.homeTeamPlayerIds.length === 0 || input.awayTeamPlayerIds.length === 0) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Each team must have at least one player",
				});
			}

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

			if (input.id) {
				try {
					await matchRepository.findById({
						db: ctx.db,
						matchId: input.id,
						seasonId: comp.id,
					});
					throw new TRPCError({
						code: "CONFLICT",
						message: "A match with this ID already exists",
					});
				} catch (error) {
					if (error instanceof TRPCError) throw error;
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
				.then(async (createdMatch) =>
					finalizeMatchCreation({
						ctx: buildMatchCtx(ctx),
						seasonSlug: input.seasonSlug,
						seasonId: comp.id,
						createdMatch,
						seasonPlayerIds: [...input.homeTeamPlayerIds, ...input.awayTeamPlayerIds],
						scoreType: comp.scoreType,
					})
				);
		}),

	createOneVn: leagueMemberProcedure
		.input(
			z.object({
				id: matchIdSchema,
				seasonSlug: z.string(),
				winnerId: z.string(),
				loserIds: z.array(z.string()).min(1),
			})
		)
		.mutation(async ({ ctx, input }) => {
			return createOneVnMatch({
				ctx: buildMatchCtx(ctx),
				seasonSlug: input.seasonSlug,
				id: input.id,
				winnerId: input.winnerId,
				loserIds: input.loserIds,
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

			const standings = await seasonPlayerRepository.getStanding({
				db: ctx.db,
				seasonId: ctx.season.id,
			});

			ctx.waitUntil(
				broadcastSeasonEvent(ctx.env, ctx.organization.slug, input.seasonSlug, {
					type: "match:delete",
					data: {
						matchId: input.matchId,
						standings,
					},
					user: {
						id: ctx.authentication.user.id,
						name: ctx.authentication.user.name,
					},
				})
			);

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
