import { createCollection, useLiveQuery } from "@tanstack/react-db";
import { queryCollectionOptions } from "@tanstack/query-db-collection";
import { z } from "zod";
import { trpcClient } from "../trpc";
import { queryClient } from "../query-client";

export const standingPlayerSchema = z.object({
	id: z.string(),
	seasonId: z.string(),
	playerId: z.string(),
	score: z.number(),
	name: z.string(),
	image: z.string().nullable(),
	userId: z.string(),
	matchCount: z.number(),
	winCount: z.number(),
	lossCount: z.number(),
	drawCount: z.number(),
	rank: z.number(),
	pointDiff: z.number(),
	form: z.array(z.enum(["W", "D", "L"])),
});

export type StandingPlayer = z.infer<typeof standingPlayerSchema>;

const standingCollections = new Map<string, ReturnType<typeof createStandingCollectionInternal>>();

function createStandingCollectionInternal(seasonId: string, seasonSlug: string) {
	return createCollection(
		queryCollectionOptions({
			id: `standings-${seasonId}`,
			queryKey: ["standings", seasonId],
			queryClient,
			schema: standingPlayerSchema,
			getKey: (item) => item.id,
			// SSE handles real-time updates, no need for polling
			queryFn: async () => {
				const standings = await trpcClient.seasonPlayer.getStanding.query({
					seasonSlug,
				});
				return standings.map((player) => ({
					id: player.id,
					seasonId: player.seasonId,
					playerId: player.playerId,
					score: player.score,
					name: player.name,
					image: player.image,
					userId: player.userId,
					matchCount: player.matchCount,
					winCount: player.winCount,
					lossCount: player.lossCount,
					drawCount: player.drawCount,
					rank: player.rank,
					pointDiff: player.pointDiff,
					form: player.form,
				}));
			},
		})
	);
}

export function createStandingCollection(seasonId: string, seasonSlug: string) {
	const existing = standingCollections.get(seasonId);
	if (existing) return existing;

	const collection = createStandingCollectionInternal(seasonId, seasonSlug);
	standingCollections.set(seasonId, collection);
	return collection;
}

export function useStandings(seasonId: string, seasonSlug: string) {
	const collection = createStandingCollection(seasonId, seasonSlug);

	const { data: standings } = useLiveQuery((q) =>
		q.from({ standing: collection }).select(({ standing }) => ({
			id: standing.id,
			seasonId: standing.seasonId,
			playerId: standing.playerId,
			score: standing.score,
			name: standing.name,
			image: standing.image,
			userId: standing.userId,
			matchCount: standing.matchCount,
			winCount: standing.winCount,
			lossCount: standing.lossCount,
			drawCount: standing.drawCount,
			rank: standing.rank,
			pointDiff: standing.pointDiff,
			form: standing.form,
		}))
	);

	return {
		standings: standings ?? [],
		collection,
	};
}
