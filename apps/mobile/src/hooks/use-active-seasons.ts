import { useQuery } from "@tanstack/react-query";

import { useActiveLeague } from "@/hooks/use-active-league";
import { trpcClient } from "@/lib/trpc";

export function useActiveSeasons() {
	const { activeLeague } = useActiveLeague();
	return useQuery({
		queryKey: ["season", "findAllActive", activeLeague?.id],
		queryFn: () => trpcClient.season.findAllActive.query(),
		enabled: Boolean(activeLeague),
	});
}
