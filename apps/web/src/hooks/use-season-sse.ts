import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc";

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
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const eventSourceRef = useRef<EventSource | null>(null);
	const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const enabledRef = useRef(enabled);
	const paramsRef = useRef({ leagueSlug, seasonSlug, seasonId, currentUserId });

	// Store trpc and queryClient in refs so they're accessible in callbacks
	const trpcRef = useRef(trpc);
	const queryClientRef = useRef(queryClient);
	trpcRef.current = trpc;
	queryClientRef.current = queryClient;

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

					const t = trpcRef.current;
					const qc = queryClientRef.current;

					// Invalidate matches query on any match mutation
					if (parsed.type === "match:insert" || parsed.type === "match:delete") {
						qc.invalidateQueries({ queryKey: ["infinite-matches", seasonId] });
					}

					// Invalidate standings on any match mutation
					if (
						parsed.data?.standings ||
						parsed.type === "match:insert" ||
						parsed.type === "match:delete"
					) {
						// Invalidate player standings
						qc.invalidateQueries({ queryKey: t.seasonPlayer.getStanding.queryKey({ seasonSlug }) });

						// Invalidate team standings
						qc.invalidateQueries({ queryKey: t.seasonTeam.getStanding.queryKey({ seasonSlug }) });

						// Invalidate tRPC queries for dashboard cards and player data
						qc.invalidateQueries({ queryKey: t.seasonPlayer.getTop.queryKey({ seasonSlug }) });
						qc.invalidateQueries({ queryKey: t.seasonPlayer.getAll.queryKey({ seasonSlug }) });
						qc.invalidateQueries({ queryKey: t.season.getCountInfo.queryKey({ seasonSlug }) });
						qc.invalidateQueries({ queryKey: t.match.getLatest.queryKey({ seasonSlug }) });
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
