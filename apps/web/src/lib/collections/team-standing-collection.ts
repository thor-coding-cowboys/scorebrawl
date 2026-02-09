import { createCollection, useLiveQuery, eq } from "@tanstack/react-db";
import { queryCollectionOptions } from "@tanstack/query-db-collection";
import { z } from "zod";
import { trpcClient } from "../trpc";
import { queryClient } from "../query-client";

const playerSchema = z.object({
	id: z.string(),
	name: z.string(),
	image: z.string().nullable(),
});

export const standingTeamSchema = z.object({
	id: z.string(),
	seasonId: z.string(),
	leagueTeamId: z.string(),
	score: z.number(),
	name: z.string(),
	logo: z.string().nullable(),
	matchCount: z.number(),
	winCount: z.number(),
	lossCount: z.number(),
	drawCount: z.number(),
	rank: z.number(),
	pointDiff: z.number(),
	form: z.array(z.enum(["W", "D", "L"])),
	players: z.array(playerSchema),
});

export type StandingTeam = z.infer<typeof standingTeamSchema>;

const teamStandingCollections = new Map<
	string,
	ReturnType<typeof createTeamStandingCollectionInternal>
>();

function createTeamStandingCollectionInternal(seasonId: string, seasonSlug: string) {
	return createCollection(
		queryCollectionOptions({
			id: `team-standings-${seasonId}`,
			queryKey: ["team-standings", seasonId],
			queryClient,
			schema: standingTeamSchema,
			getKey: (item) => item.id,
			queryFn: async () => {
				const standings = await trpcClient.seasonTeam.getStanding.query({
					seasonSlug,
				});
				return standings.map((team) => ({
					id: team.id,
					seasonId: team.seasonId,
					leagueTeamId: team.leagueTeamId,
					score: team.score,
					name: team.name,
					logo: team.logo,
					matchCount: team.matchCount,
					winCount: team.winCount,
					lossCount: team.lossCount,
					drawCount: team.drawCount,
					rank: team.rank,
					pointDiff: team.pointDiff,
					form: team.form,
					players: team.players,
				}));
			},
		})
	);
}

export function createTeamStandingCollection(seasonId: string, seasonSlug: string) {
	const existing = teamStandingCollections.get(seasonId);
	if (existing) return existing;

	const collection = createTeamStandingCollectionInternal(seasonId, seasonSlug);
	teamStandingCollections.set(seasonId, collection);
	return collection;
}

export function useTeamStandings(seasonId: string, seasonSlug: string) {
	// Skip if no valid seasonId
	if (!seasonId) {
		return {
			teamStandings: [],
			collection: null,
		};
	}

	const collection = createTeamStandingCollection(seasonId, seasonSlug);

	// eslint-disable-next-line react-hooks/rules-of-hooks
	const { data: teamStandings } = useLiveQuery(
		(q) =>
			q
				.from({ teamStanding: collection })
				.where(({ teamStanding }) => eq(teamStanding.seasonId, seasonId))
				.select(({ teamStanding }) => ({
					id: teamStanding.id,
					seasonId: teamStanding.seasonId,
					leagueTeamId: teamStanding.leagueTeamId,
					score: teamStanding.score,
					name: teamStanding.name,
					logo: teamStanding.logo,
					matchCount: teamStanding.matchCount,
					winCount: teamStanding.winCount,
					lossCount: teamStanding.lossCount,
					drawCount: teamStanding.drawCount,
					rank: teamStanding.rank,
					pointDiff: teamStanding.pointDiff,
					form: teamStanding.form,
					players: teamStanding.players,
				})),
		[seasonId]
	);

	return {
		teamStandings: teamStandings ?? [],
		collection,
	};
}
