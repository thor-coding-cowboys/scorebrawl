import { ThemedText } from "@/components/themed-text";
import { useActiveLeague } from "@/hooks/use-active-league";

export function ActiveLeagueTitle() {
	const { activeLeague } = useActiveLeague();

	return <ThemedText type="subtitle">{activeLeague?.name ?? ""}</ThemedText>;
}
