import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";
import * as achievementRepository from "../../repositories/achievement-repository";
import { leagueProcedure } from "../trpc";

export const achievementRouter = {
	getByPlayerId: leagueProcedure
		.input(z.object({ playerId: z.string() }))
		.query(async ({ input, ctx }) => {
			return achievementRepository.getAchievements({
				db: ctx.db,
				playerId: input.playerId,
				leagueId: ctx.organizationId,
			});
		}),
} satisfies TRPCRouterRecord;
