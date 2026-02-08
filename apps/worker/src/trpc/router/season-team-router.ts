import type { TRPCRouterRecord } from "@trpc/server";
import * as seasonTeamRepository from "../../repositories/season-team-repository";
import { seasonProcedure } from "../trpc";

export const seasonTeamRouter = {
	getStanding: seasonProcedure.query(async ({ ctx }) => {
		return seasonTeamRepository.getStanding({
			db: ctx.db,
			seasonId: ctx.season.id,
		});
	}),
} satisfies TRPCRouterRecord;
