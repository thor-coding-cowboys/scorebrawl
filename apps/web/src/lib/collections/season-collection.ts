import { useLiveQuery, createCollection } from "@tanstack/react-db";
import { queryCollectionOptions } from "@tanstack/query-db-collection";
import { z } from "zod";
import { trpcClient } from "../trpc";
import { queryClient } from "../query-client";

export const seasonSchema = z.object({
	id: z.string(),
	slug: z.string(),
	name: z.string(),
	initialScore: z.number(),
	scoreType: z.enum(["elo", "3-1-0", "elo-individual-vs-team"]),
	kFactor: z.number(),
	startDate: z.date(),
	endDate: z.date().nullable(),
	rounds: z.number().nullable(),
	closed: z.boolean(),
	archived: z.boolean(),
});

export type Season = z.infer<typeof seasonSchema>;

const seasonCollections = new Map<string, ReturnType<typeof createSeasonCollectionInternal>>();

function createSeasonCollectionInternal(leagueId: string) {
	return createCollection(
		queryCollectionOptions({
			id: `seasons-${leagueId}`,
			queryKey: ["seasons", leagueId],
			queryClient,
			schema: seasonSchema,
			getKey: (item) => item.id,
			queryFn: async () => {
				const seasons = await trpcClient.season.getAll.query();
				return seasons.map((season) => ({
					id: season.id,
					slug: season.slug,
					name: season.name,
					initialScore: season.initialScore,
					scoreType: season.scoreType,
					kFactor: season.kFactor,
					startDate: season.startDate,
					endDate: season.endDate,
					rounds: season.rounds,
					closed: season.closed,
					archived: season.archived,
				}));
			},
			onInsert: async ({ transaction }) => {
				const newSeason = transaction.mutations[0]?.modified;
				if (!newSeason) return { refetch: true };

				await trpcClient.season.create.mutate({
					id: newSeason.id,
					name: newSeason.name,
					slug: newSeason.slug,
					initialScore: newSeason.initialScore,
					scoreType: newSeason.scoreType as "elo" | "3-1-0",
					kFactor: newSeason.kFactor,
					startDate: newSeason.startDate,
					endDate: newSeason.endDate ?? undefined,
					rounds: newSeason.rounds ?? undefined,
				});

				return { refetch: true };
			},
			onUpdate: async ({ transaction }) => {
				const mutation = transaction.mutations[0];
				if (!mutation) return { refetch: true };

				const seasonId = mutation.key;
				const seasons = await trpcClient.season.getAll.query();
				const season = seasons.find((s) => s.id === seasonId);

				if (season) {
					await trpcClient.season.edit.mutate({
						seasonSlug: season.slug,
						name: mutation.changes.name,
						slug: mutation.changes.slug,
						startDate: mutation.changes.startDate,
						endDate: mutation.changes.endDate ?? undefined,
						initialScore: mutation.changes.initialScore,
						kFactor: mutation.changes.kFactor,
					});
				}

				return { refetch: true };
			},
		})
	);
}

export function createSeasonCollection(leagueId: string) {
	const existing = seasonCollections.get(leagueId);
	if (existing) return existing;

	const collection = createSeasonCollectionInternal(leagueId);
	seasonCollections.set(leagueId, collection);
	return collection;
}

export function useSeasons(leagueId: string) {
	const collection = createSeasonCollection(leagueId);

	const { data: seasons } = useLiveQuery((q) =>
		q.from({ season: collection }).select(({ season }) => ({
			id: season.id,
			slug: season.slug,
			name: season.name,
			initialScore: season.initialScore,
			scoreType: season.scoreType,
			kFactor: season.kFactor,
			startDate: season.startDate,
			endDate: season.endDate,
			rounds: season.rounds,
			closed: season.closed,
			archived: season.archived,
		}))
	);

	return {
		seasons: seasons ?? [],
		collection,
	};
}
