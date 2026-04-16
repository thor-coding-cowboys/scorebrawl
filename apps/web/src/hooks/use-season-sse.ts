import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc";
import "@/lib/event-types";

type StreakData = {
	playerId?: string;
	playerName?: string;
	playerImage?: string | null;
	streak?: number;
	timestamp?: number;
	isTeam?: boolean;
};

type SessionData = {
	sessionId?: string;
	session?: { id: string };
};

type MatchData = {
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

export type SeasonSSEEvent =
	| { type: "connected"; user?: { id: string; name: string } }
	| { type: "streak"; user?: { id: string; name: string }; data: StreakData }
	| { type: "session:start"; user?: { id: string; name: string }; data: SessionData }
	| { type: "session:update"; user?: { id: string; name: string }; data: SessionData }
	| { type: "session:end"; user?: { id: string; name: string }; data: SessionData }
	| { type: "match:insert"; user?: { id: string; name: string }; data?: MatchData }
	| { type: "match:delete"; user?: { id: string; name: string }; data?: MatchData }
	| { type: "standings:update"; user?: { id: string; name: string }; data?: MatchData };

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
	const reconnectAttemptsRef = useRef(0);
	const enabledRef = useRef(enabled);
	const paramsRef = useRef({ leagueSlug, seasonSlug, seasonId, currentUserId });
	const [connectionStatus, setConnectionStatus] = useState<
		"connecting" | "connected" | "disconnected"
	>("connecting");

	const trpcRef = useRef(trpc);
	const queryClientRef = useRef(queryClient);
	trpcRef.current = trpc;
	queryClientRef.current = queryClient;

	enabledRef.current = enabled;
	paramsRef.current = { leagueSlug, seasonSlug, seasonId, currentUserId };

	useEffect(() => {
		let isMounted = true;

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
				if (isMounted) {
					setConnectionStatus("connected");
				}
			};

			ws.onmessage = (event) => {
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
						const sessionId = parsed.data?.sessionId ?? parsed.data?.session?.id;
						window.dispatchEvent(
							new CustomEvent("session-event", {
								detail: { type: parsed.type, sessionId, userName: parsed.user?.name },
							})
						);

						if (sessionId) {
							qc.invalidateQueries({
								queryKey: t.session.getById.queryKey({ sessionId }),
							});
						}
						qc.invalidateQueries({
							queryKey: t.session.getActive.queryKey({ seasonSlug }),
						});

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

					if (!isOwnEvent) {
						if (parsed.type === "match:insert" || parsed.type === "match:delete") {
							qc.invalidateQueries({ queryKey: ["infinite-matches", seasonId] });
							qc.invalidateQueries({ queryKey: ["matches", seasonId] });
						}

						if (
							(parsed.type === "standings:update" && parsed.data?.standings) ||
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

					if (parsed.user && parsed.user.id !== currentUserId) {
						if (parsed.type === "match:insert") {
							toast.info(`${parsed.user.name} registered a match`);
						} else if (parsed.type === "match:delete") {
							toast.info(`${parsed.user.name} deleted a match`);
						}
					}
				} catch {
					// ignore malformed events
				}
			};

			ws.onclose = () => {
				wsRef.current = null;
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
			if (wsRef.current) {
				wsRef.current.close();
			}
		};
	}, [leagueSlug, seasonSlug, seasonId, enabled]);

	return {
		connectionStatus,
		disconnect: () => {
			if (wsRef.current) {
				wsRef.current.close();
				wsRef.current = null;
			}
		},
	};
}
