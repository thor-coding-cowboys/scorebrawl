import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "../trpc";

export function useStandings(seasonSlug: string) {
	const trpc = useTRPC();

	const { data: standings = [], isLoading } = useQuery(
		trpc.seasonPlayer.getStanding.queryOptions({ seasonSlug })
	);

	return {
		standings,
		isLoading,
	};
}
