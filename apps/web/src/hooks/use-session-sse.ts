import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type {
	SessionEventDetail,
	SessionScoreEventDetail,
} from "@coding-cowboys/scorebrawl-client/realtime";

interface UseSessionSSEOptions {
	sessionId: string;
	onSessionEnd?: (userName?: string) => void;
	onSessionUpdate?: (isOwnUpdate: boolean) => void;
	onScoreUpdate?: (input: {
		sessionMatchId?: string;
		homeScore: number;
		awayScore: number;
	}) => void;
}

export function useSessionSSE({
	sessionId,
	onSessionEnd,
	onSessionUpdate,
	onScoreUpdate,
}: UseSessionSSEOptions) {
	const queryClient = useQueryClient();
	const authSessionRef = useRef<{ user?: { name?: string } } | null>(null);

	useEffect(() => {
		const handler = (e: CustomEvent<SessionEventDetail>) => {
			const detail = e.detail;
			if (detail.type === "session:end" && detail.sessionId === sessionId) {
				onSessionEnd?.(detail.userName);
				return;
			}
			if (detail.type === "session:update" && detail.sessionId === sessionId) {
				const isOwnUpdate = detail.userName === authSessionRef.current?.user?.name;
				onSessionUpdate?.(isOwnUpdate);
				queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
			}
		};
		const scoreHandler = (e: CustomEvent<SessionScoreEventDetail>) => {
			const detail = e.detail;
			if (detail.sessionId !== sessionId) return;
			if (typeof detail.homeScore !== "number" || typeof detail.awayScore !== "number") return;
			onScoreUpdate?.({
				sessionMatchId: detail.sessionMatchId,
				homeScore: detail.homeScore,
				awayScore: detail.awayScore,
			});
		};
		window.addEventListener("session-event", handler);
		window.addEventListener("session-score-event", scoreHandler);
		return () => {
			window.removeEventListener("session-event", handler);
			window.removeEventListener("session-score-event", scoreHandler);
		};
	}, [sessionId, queryClient, onSessionEnd, onSessionUpdate, onScoreUpdate]);

	return {
		setAuthSession: (session: typeof authSessionRef.current) => {
			authSessionRef.current = session;
		},
	};
}
