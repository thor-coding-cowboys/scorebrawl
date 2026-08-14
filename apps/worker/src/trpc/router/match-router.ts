import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createOptionalIdSchema } from "@coding-cowboys/scorebrawl-util/id-util";
import * as seasonRepository from "../../repositories/season-repository";
import * as matchRepository from "../../repositories/match-repository";
import * as seasonPlayerRepository from "../../repositories/season-player-repository";
import { broadcastSeasonEvent } from "../../routes/sse-router";
import type { AchievementQueueMessage } from "../../services/achievement-calculation";
import { buildMatchInsertData, type SeasonScoreType } from "../../services/match-events";
import { seasonProcedure, leagueMemberProcedure } from "../trpc";

const matchIdSchema = createOptionalIdSchema("match");

type StreakBroadcastEvent = {
	type: "streak";
	data: {
		playerId: string;
		playerName: string;
		playerImage: string | null;
		streak: number;
		timestamp: number;
		isTeam?: boolean;
	};
	user: { id: string; name: string };
};

function buildStreakBroadcastEvents(
	streakPlayers: Array<{
		playerId: string;
		playerName: string;
		playerImage: string | null;
		streak: number;
	}>,
	streakTeams: Array<{
		seasonTeamId: string;
		teamName: string;
		teamLogo: string | null;
		streak: number;
	}>,
	user: { id: string; name: string }
): StreakBroadcastEvent[] {
	const events: StreakBroadcastEvent[] = [];
	const timestamp = Date.now();

	for (const player of streakPlayers) {
		events.push({
			type: "streak",
			data: {
				playerId: player.playerId,
				playerName: player.playerName,
				playerImage: player.playerImage,
				streak: player.streak,
				timestamp,
			},
			user,
		});
	}

	for (const team of streakTeams) {
		events.push({
			type: "streak",
			data: {
				playerId: team.seasonTeamId,
				playerName: team.teamName,
				playerImage: team.teamLogo,
				streak: team.streak,
				timestamp,
				isTeam: true,
			},
			user,
		});
	}

	return events;
}

function broadcastStreakEvents(
	waitUntil: (promise: Promise<unknown>) => void,
	env: Pick<Env, "SEASON_SSE">,
	leagueSlug: string,
	seasonSlug: string,
	streakPlayers: Array<{
		playerId: string;
		playerName: string;
		playerImage: string | null;
		streak: number;
	}>,
	streakTeams: Array<{
		seasonTeamId: string;
		teamName: string;
		teamLogo: string | null;
		streak: number;
	}>,
	user: { id: string; name: string }
) {
	const events = buildStreakBroadcastEvents(streakPlayers, streakTeams, user);
	waitUntil(
		Promise.all(events.map((event) => broadcastSeasonEvent(env, leagueSlug, seasonSlug, event)))
	);
}

async function finalizeMatchCreation({
	ctx,
	seasonSlug,
	seasonId,
	createdMatch,
	seasonPlayerIds,
	scoreType,
}: {
	ctx: {
		db: Parameters<typeof seasonPlayerRepository.getStanding>[0]["db"];
		env: Pick<Env, "SEASON_SSE" | "ACHIEVEMENT_QUEUE">;
		waitUntil: (promise: Promise<unknown>) => void;
		organization: { slug: string };
		authentication: { user: { id: string; name: string } };
	};
	seasonSlug: string;
	seasonId: string;
	createdMatch: {
		id: string;
		seasonId: string;
		homeScore: number;
		awayScore: number;
		createdAt: Date;
	};
	seasonPlayerIds: string[];
	scoreType: SeasonScoreType;
}) {
	const standings = await seasonPlayerRepository.getStanding({
		db: ctx.db,
		seasonId,
	});

	const data = await buildMatchInsertData(ctx.db, {
		match: createdMatch,
		scoreType,
		standings,
	});

	ctx.waitUntil(
		broadcastSeasonEvent(ctx.env, ctx.organization.slug, seasonSlug, {
			type: "match:insert",
			data,
			user: {
				id: ctx.authentication.user.id,
				name: ctx.authentication.user.name,
			},
		})
	);

	const [streakPlayers, streakTeams] = await Promise.all([
		matchRepository.checkStreakThresholds({
			db: ctx.db,
			seasonPlayerIds,
		}),
		matchRepository.checkTeamStreakThresholds({
			db: ctx.db,
			matchId: createdMatch.id,
		}),
	]);

	broadcastStreakEvents(
		ctx.waitUntil.bind(ctx),
		ctx.env,
		ctx.organization.slug,
		seasonSlug,
		streakPlayers,
		streakTeams,
		{
			id: ctx.authentication.user.id,
			name: ctx.authentication.user.name,
		}
	);

	await ctx.env.ACHIEVEMENT_QUEUE.send({
		seasonPlayerIds,
		leagueSlug: ctx.organization.slug,
		seasonSlug,
	} satisfies AchievementQueueMessage);

	return createdMatch;
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
				ctx,
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
						ctx,
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

			if (comp.scoreType !== "1-v-n-elo") {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "1-v-n games can only be recorded in 1-v-n-elo seasons",
				});
			}

			const allIds = [input.winnerId, ...input.loserIds];
			if (allIds.length < 2) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "A 1-v-n game needs at least 2 players",
				});
			}

			if (input.loserIds.includes(input.winnerId)) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Winner cannot also be a loser",
				});
			}

			if (new Set(allIds).size !== allIds.length) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Duplicate players in game",
				});
			}

			const seasonPlayers = await seasonPlayerRepository.findAll({
				db: ctx.db,
				seasonId: comp.id,
			});
			const validIds = new Set(seasonPlayers.map((p) => p.id));
			if (!allIds.every((id) => validIds.has(id))) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "All players must be in this season",
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

			const createdMatch = await matchRepository.create({
				db: ctx.db,
				input: {
					id: input.id,
					seasonId: comp.id,
					homeScore: 1,
					awayScore: input.loserIds.length,
					homeTeamPlayerIds: [input.winnerId],
					awayTeamPlayerIds: input.loserIds,
					userId: ctx.authentication.user.id,
				},
			});

			return finalizeMatchCreation({
				ctx,
				seasonSlug: input.seasonSlug,
				seasonId: comp.id,
				createdMatch,
				seasonPlayerIds: allIds,
				scoreType: comp.scoreType,
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
