import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import {
	getSeasonInvalidations,
	getSessionInvalidations,
	type SessionScoreUpdate,
} from "@coding-cowboys/scorebrawl-client/realtime";

import { subscribeSeasonSocket, type SeasonConnectionStatus } from "@/lib/season-socket";
import { useTRPC } from "@/lib/trpc";

export function useSessionRealtime({
	leagueSlug,
	seasonSlug,
	sessionId,
	onSessionEnd,
	onScoreUpdate,
}: {
	leagueSlug?: string;
	seasonSlug: string;
	sessionId: string;
	onSessionEnd?: () => void;
	onScoreUpdate?: (input: SessionScoreUpdate) => void;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [connectionStatus, setConnectionStatus] = useState<SeasonConnectionStatus>("connecting");
	const [hasConnected, setHasConnected] = useState(false);

	useEffect(() => {
		if (!leagueSlug) return;

		const reconcile = () => {
			for (const queryKey of getSessionInvalidations(trpc, { sessionId, seasonSlug })) {
				queryClient.invalidateQueries({ queryKey });
			}
			for (const queryKey of getSeasonInvalidations(trpc, { seasonSlug })) {
				queryClient.invalidateQueries({ queryKey }, { cancelRefetch: false });
			}
		};

		return subscribeSeasonSocket({
			leagueSlug,
			seasonSlug,
			onStatusChange: (status) => {
				setConnectionStatus(status);
				if (status === "connected") setHasConnected(true);
			},
			onReconnected: reconcile,
			onEvent: (event) => {
				if (event.type === "session:score-update") {
					const eventSessionId = event.data.sessionId;
					if (eventSessionId !== sessionId) return;
					const { sessionMatchId, homeScore, awayScore } = event.data;
					if (typeof homeScore !== "number" || typeof awayScore !== "number") return;
					onScoreUpdate?.({ sessionMatchId, homeScore, awayScore });
					return;
				}

				if (event.type === "standings:update") {
					for (const queryKey of getSeasonInvalidations(trpc, { seasonSlug })) {
						queryClient.invalidateQueries({ queryKey }, { cancelRefetch: false });
					}
					return;
				}

				if (event.type === "session:start") {
					queryClient.invalidateQueries({
						queryKey: trpc.session.getActive.queryKey({ seasonSlug }),
					});
					return;
				}

				if (event.type !== "session:update" && event.type !== "session:end") return;

				const eventSessionId = event.data.sessionId ?? event.data.session?.id;
				if (eventSessionId !== sessionId) return;

				if (event.type === "session:end") {
					onSessionEnd?.();
				}

				for (const queryKey of getSessionInvalidations(trpc, { sessionId, seasonSlug })) {
					queryClient.invalidateQueries({ queryKey });
				}
			},
		});
	}, [leagueSlug, seasonSlug, sessionId, onSessionEnd, onScoreUpdate, queryClient, trpc]);

	return { connectionStatus, hasConnected };
}
