import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as competitionPlayerRepository from "../../repositories/competition-player-repository";
import * as competitionRepository from "../../repositories/competition-repository";
import * as playerRepository from "../../repositories/player-repository";
import { competitionProcedure, organizationProcedure } from "../trpc";

const checkCompetitionSupportsPlayerProfiles = async ({
	db,
	organizationId,
}: {
	db: any;
	organizationId: string;
}) => {
	const activeCompetition = await competitionRepository.findActive({
		db,
		organizationId,
	});

	if (!activeCompetition) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "No active competition found",
		});
	}

	if (activeCompetition.scoreType === "3-1-0") {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Player profiles are not available for 3-1-0 competitions",
		});
	}

	return activeCompetition;
};

export const playerRouter = {
	getAll: organizationProcedure.query(async ({ ctx }) => {
		return playerRepository.getAll({
			db: ctx.db,
			organizationId: ctx.organizationId,
		});
	}),

	getById: competitionProcedure
		.input(z.object({ competitionSlug: z.string(), playerId: z.string() }))
		.query(async ({ input, ctx }) => {
			await checkCompetitionSupportsPlayerProfiles({
				db: ctx.db,
				organizationId: ctx.organizationId,
			});

			const player = await playerRepository.getById({
				db: ctx.db,
				playerId: input.playerId,
				organizationId: ctx.organizationId,
			});

			if (!player) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Player not found",
				});
			}

			return player;
		}),

	getEloProgression: competitionProcedure
		.input(z.object({ competitionSlug: z.string(), playerId: z.string() }))
		.query(async ({ input, ctx }) => {
			await checkCompetitionSupportsPlayerProfiles({
				db: ctx.db,
				organizationId: ctx.organizationId,
			});

			// Get competition player ID from player ID
			const competitionPlayers = await competitionPlayerRepository.findAll({
				db: ctx.db,
				competitionId: ctx.competition.id,
			});

			const cp = competitionPlayers.find((p) => p.playerId === input.playerId);
			if (!cp) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Player not in competition",
				});
			}

			return playerRepository.getPlayerEloProgression({
				db: ctx.db,
				competitionPlayerId: cp.id,
			});
		}),

	getRecentMatches: competitionProcedure
		.input(z.object({ competitionSlug: z.string(), playerId: z.string() }))
		.query(async ({ input, ctx }) => {
			await checkCompetitionSupportsPlayerProfiles({
				db: ctx.db,
				organizationId: ctx.organizationId,
			});

			const competitionPlayers = await competitionPlayerRepository.findAll({
				db: ctx.db,
				competitionId: ctx.competition.id,
			});

			const cp = competitionPlayers.find((p) => p.playerId === input.playerId);
			if (!cp) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Player not in competition",
				});
			}

			return playerRepository.getRecentMatches({
				db: ctx.db,
				competitionPlayerId: cp.id,
				limit: 10,
			});
		}),

	getPlayerStats: competitionProcedure
		.input(z.object({ competitionSlug: z.string(), playerId: z.string() }))
		.query(async ({ input, ctx }) => {
			await checkCompetitionSupportsPlayerProfiles({
				db: ctx.db,
				organizationId: ctx.organizationId,
			});

			const competitionPlayers = await competitionPlayerRepository.findAll({
				db: ctx.db,
				competitionId: ctx.competition.id,
			});

			const cp = competitionPlayers.find((p) => p.playerId === input.playerId);
			if (!cp) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Player not in competition",
				});
			}

			return playerRepository.getPlayerStats({
				db: ctx.db,
				competitionPlayerId: cp.id,
			});
		}),
} satisfies TRPCRouterRecord;
