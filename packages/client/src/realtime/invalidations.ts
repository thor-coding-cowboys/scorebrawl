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
