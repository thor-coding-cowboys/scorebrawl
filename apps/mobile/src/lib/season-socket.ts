import { AppState } from "react-native";

import type { SeasonRealtimeEvent } from "@coding-cowboys/scorebrawl-client/realtime";

import { AUTH_BASE_URL } from "./auth-client";

const CONNECT_STABILITY_MS = 500;

export type SeasonConnectionStatus = "connecting" | "connected" | "disconnected";

interface SeasonSocketSubscriber {
	onEvent: (event: SeasonRealtimeEvent) => void;
	onReconnected?: () => void;
}

interface SeasonSocketConnection {
	socket: WebSocket | null;
	subscribers: Set<SeasonSocketSubscriber>;
	statusListeners: Set<(status: SeasonConnectionStatus) => void>;
	status: SeasonConnectionStatus;
	attempts: number;
	hasConnected: boolean;
	reconnectTimer: ReturnType<typeof setTimeout> | null;
	stableTimer: ReturnType<typeof setTimeout> | null;
	appStateSubscription: { remove: () => void } | null;
	disposed: boolean;
}

const connections = new Map<string, SeasonSocketConnection>();

function connectionKey(leagueSlug: string, seasonSlug: string) {
	return `${leagueSlug}/${seasonSlug}`;
}

function setStatus(conn: SeasonSocketConnection, status: SeasonConnectionStatus) {
	conn.status = status;
	for (const listener of conn.statusListeners) {
		listener(status);
	}
}

function clearTimers(conn: SeasonSocketConnection) {
	if (conn.reconnectTimer) {
		clearTimeout(conn.reconnectTimer);
		conn.reconnectTimer = null;
	}
	if (conn.stableTimer) {
		clearTimeout(conn.stableTimer);
		conn.stableTimer = null;
	}
}

function connect(conn: SeasonSocketConnection, leagueSlug: string, seasonSlug: string) {
	if (conn.socket || conn.disposed) return;

	setStatus(conn, "connecting");
	const base = AUTH_BASE_URL.replace(/^http/, "ws");
	const socket = new WebSocket(`${base}/api/sse/${leagueSlug}/${seasonSlug}`);
	conn.socket = socket;

	socket.onopen = () => {
		conn.attempts = 0;
		if (conn.stableTimer) clearTimeout(conn.stableTimer);
		conn.stableTimer = setTimeout(() => {
			conn.stableTimer = null;
			setStatus(conn, "connected");
			if (conn.hasConnected) {
				for (const subscriber of conn.subscribers) {
					subscriber.onReconnected?.();
				}
			} else {
				conn.hasConnected = true;
			}
		}, CONNECT_STABILITY_MS);
	};

	socket.onmessage = (event) => {
		if (typeof event.data !== "string") return;

		let parsed: SeasonRealtimeEvent;
		try {
			parsed = JSON.parse(event.data) as SeasonRealtimeEvent;
		} catch {
			return;
		}

		for (const subscriber of conn.subscribers) {
			subscriber.onEvent(parsed);
		}
	};

	socket.onclose = () => {
		conn.socket = null;
		clearTimers(conn);
		if (conn.disposed) return;
		setStatus(conn, "disconnected");
		const delay = Math.min(1000 * 2 ** conn.attempts, 30000);
		conn.attempts += 1;
		conn.reconnectTimer = setTimeout(() => {
			conn.reconnectTimer = null;
			connect(conn, leagueSlug, seasonSlug);
		}, delay);
	};
}

function dispose(conn: SeasonSocketConnection) {
	conn.disposed = true;
	clearTimers(conn);
	conn.appStateSubscription?.remove();
	conn.socket?.close();
	conn.socket = null;
	conn.subscribers.clear();
	conn.statusListeners.clear();
}

export function subscribeSeasonSocket({
	leagueSlug,
	seasonSlug,
	onEvent,
	onReconnected,
	onStatusChange,
}: {
	leagueSlug: string;
	seasonSlug: string;
	onEvent: (event: SeasonRealtimeEvent) => void;
	onReconnected?: () => void;
	onStatusChange?: (status: SeasonConnectionStatus) => void;
}): () => void {
	const key = connectionKey(leagueSlug, seasonSlug);
	let conn = connections.get(key);

	if (!conn) {
		conn = {
			socket: null,
			subscribers: new Set(),
			statusListeners: new Set(),
			status: "connecting",
			attempts: 0,
			hasConnected: false,
			reconnectTimer: null,
			stableTimer: null,
			appStateSubscription: null,
			disposed: false,
		};
		connections.set(key, conn);
		const created = conn;
		created.appStateSubscription = AppState.addEventListener("change", (state) => {
			if (state === "active" && !created.socket && !created.reconnectTimer) {
				connect(created, leagueSlug, seasonSlug);
			}
		});
	}

	const connection = conn;
	const subscriber: SeasonSocketSubscriber = { onEvent, onReconnected };
	connection.subscribers.add(subscriber);
	if (onStatusChange) {
		connection.statusListeners.add(onStatusChange);
		onStatusChange(connection.status);
	}
	if (!connection.socket && !connection.reconnectTimer) {
		connect(connection, leagueSlug, seasonSlug);
	}

	return () => {
		connection.subscribers.delete(subscriber);
		if (onStatusChange) connection.statusListeners.delete(onStatusChange);
		if (connection.subscribers.size === 0 && connection.statusListeners.size === 0) {
			dispose(connection);
			connections.delete(key);
		}
	};
}
