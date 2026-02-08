import { createCollection, useLiveQuery } from "@tanstack/react-db";
import { queryCollectionOptions } from "@tanstack/query-db-collection";
import { z } from "zod";
import { trpcClient } from "../trpc";
import { queryClient } from "../query-client";

export const matchPlayerSchema = z.object({
	id: z.string(),
	seasonPlayerId: z.string(),
	homeTeam: z.boolean(),
	result: z.enum(["W", "D", "L"]),
	scoreBefore: z.number(),
	scoreAfter: z.number(),
	name: z.string(),
	image: z.string().nullable(),
	teamName: z.string().nullable(),
});

export const matchSchema = z.object({
	id: z.string(),
	seasonId: z.string(),
	homeScore: z.number(),
	awayScore: z.number(),
	createdAt: z.date(),
	players: z.array(matchPlayerSchema),
});

export type Match = z.infer<typeof matchSchema>;
export type MatchPlayer = z.infer<typeof matchPlayerSchema>;

const matchCollections = new Map<string, ReturnType<typeof createMatchCollectionInternal>>();

const PAGE_SIZE = 30;

function createMatchCollectionInternal(seasonId: string, seasonSlug: string) {
	return createCollection(
		queryCollectionOptions({
			id: `matches-${seasonId}`,
			queryKey: ["matches", seasonId],
			queryClient,
			schema: matchSchema,
			getKey: (item) => item.id,
			// SSE handles real-time updates, no need for polling
			queryFn: async () => {
				const result = await trpcClient.match.getAll.query({
					seasonSlug,
					limit: PAGE_SIZE,
					offset: 0,
				});
				return result.matches.map((match) => ({
					id: match.id,
					seasonId: match.seasonId,
					homeScore: match.homeScore,
					awayScore: match.awayScore,
					createdAt: match.createdAt,
					players: [],
				}));
			},
			onInsert: async ({ transaction }) => {
				const newMatch = transaction.mutations[0]?.modified;
				if (!newMatch) return { refetch: true };

				const homePlayerIds = newMatch.players
					.filter((p) => p.homeTeam)
					.map((p) => p.seasonPlayerId);
				const awayPlayerIds = newMatch.players
					.filter((p) => !p.homeTeam)
					.map((p) => p.seasonPlayerId);

				await trpcClient.match.create.mutate({
					id: newMatch.id,
					seasonSlug,
					homeScore: newMatch.homeScore,
					awayScore: newMatch.awayScore,
					homeTeamPlayerIds: homePlayerIds,
					awayTeamPlayerIds: awayPlayerIds,
				});

				return { refetch: true };
			},
			onDelete: async ({ transaction }) => {
				const matchId = transaction.mutations[0]?.key;
				if (!matchId) return { refetch: true };

				await trpcClient.match.remove.mutate({
					seasonSlug,
					matchId: matchId as string,
				});

				return { refetch: true };
			},
		})
	);
}

export function createMatchCollection(seasonId: string, seasonSlug: string) {
	const existing = matchCollections.get(seasonId);
	if (existing) return existing;

	const collection = createMatchCollectionInternal(seasonId, seasonSlug);
	matchCollections.set(seasonId, collection);
	return collection;
}

export function loadMoreMatches(seasonId: string, seasonSlug: string, currentCount: number) {
	const collection = createMatchCollection(seasonId, seasonSlug);

	return trpcClient.match.getAll
		.query({
			seasonSlug,
			limit: PAGE_SIZE,
			offset: currentCount,
		})
		.then((result) => {
			collection.utils.writeBatch(() => {
				for (const match of result.matches) {
					collection.utils.writeUpsert({
						id: match.id,
						seasonId: match.seasonId,
						homeScore: match.homeScore,
						awayScore: match.awayScore,
						createdAt: match.createdAt,
						players: [],
					});
				}
			});
			return result.total;
		});
}

export function useMatches(seasonId: string, seasonSlug: string) {
	const collection = createMatchCollection(seasonId, seasonSlug);

	const { data: matches } = useLiveQuery((q) =>
		q
			.from({ match: collection })
			.orderBy(({ match }) => match.createdAt, "desc")
			.select(({ match }) => ({
				id: match.id,
				seasonId: match.seasonId,
				homeScore: match.homeScore,
				awayScore: match.awayScore,
				createdAt: match.createdAt,
				players: match.players,
			}))
	);

	return {
		matches: matches ?? [],
		collection,
	};
}
