import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import {
	getSessionInvalidations,
	type SessionScoreUpdate,
} from "@coding-cowboys/scorebrawl-client/realtime";

import { AUTH_BASE_URL } from "@/lib/auth-client";
import { useTRPC } from "@/lib/trpc";

const CONNECT_STABILITY_MS = 500;

type SeasonRealtimeEvent = {
	type: string;
	user?: { id: string; name: string };
	data?: {
		sessionId?: string;
		session?: { id: string };
		sessionMatchId?: string;
		homeScore?: number;
		awayScore?: number;
	};
};

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
	const [connectionStatus, setConnectionStatus] = useState<
		"connecting" | "connected" | "disconnected"
	>("connecting");
	const [hasConnected, setHasConnected] = useState(false);
	const hasConnectedRef = useRef(false);

	useEffect(() => {
		if (!leagueSlug) return;

		let mounted = true;
		let socket: WebSocket | null = null;
		let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
		let stableTimer: ReturnType<typeof setTimeout> | null = null;
		let attempts = 0;

		const reconcile = () => {
			for (const queryKey of getSessionInvalidations(trpc, { sessionId, seasonSlug })) {
				queryClient.invalidateQueries({ queryKey });
			}
		};

		const connect = () => {
			if (!mounted) return;
			setConnectionStatus("connecting");
			const base = AUTH_BASE_URL.replace(/^http/, "ws");
			const ws = new WebSocket(`${base}/api/sse/${leagueSlug}/${seasonSlug}`);
			socket = ws;

			ws.onopen = () => {
				attempts = 0;
				if (!mounted) return;
				if (stableTimer) clearTimeout(stableTimer);
				stableTimer = setTimeout(() => {
					stableTimer = null;
					if (!mounted) return;
					setConnectionStatus("connected");
					if (hasConnectedRef.current) {
						reconcile();
					} else {
						hasConnectedRef.current = true;
						setHasConnected(true);
					}
				}, CONNECT_STABILITY_MS);
			};

			ws.onmessage = (event) => {
				if (typeof event.data !== "string") return;

				let parsed: SeasonRealtimeEvent;
				try {
					parsed = JSON.parse(event.data);
				} catch {
					return;
				}

				const eventSessionId = parsed.data?.sessionId ?? parsed.data?.session?.id;

				if (parsed.type === "session:score-update") {
					if (eventSessionId !== sessionId) return;
					const { sessionMatchId, homeScore, awayScore } = parsed.data ?? {};
					if (typeof homeScore !== "number" || typeof awayScore !== "number") return;
					onScoreUpdate?.({ sessionMatchId, homeScore, awayScore });
					return;
				}

				if (parsed.type !== "session:update" && parsed.type !== "session:end") return;

				if (eventSessionId !== sessionId) return;

				if (parsed.type === "session:end") {
					onSessionEnd?.();
					return;
				}

				for (const queryKey of getSessionInvalidations(trpc, { sessionId, seasonSlug })) {
					queryClient.invalidateQueries({ queryKey });
				}
			};

			ws.onclose = () => {
				socket = null;
				if (stableTimer) {
					clearTimeout(stableTimer);
					stableTimer = null;
				}
				if (!mounted) return;
				setConnectionStatus("disconnected");
				const delay = Math.min(1000 * 2 ** attempts, 30000);
				attempts += 1;
				reconnectTimer = setTimeout(connect, delay);
			};
		};

		connect();

		return () => {
			mounted = false;
			if (reconnectTimer) clearTimeout(reconnectTimer);
			if (stableTimer) clearTimeout(stableTimer);
			socket?.close();
		};
	}, [leagueSlug, seasonSlug, sessionId, onSessionEnd, onScoreUpdate, queryClient, trpc]);

	return { connectionStatus, hasConnected };
}
