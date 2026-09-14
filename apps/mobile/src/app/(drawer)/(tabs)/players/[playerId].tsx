import { useLocalSearchParams } from "expo-router";

import { PlayerDetail } from "@/components/player/player-detail";

export default function PlayerDetailScreen() {
	const { playerId, view } = useLocalSearchParams<{ playerId: string; view?: string }>();

	if (!playerId) return null;

	return <PlayerDetail playerId={playerId} view={view} />;
}
