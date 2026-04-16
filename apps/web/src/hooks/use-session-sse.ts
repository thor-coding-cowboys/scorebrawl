import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { SessionEventDetail } from "@/lib/event-types";

interface UseSessionSSEOptions {
	sessionId: string;
	onSessionEnd?: (userName?: string) => void;
	onSessionUpdate?: (isOwnUpdate: boolean) => void;
}

export function useSessionSSE({ sessionId, onSessionEnd, onSessionUpdate }: UseSessionSSEOptions) {
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
		window.addEventListener("session-event", handler);
		return () => window.removeEventListener("session-event", handler);
	}, [sessionId, queryClient, onSessionEnd, onSessionUpdate]);

	return {
		setAuthSession: (session: typeof authSessionRef.current) => {
			authSessionRef.current = session;
		},
	};
}
