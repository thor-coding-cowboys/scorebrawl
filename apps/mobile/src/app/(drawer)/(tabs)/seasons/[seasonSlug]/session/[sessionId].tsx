import { useLocalSearchParams } from "expo-router";

import { SessionView } from "@/components/session/session-view";

export default function SessionScreen() {
	const {
		seasonSlug,
		sessionId,
		view = "next",
	} = useLocalSearchParams<{
		seasonSlug: string;
		sessionId: string;
		view?: string;
	}>();

	if (!seasonSlug || !sessionId) {
		return null;
	}

	return <SessionView sessionId={sessionId} seasonSlug={seasonSlug} view={view} />;
}
