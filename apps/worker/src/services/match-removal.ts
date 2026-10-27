import type { DrizzleDB } from "../db";
import * as matchRepository from "../repositories/match-repository";
import { broadcastSeasonEvent, broadcastStandingsUpdate } from "../routes/sse-router";

export interface MatchRemovalContext {
	db: DrizzleDB;
	env: Pick<Env, "SEASON_SSE">;
	waitUntil: (promise: Promise<unknown>) => void;
	organization: { slug: string };
	user: { id: string; name: string };
}

export async function removeMatch(
	ctx: MatchRemovalContext,
	{ seasonSlug, seasonId, matchId }: { seasonSlug: string; seasonId: string; matchId: string }
) {
	await matchRepository.remove({ db: ctx.db, matchId, seasonId });

	ctx.waitUntil(
		broadcastSeasonEvent(ctx.env, ctx.organization.slug, seasonSlug, {
			type: "match:delete",
			data: { matchId },
			user: ctx.user,
		})
	);

	ctx.waitUntil(
		broadcastStandingsUpdate(
			ctx.env,
			ctx.organization.slug,
			seasonSlug,
			{ reason: "match:remove", matchId },
			ctx.user
		)
	);
}
