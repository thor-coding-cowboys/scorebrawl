import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { createMatchCollection } from "@/lib/collections/match-collection";
import { createStandingCollection } from "@/lib/collections/standing-collection";

export interface SeasonSSEEvent {
	type: "connected" | "match:insert" | "match:delete" | "standings:update";
	sessionId?: string;
	user?: {
		id: string;
		name: string;
	};
	data?: {
		match?: {
			id: string;
			seasonId: string;
			homeScore: number;
			awayScore: number;
			createdAt: Date;
		};
		matchId?: string;
		standings?: Array<{
			id: string;
			seasonId: string;
			playerId: string;
			score: number;
			name: string;
			image: string | null;
			userId: string;
			matchCount: number;
			winCount: number;
			lossCount: number;
			drawCount: number;
			rank: number;
			pointDiff: number;
			form: Array<"W" | "D" | "L">;
		}>;
	};
}

interface UseSeasonSSEOptions {
	leagueSlug: string;
	seasonSlug: string;
	seasonId: string;
	currentUserId?: string;
	enabled?: boolean;
}

export function useSeasonSSE({
	leagueSlug,
	seasonSlug,
	seasonId,
	currentUserId,
	enabled = true,
}: UseSeasonSSEOptions) {
	const eventSourceRef = useRef<EventSource | null>(null);
	const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const enabledRef = useRef(enabled);
	const paramsRef = useRef({ leagueSlug, seasonSlug, seasonId, currentUserId });

	// Update refs when params change
	enabledRef.current = enabled;
	paramsRef.current = { leagueSlug, seasonSlug, seasonId, currentUserId };

	useEffect(() => {
		let isMounted = true;

		const connect = () => {
			if (!enabledRef.current || !isMounted) return;

			const { leagueSlug, seasonSlug, seasonId, currentUserId } = paramsRef.current;
			const url = `/api/sse/${leagueSlug}/${seasonSlug}`;
			const eventSource = new EventSource(url);
			eventSourceRef.current = eventSource;

			eventSource.onmessage = (event) => {
				try {
					const parsed: SeasonSSEEvent = JSON.parse(event.data);

					if (parsed.type === "connected") {
						console.log("[SSE] Connected with sessionId:", parsed.sessionId);
						return;
					}

					console.log("[SSE] Received event:", parsed.type);

					const matchCollection = createMatchCollection(seasonId, seasonSlug);
					const standingCollection = createStandingCollection(seasonId, seasonSlug);

					// Use refetch to update the collections - this is safer than direct writes
					// as it handles the case where the collection might not be fully initialized
					if (parsed.type === "match:insert" || parsed.type === "match:delete") {
						matchCollection.utils.refetch().catch((err) => {
							console.error("[SSE] Failed to refetch matches:", err);
						});
					}

					// Always refetch standings on any match mutation
					if (
						parsed.data?.standings ||
						parsed.type === "match:insert" ||
						parsed.type === "match:delete"
					) {
						standingCollection.utils.refetch().catch((err) => {
							console.error("[SSE] Failed to refetch standings:", err);
						});
					}

					// Show toast for match events from other users
					if (parsed.user && parsed.user.id !== currentUserId) {
						if (parsed.type === "match:insert") {
							toast.info(`${parsed.user.name} registered a match`);
						} else if (parsed.type === "match:delete") {
							toast.info(`${parsed.user.name} deleted a match`);
						}
					}
				} catch (error) {
					console.error("[SSE] Failed to parse event:", error);
				}
			};

			eventSource.onerror = () => {
				console.log("[SSE] Connection error, reconnecting...");
				eventSource.close();
				eventSourceRef.current = null;

				if (isMounted) {
					// Reconnect after 3 seconds
					reconnectTimeoutRef.current = setTimeout(connect, 3000);
				}
			};
		};

		connect();

		return () => {
			isMounted = false;
			if (reconnectTimeoutRef.current) {
				clearTimeout(reconnectTimeoutRef.current);
			}
			if (eventSourceRef.current) {
				eventSourceRef.current.close();
			}
		};
	}, [leagueSlug, seasonSlug, seasonId, enabled]);

	return {
		disconnect: () => {
			if (eventSourceRef.current) {
				eventSourceRef.current.close();
				eventSourceRef.current = null;
			}
		},
	};
}
