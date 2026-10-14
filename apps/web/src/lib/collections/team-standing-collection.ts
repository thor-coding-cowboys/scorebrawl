import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "../trpc";

export function useTeamStandings(seasonSlug: string) {
	const trpc = useTRPC();

	const {
		data: teamStandings = [],
		isLoading,
		error,
	} = useQuery(trpc.seasonTeam.getStanding.queryOptions({ seasonSlug }));

	// Log error for debugging
	if (error) {
		console.error("Team standings error:", error);
	}

	return {
		teamStandings,
		isLoading,
		error,
	};
}
