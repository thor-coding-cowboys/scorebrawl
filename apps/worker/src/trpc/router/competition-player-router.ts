import type { TRPCRouterRecord } from "@trpc/server";
import * as competitionPlayerRepository from "../../repositories/competition-player-repository";
import { competitionProcedure } from "../trpc";

export const competitionPlayerRouter = {
	getAll: competitionProcedure.query(async ({ ctx }) => {
		return competitionPlayerRepository.findAll({
			db: ctx.db,
			competitionId: ctx.competition.id,
		});
	}),

	getStanding: competitionProcedure.query(async ({ ctx }) => {
		return competitionPlayerRepository.getStanding({
			db: ctx.db,
			competitionId: ctx.competition.id,
		});
	}),

	getTop: competitionProcedure.query(async ({ ctx }) => {
		return competitionPlayerRepository.getTopPlayer({
			db: ctx.db,
			competitionId: ctx.competition.id,
		});
	}),

	isInCompetition: competitionProcedure.query(async ({ ctx }) => {
		return competitionPlayerRepository.isUserInCompetition({
			db: ctx.db,
			competitionId: ctx.competition.id,
			userId: ctx.authentication.user.id,
		});
	}),

	getPointProgression: competitionProcedure.query(async ({ ctx }) => {
		return competitionPlayerRepository.getPointProgression({
			db: ctx.db,
			competitionId: ctx.competition.id,
		});
	}),
} satisfies TRPCRouterRecord;
