import { useLocalSearchParams } from "expo-router";

import { SessionView } from "@/components/session/session-view";

export default function SessionScreen() {
	const { seasonSlug, sessionId } = useLocalSearchParams<{
		seasonSlug: string;
		sessionId: string;
	}>();

	if (!seasonSlug || !sessionId) {
		return null;
	}

	return <SessionView sessionId={sessionId} seasonSlug={seasonSlug} />;
}
