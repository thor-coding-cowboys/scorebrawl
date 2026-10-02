import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { AUTH_BASE_URL } from "@/lib/auth-client";
import { useTRPC } from "@/lib/trpc";

type SeasonRealtimeEvent = {
	type: string;
	user?: { id: string; name: string };
	data?: {
		sessionId?: string;
		session?: { id: string };
	};
};

export function useSessionRealtime({
	leagueSlug,
	seasonSlug,
	sessionId,
	onSessionEnd,
}: {
	leagueSlug?: string;
	seasonSlug: string;
	sessionId: string;
	onSessionEnd?: () => void;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	useEffect(() => {
		if (!leagueSlug) return;

		let mounted = true;
		let socket: WebSocket | null = null;
		let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
		let attempts = 0;

		const connect = () => {
			const base = AUTH_BASE_URL.replace(/^http/, "ws");
			const ws = new WebSocket(`${base}/api/sse/${leagueSlug}/${seasonSlug}`);
			socket = ws;

			ws.onopen = () => {
				attempts = 0;
			};

			ws.onmessage = (event) => {
				if (typeof event.data !== "string") return;

				let parsed: SeasonRealtimeEvent;
				try {
					parsed = JSON.parse(event.data);
				} catch {
					return;
				}

				if (parsed.type !== "session:update" && parsed.type !== "session:end") return;

				const eventSessionId = parsed.data?.sessionId ?? parsed.data?.session?.id;
				if (eventSessionId !== sessionId) return;

				if (parsed.type === "session:end") {
					onSessionEnd?.();
					return;
				}

				queryClient.invalidateQueries({
					queryKey: trpc.session.getById.queryKey({ sessionId }),
				});
				queryClient.invalidateQueries({
					queryKey: trpc.session.getActive.queryKey({ seasonSlug }),
				});
				queryClient.invalidateQueries({
					queryKey: trpc.seasonPlayer.getStanding.queryKey({ seasonSlug }),
				});
				queryClient.invalidateQueries({
					queryKey: trpc.seasonTeam.getStanding.queryKey({ seasonSlug }),
				});
			};

			ws.onclose = () => {
				socket = null;
				if (!mounted) return;
				const delay = Math.min(1000 * 2 ** attempts, 30000);
				attempts += 1;
				reconnectTimer = setTimeout(connect, delay);
			};
		};

		connect();

		return () => {
			mounted = false;
			if (reconnectTimer) clearTimeout(reconnectTimer);
			socket?.close();
		};
	}, [leagueSlug, seasonSlug, sessionId, onSessionEnd, queryClient, trpc]);
}
