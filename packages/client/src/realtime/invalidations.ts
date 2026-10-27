import type { QueryKey } from "@tanstack/react-query";

export interface SessionInvalidationSource {
	session: {
		getById: { queryKey: (input: { sessionId: string }) => QueryKey };
		getActive: { queryKey: (input: { seasonSlug: string }) => QueryKey };
	};
	seasonPlayer: {
		getStanding: { queryKey: (input: { seasonSlug: string }) => QueryKey };
	};
	seasonTeam: {
		getStanding: { queryKey: (input: { seasonSlug: string }) => QueryKey };
	};
}

export interface SeasonInvalidationSource {
	session: {
		getActive: { queryKey: (input: { seasonSlug: string }) => QueryKey };
	};
	seasonPlayer: {
		getStanding: { queryKey: (input: { seasonSlug: string }) => QueryKey };
		getTop: { queryKey: (input: { seasonSlug: string }) => QueryKey };
		getAll: { queryKey: (input: { seasonSlug: string }) => QueryKey };
	};
	seasonTeam: {
		getStanding: { queryKey: (input: { seasonSlug: string }) => QueryKey };
	};
	season: {
		getCountInfo: { queryKey: (input: { seasonSlug: string }) => QueryKey };
		getFixtures: { queryKey: (input: { seasonSlug: string }) => QueryKey };
	};
	match: {
		getLatest: { queryKey: (input: { seasonSlug: string }) => QueryKey };
		getAll: { queryKey: (input: { seasonSlug: string }) => QueryKey };
	};
}

export function getSessionInvalidations(
	trpc: SessionInvalidationSource,
	{ sessionId, seasonSlug }: { sessionId: string; seasonSlug: string }
): QueryKey[] {
	return [
		trpc.session.getById.queryKey({ sessionId }),
		trpc.session.getActive.queryKey({ seasonSlug }),
		trpc.seasonPlayer.getStanding.queryKey({ seasonSlug }),
		trpc.seasonTeam.getStanding.queryKey({ seasonSlug }),
	];
}

export function getSeasonInvalidations(
	trpc: SeasonInvalidationSource,
	{ seasonSlug, seasonId }: { seasonSlug: string; seasonId?: string }
): QueryKey[] {
	const keys: QueryKey[] = [
		trpc.seasonPlayer.getStanding.queryKey({ seasonSlug }),
		trpc.seasonTeam.getStanding.queryKey({ seasonSlug }),
		trpc.seasonPlayer.getTop.queryKey({ seasonSlug }),
		trpc.seasonPlayer.getAll.queryKey({ seasonSlug }),
		trpc.season.getCountInfo.queryKey({ seasonSlug }),
		trpc.season.getFixtures.queryKey({ seasonSlug }),
		trpc.match.getLatest.queryKey({ seasonSlug }),
		trpc.match.getAll.queryKey({ seasonSlug }),
		trpc.session.getActive.queryKey({ seasonSlug }),
	];

	if (seasonId) {
		keys.push(["infinite-matches", seasonId], ["matches", seasonId]);
	}

	return keys;
}
