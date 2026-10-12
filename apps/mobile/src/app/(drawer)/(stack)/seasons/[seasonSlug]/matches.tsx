import { useQuery } from "@tanstack/react-query";
import { Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";

import { CreateMatchFlow } from "@/components/create-match-flow";
import { LatestMatches } from "@/components/latest-matches";
import { HeaderPillButton } from "@/components/nav/header-buttons";
import { authClient } from "@/lib/auth-client";
import { useTRPC } from "@/lib/trpc";

export default function SeasonMatchesScreen() {
	const { seasonSlug } = useLocalSearchParams<{ seasonSlug: string }>();
	const trpc = useTRPC();
	const { data: season } = useQuery(trpc.season.getBySlug.queryOptions({ seasonSlug }));
	const { data: activeMember } = authClient.useActiveMember();
	const role = activeMember?.role;
	const canCreateMatches = role === "owner" || role === "editor" || role === "member";
	const isLocked = Boolean(season?.closed || season?.archived);
	const [isCreateOpen, setIsCreateOpen] = useState(false);

	return (
		<>
			<Stack.Screen
				options={{
					headerRight: canCreateMatches
						? () => (
								<HeaderPillButton
									icon={{ ios: "plus", android: "add", web: "add" }}
									label="Match"
									tone="glow"
									disabled={isLocked}
									onPress={() => setIsCreateOpen(true)}
								/>
							)
						: undefined,
				}}
			/>
			<LatestMatches seasonSlug={seasonSlug} season={season} />
			{canCreateMatches ? (
				<CreateMatchFlow
					isOpen={isCreateOpen}
					onClose={() => setIsCreateOpen(false)}
					seasonSlug={seasonSlug}
				/>
			) : null}
		</>
	);
}
