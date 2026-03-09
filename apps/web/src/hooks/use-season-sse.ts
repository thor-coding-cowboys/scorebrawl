import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc";
import "@/lib/event-types";

export interface SeasonSSEEvent {
	type:
		| "connected"
		| "match:insert"
		| "match:delete"
		| "standings:update"
		| "streak"
		| "session:start"
		| "session:update"
		| "session:end";
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
		playerId?: string;
		playerName?: string;
		playerImage?: string | null;
		streak?: number;
		timestamp?: number;
		isTeam?: boolean;
		sessionId?: string;
		session?: { id: string };
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
						return;
					}

					const t = trpcRef.current;
					const qc = queryClientRef.current;
					const isOwnEvent = parsed.user?.id === currentUserId;

					if (parsed.type === "streak" && parsed.data) {
						window.dispatchEvent(
							new CustomEvent("streak-event", {
								detail: {
									playerId: parsed.data.playerId,
									playerName: parsed.data.playerName,
									playerImage: parsed.data.playerImage,
									streak: parsed.data.streak,
									timestamp: parsed.data.timestamp,
									isTeam: parsed.data.isTeam,
								},
							})
						);
						return;
					}

					if (
						parsed.type === "session:start" ||
						parsed.type === "session:update" ||
						parsed.type === "session:end"
					) {
						const sessionId =
							parsed.data?.sessionId ?? parsed.data?.session?.id ?? parsed.sessionId;
						window.dispatchEvent(
							new CustomEvent("session-event", {
								detail: { type: parsed.type, sessionId },
							})
						);

						if (parsed.type === "session:update" || parsed.type === "session:end") {
							qc.invalidateQueries({
								queryKey: t.seasonPlayer.getStanding.queryKey({ seasonSlug }),
							});
							qc.invalidateQueries({
								queryKey: t.seasonTeam.getStanding.queryKey({ seasonSlug }),
							});
							qc.invalidateQueries({
								queryKey: t.match.getLatest.queryKey({ seasonSlug }),
							});
						}
						return;
					}

					// Skip invalidation for own events — the mutation onSuccess already handles it.
					// Only invalidate for events from other users.
					if (!isOwnEvent) {
						if (parsed.type === "match:insert" || parsed.type === "match:delete") {
							qc.invalidateQueries({ queryKey: ["infinite-matches", seasonId] });
							qc.invalidateQueries({ queryKey: ["matches", seasonId] });
						}

						if (
							parsed.data?.standings ||
							parsed.type === "match:insert" ||
							parsed.type === "match:delete"
						) {
							qc.invalidateQueries({
								queryKey: t.seasonPlayer.getStanding.queryKey({ seasonSlug }),
							});
							qc.invalidateQueries({
								queryKey: t.seasonTeam.getStanding.queryKey({ seasonSlug }),
							});
							qc.invalidateQueries({ queryKey: t.seasonPlayer.getTop.queryKey({ seasonSlug }) });
							qc.invalidateQueries({ queryKey: t.seasonPlayer.getAll.queryKey({ seasonSlug }) });
							qc.invalidateQueries({ queryKey: t.season.getCountInfo.queryKey({ seasonSlug }) });
							qc.invalidateQueries({ queryKey: t.match.getLatest.queryKey({ seasonSlug }) });
							qc.invalidateQueries({
								queryKey: t.season.getFixtures.queryKey({ seasonSlug }),
							});
						}
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
