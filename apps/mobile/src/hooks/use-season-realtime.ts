import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import {
	getSeasonInvalidations,
	getSessionInvalidations,
} from "@coding-cowboys/scorebrawl-client/realtime";

import { subscribeSeasonSocket, type SeasonConnectionStatus } from "@/lib/season-socket";
import { useTRPC } from "@/lib/trpc";

export function useSeasonRealtime({
	leagueSlug,
	seasonSlug,
	seasonId,
}: {
	leagueSlug?: string;
	seasonSlug: string;
	seasonId?: string;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [connectionStatus, setConnectionStatus] = useState<SeasonConnectionStatus>("connecting");
	const [hasConnected, setHasConnected] = useState(false);

	useEffect(() => {
		if (!leagueSlug) return;

		const invalidateSeason = () => {
			for (const queryKey of getSeasonInvalidations(trpc, { seasonSlug, seasonId })) {
				queryClient.invalidateQueries({ queryKey });
			}
		};

		return subscribeSeasonSocket({
			leagueSlug,
			seasonSlug,
			onStatusChange: (status) => {
				setConnectionStatus(status);
				if (status === "connected") setHasConnected(true);
			},
			onReconnected: invalidateSeason,
			onEvent: (event) => {
				if (
					event.type === "standings:update" ||
					event.type === "match:insert" ||
					event.type === "match:delete"
				) {
					invalidateSeason();
					return;
				}

				if (event.type === "session:start") {
					queryClient.invalidateQueries({
						queryKey: trpc.session.getActive.queryKey({ seasonSlug }),
					});
					return;
				}

				if (event.type === "session:update" || event.type === "session:end") {
					const sessionId = event.data.sessionId ?? event.data.session?.id;
					if (sessionId) {
						for (const queryKey of getSessionInvalidations(trpc, { sessionId, seasonSlug })) {
							queryClient.invalidateQueries({ queryKey });
						}
					}
					invalidateSeason();
				}
			},
		});
	}, [leagueSlug, seasonSlug, seasonId, trpc, queryClient]);

	return { connectionStatus, hasConnected };
}
