import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc";
import {
	getSeasonInvalidations,
	getSessionInvalidations,
	type SeasonRealtimeEvent,
	type SessionEventDetail,
} from "@coding-cowboys/scorebrawl-client/realtime";
import { buildMatchResultToast } from "@coding-cowboys/scorebrawl-core/presentation";
import { achievementCatalog } from "@coding-cowboys/scorebrawl-core/achievements";
import { AvatarWithFallback } from "@/components/ui/avatar-with-fallback";
import "@/lib/event-types";

const CONNECT_STABILITY_MS = 500;

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
	const wsRef = useRef<WebSocket | null>(null);
	const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const stableTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const reconnectAttemptsRef = useRef(0);
	const enabledRef = useRef(enabled);
	const paramsRef = useRef({ leagueSlug, seasonSlug, seasonId, currentUserId });
	const [connectionStatus, setConnectionStatus] = useState<
		"connecting" | "connected" | "disconnected"
	>("connecting");
	const [hasConnected, setHasConnected] = useState(false);
	const hasConnectedRef = useRef(false);

	const trpcRef = useRef(trpc);
	const queryClientRef = useRef(queryClient);
	trpcRef.current = trpc;
	queryClientRef.current = queryClient;

	enabledRef.current = enabled;
	paramsRef.current = { leagueSlug, seasonSlug, seasonId, currentUserId };

	useEffect(() => {
		let isMounted = true;

		const reconcile = () => {
			const t = trpcRef.current;
			const qc = queryClientRef.current;
			const { seasonSlug: slug, seasonId: id } = paramsRef.current;

			for (const queryKey of getSeasonInvalidations(t, { seasonSlug: slug, seasonId: id })) {
				qc.invalidateQueries({ queryKey });
			}
		};

		const connect = () => {
			if (!enabledRef.current || !isMounted) return;

			setConnectionStatus("connecting");
			const { leagueSlug, seasonSlug, seasonId, currentUserId } = paramsRef.current;
			const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
			const wsUrl = `${protocol}//${window.location.host}/api/sse/${leagueSlug}/${seasonSlug}`;
			const ws = new WebSocket(wsUrl);
			wsRef.current = ws;

			ws.onopen = () => {
				reconnectAttemptsRef.current = 0;
				if (!isMounted) return;
				if (stableTimerRef.current) clearTimeout(stableTimerRef.current);
				stableTimerRef.current = setTimeout(() => {
					stableTimerRef.current = null;
					if (!isMounted) return;
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
				try {
					const parsed: SeasonRealtimeEvent = JSON.parse(event.data);

					if (parsed.type === "connected") {
						return;
					}

					const t = trpcRef.current;
					const qc = queryClientRef.current;
					const isOwnEvent = "user" in parsed && parsed.user?.id === currentUserId;

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

					if (parsed.type === "achievement:unlock" && parsed.data?.player && parsed.data.type) {
						const { player, type } = parsed.data;
						toast.info(
							<span className="flex items-center gap-2">
								<AvatarWithFallback src={player.image} name={player.name} size="sm" />
								<span>
									{player.name} unlocked{" "}
									<b>{achievementCatalog[type as keyof typeof achievementCatalog]?.name ?? type}</b>
								</span>
							</span>
						);
						if (player.id === currentUserId) {
							window.dispatchEvent(
								new CustomEvent("achievement-event", {
									detail: {
										playerId: player.id,
										playerName: player.name,
										playerImage: player.image,
										type,
										timestamp: Date.now(),
									},
								})
							);
						}
						return;
					}

					if (parsed.type === "session:score-update" && parsed.data) {
						window.dispatchEvent(
							new CustomEvent("session-score-event", {
								detail: {
									sessionId: parsed.data.sessionId,
									sessionMatchId: parsed.data.sessionMatchId,
									homeScore: parsed.data.homeScore,
									awayScore: parsed.data.awayScore,
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
						const sessionId = parsed.data.sessionId ?? parsed.data.session?.id;
						window.dispatchEvent(
							new CustomEvent<SessionEventDetail>("session-event", {
								detail: { type: parsed.type, sessionId, userName: parsed.user?.name },
							})
						);

						if (parsed.type === "session:update" || parsed.type === "session:end") {
							if (sessionId) {
								for (const queryKey of getSessionInvalidations(t, { sessionId, seasonSlug })) {
									qc.invalidateQueries({ queryKey });
								}
							} else {
								qc.invalidateQueries({
									queryKey: t.session.getActive.queryKey({ seasonSlug }),
								});
							}
						} else {
							if (sessionId) {
								qc.invalidateQueries({
									queryKey: t.session.getById.queryKey({ sessionId }),
								});
							}
							qc.invalidateQueries({
								queryKey: t.session.getActive.queryKey({ seasonSlug }),
							});
						}

						if (!isOwnEvent) {
							if (parsed.type === "session:start" && parsed.user) {
								toast.info(`${parsed.user.name} started a session`);
							} else if (parsed.type === "session:end") {
								toast.info(
									parsed.user ? `${parsed.user.name} ended a session` : "Session auto-closed"
								);
							}
						}
						return;
					}

					if (parsed.type === "standings:update") {
						for (const queryKey of getSeasonInvalidations(t, { seasonSlug, seasonId })) {
							qc.invalidateQueries({ queryKey });
						}
						return;
					}

					if (parsed.type === "match:insert" || parsed.type === "match:delete") {
						qc.invalidateQueries({ queryKey: ["infinite-matches", seasonId] });
						qc.invalidateQueries({ queryKey: ["matches", seasonId] });
						qc.invalidateQueries({ queryKey: t.match.getAll.queryKey({ seasonSlug }) });

						if (!isOwnEvent && parsed.user) {
							if (parsed.type === "match:insert") {
								toast.info(
									buildMatchResultToast({
										scoreType: parsed.data.scoreType,
										players: parsed.data.players,
										homeScore: parsed.data.match.homeScore,
										awayScore: parsed.data.match.awayScore,
									})
								);
							} else {
								toast.info(`${parsed.user.name} deleted a match`);
							}
						}
					}
				} catch {
					// ignore malformed events
				}
			};

			ws.onclose = () => {
				wsRef.current = null;
				if (stableTimerRef.current) {
					clearTimeout(stableTimerRef.current);
					stableTimerRef.current = null;
				}
				if (isMounted) {
					setConnectionStatus("disconnected");
					const delay = Math.min(1000 * 2 ** reconnectAttemptsRef.current, 30000);
					reconnectAttemptsRef.current++;
					reconnectTimeoutRef.current = setTimeout(connect, delay);
				}
			};
		};

		connect();

		return () => {
			isMounted = false;
			reconnectAttemptsRef.current = 0;
			if (reconnectTimeoutRef.current) {
				clearTimeout(reconnectTimeoutRef.current);
			}
			if (stableTimerRef.current) {
				clearTimeout(stableTimerRef.current);
				stableTimerRef.current = null;
			}
			if (wsRef.current) {
				wsRef.current.close();
			}
		};
	}, [leagueSlug, seasonSlug, seasonId, enabled]);

	return {
		connectionStatus,
		hasConnected,
		disconnect: () => {
			if (wsRef.current) {
				wsRef.current.close();
				wsRef.current = null;
			}
		},
	};
}
