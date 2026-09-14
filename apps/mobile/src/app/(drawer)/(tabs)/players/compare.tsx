import { useLocalSearchParams } from "expo-router";

import { PlayerCompare } from "@/components/player/player-compare";

export default function PlayerCompareScreen() {
	const { p1 } = useLocalSearchParams<{ p1?: string }>();

	return <PlayerCompare initialPlayer1Id={p1} />;
}
