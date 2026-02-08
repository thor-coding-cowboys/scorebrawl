import type { TRPCRouterRecord } from "@trpc/server";
import * as seasonPlayerRepository from "../../repositories/season-player-repository";
import { seasonProcedure } from "../trpc";

export const seasonPlayerRouter = {
	getAll: seasonProcedure.query(async ({ ctx }) => {
		return seasonPlayerRepository.findAll({
			db: ctx.db,
			seasonId: ctx.season.id,
		});
	}),

	getStanding: seasonProcedure.query(async ({ ctx }) => {
		return seasonPlayerRepository.getStanding({
			db: ctx.db,
			seasonId: ctx.season.id,
		});
	}),

	getTop: seasonProcedure.query(async ({ ctx }) => {
		return seasonPlayerRepository.getTopPlayer({
			db: ctx.db,
			seasonId: ctx.season.id,
		});
	}),

	isInSeason: seasonProcedure.query(async ({ ctx }) => {
		return seasonPlayerRepository.isUserInSeason({
			db: ctx.db,
			seasonId: ctx.season.id,
			userId: (ctx as { authentication: { user: { id: string } } }).authentication.user.id,
		});
	}),

	getPointProgression: seasonProcedure.query(async ({ ctx }) => {
		return seasonPlayerRepository.getPointProgression({
			db: ctx.db,
			seasonId: ctx.season.id,
		});
	}),
} satisfies TRPCRouterRecord;
