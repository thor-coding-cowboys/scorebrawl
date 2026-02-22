import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as seasonPlayerRepository from "../../repositories/season-player-repository";
import * as seasonRepository from "../../repositories/season-repository";
import * as playerRepository from "../../repositories/player-repository";
import { seasonProcedure, leagueProcedure, leagueEditorProcedure } from "../trpc";

const checkSeasonSupportsPlayerProfiles = async ({
	db,
	leagueId,
}: {
	db: Parameters<typeof seasonRepository.findActive>[0]["db"];
	leagueId: string;
}) => {
	const activeSeason = await seasonRepository.findActive({
		db,
		leagueId,
	});

	if (!activeSeason) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "No active season found",
		});
	}

	if (activeSeason.scoreType === "3-1-0") {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Player profiles are not available for 3-1-0 seasons",
		});
	}

	return activeSeason;
};

export const playerRouter = {
	getAll: leagueProcedure.query(async ({ ctx }) => {
		return playerRepository.getAll({
			db: ctx.db,
			leagueId: ctx.organizationId,
		});
	}),

	getById: seasonProcedure
		.input(z.object({ seasonSlug: z.string(), playerId: z.string() }))
		.query(async ({ input, ctx }) => {
			await checkSeasonSupportsPlayerProfiles({
				db: ctx.db,
				leagueId: ctx.organizationId,
			});

			const player = await playerRepository.getById({
				db: ctx.db,
				playerId: input.playerId,
				leagueId: ctx.organizationId,
			});

			if (!player) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Player not found",
				});
			}

			return player;
		}),

	getEloProgression: seasonProcedure
		.input(z.object({ seasonSlug: z.string(), playerId: z.string() }))
		.query(async ({ input, ctx }) => {
			await checkSeasonSupportsPlayerProfiles({
				db: ctx.db,
				leagueId: ctx.organizationId,
			});

			// Get season player ID from player ID
			const seasonPlayers = await seasonPlayerRepository.findAll({
				db: ctx.db,
				seasonId: ctx.season.id,
			});

			const cp = seasonPlayers.find((p) => p.playerId === input.playerId);
			if (!cp) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Player not in season",
				});
			}

			return playerRepository.getPlayerEloProgression({
				db: ctx.db,
				seasonPlayerId: cp.id,
			});
		}),

	getRecentMatches: seasonProcedure
		.input(z.object({ seasonSlug: z.string(), playerId: z.string() }))
		.query(async ({ input, ctx }) => {
			await checkSeasonSupportsPlayerProfiles({
				db: ctx.db,
				leagueId: ctx.organizationId,
			});

			const seasonPlayers = await seasonPlayerRepository.findAll({
				db: ctx.db,
				seasonId: ctx.season.id,
			});

			const cp = seasonPlayers.find((p) => p.playerId === input.playerId);
			if (!cp) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Player not in season",
				});
			}

			return playerRepository.getRecentMatches({
				db: ctx.db,
				seasonPlayerId: cp.id,
				limit: 10,
			});
		}),

	getPlayerStats: seasonProcedure
		.input(z.object({ seasonSlug: z.string(), playerId: z.string() }))
		.query(async ({ input, ctx }) => {
			await checkSeasonSupportsPlayerProfiles({
				db: ctx.db,
				leagueId: ctx.organizationId,
			});

			const seasonPlayers = await seasonPlayerRepository.findAll({
				db: ctx.db,
				seasonId: ctx.season.id,
			});

			const cp = seasonPlayers.find((p) => p.playerId === input.playerId);
			if (!cp) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Player not in season",
				});
			}

			return playerRepository.getPlayerStats({
				db: ctx.db,
				seasonPlayerId: cp.id,
			});
		}),

	// New endpoints for player profile
	getBestSeason: leagueProcedure
		.input(z.object({ playerId: z.string() }))
		.query(async ({ input, ctx }) => {
			const player = await playerRepository.getById({
				db: ctx.db,
				playerId: input.playerId,
				leagueId: ctx.organizationId,
			});

			if (!player) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Player not found",
				});
			}

			return playerRepository.getBestSeason({
				db: ctx.db,
				playerId: input.playerId,
			});
		}),

	getBestTeammate: leagueProcedure
		.input(z.object({ playerId: z.string() }))
		.query(async ({ input, ctx }) => {
			const player = await playerRepository.getById({
				db: ctx.db,
				playerId: input.playerId,
				leagueId: ctx.organizationId,
			});

			if (!player) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Player not found",
				});
			}

			const analysis = await playerRepository.getTeammateAnalysis({
				db: ctx.db,
				playerId: input.playerId,
			});

			return analysis.bestTeammate;
		}),

	getWorstTeammate: leagueProcedure
		.input(z.object({ playerId: z.string() }))
		.query(async ({ input, ctx }) => {
			const player = await playerRepository.getById({
				db: ctx.db,
				playerId: input.playerId,
				leagueId: ctx.organizationId,
			});

			if (!player) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Player not found",
				});
			}

			const analysis = await playerRepository.getTeammateAnalysis({
				db: ctx.db,
				playerId: input.playerId,
			});

			return analysis.worstTeammate;
		}),

	getAllTimeStats: leagueProcedure
		.input(z.object({ playerId: z.string() }))
		.query(async ({ input, ctx }) => {
			const player = await playerRepository.getById({
				db: ctx.db,
				playerId: input.playerId,
				leagueId: ctx.organizationId,
			});

			if (!player) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Player not found",
				});
			}

			return playerRepository.getAllTimeStats({
				db: ctx.db,
				playerId: input.playerId,
			});
		}),

	getRecentMatchesWithTeams: seasonProcedure
		.input(z.object({ seasonSlug: z.string(), playerId: z.string() }))
		.query(async ({ input, ctx }) => {
			await checkSeasonSupportsPlayerProfiles({
				db: ctx.db,
				leagueId: ctx.organizationId,
			});

			const seasonPlayers = await seasonPlayerRepository.findAll({
				db: ctx.db,
				seasonId: ctx.season.id,
			});

			const cp = seasonPlayers.find((p) => p.playerId === input.playerId);
			if (!cp) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Player not in season",
				});
			}

			return playerRepository.getRecentMatchesWithTeams({
				db: ctx.db,
				seasonPlayerId: cp.id,
				limit: 10,
			});
		}),

	setDisabled: leagueEditorProcedure
		.input(z.object({ playerId: z.string(), disabled: z.boolean() }))
		.mutation(async ({ input, ctx }) => {
			const player = await playerRepository.getById({
				db: ctx.db,
				playerId: input.playerId,
				leagueId: ctx.organizationId,
			});

			if (!player) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Player not found",
				});
			}

			return playerRepository.setDisabled({
				db: ctx.db,
				playerId: input.playerId,
				leagueId: ctx.organizationId,
				disabled: input.disabled,
			});
		}),
} satisfies TRPCRouterRecord;
