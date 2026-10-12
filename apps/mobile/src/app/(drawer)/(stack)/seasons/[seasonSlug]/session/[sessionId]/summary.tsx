import { useLocalSearchParams } from "expo-router";

import { SessionSummaryView } from "@/components/session/session-summary";

export default function SessionSummaryScreen() {
	const { sessionId } = useLocalSearchParams<{ sessionId: string }>();

	if (!sessionId) return null;

	return <SessionSummaryView sessionId={sessionId} />;
}
