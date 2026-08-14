import { DurableObject } from "cloudflare:workers";

export interface SeasonSSEEvent {
	type:
		| "match:insert"
		| "match:delete"
		| "standings:update"
		| "streak"
		| "session:start"
		| "session:end"
		| "session:update"
		| "achievement:unlock"
		| "connected";
	data: unknown;
	user?: {
		id: string;
		name: string;
	};
}

export class SeasonSSE extends DurableObject {
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === "/broadcast") {
			const event: SeasonSSEEvent = await request.json();
			const sockets = this.ctx.getWebSockets();
			if (sockets.length > 0) {
				this.broadcast(event);
			}
			return new Response("OK");
		}

		const pair = new WebSocketPair();
		const [client, server] = Object.values(pair);

		this.ctx.acceptWebSocket(server);

		const sockets = this.ctx.getWebSockets();
		console.log("[SeasonSSE] New WebSocket connected, total:", sockets.length);

		if (sockets.length > 50) {
			console.warn("[SeasonSSE] High session count:", sockets.length);
		}

		server.send(JSON.stringify({ type: "connected" }));

		return new Response(null, { status: 101, webSocket: client });
	}

	broadcast(event: SeasonSSEEvent) {
		const data = JSON.stringify(event);
		let errors = 0;

		for (const ws of this.ctx.getWebSockets()) {
			try {
				ws.send(data);
			} catch {
				errors++;
				try {
					ws.close(1011, "broadcast error");
				} catch {}
			}
		}

		if (errors > 0) {
			console.log(`[SeasonSSE] Broadcast errors: ${errors}`);
		}
	}

	async webSocketMessage(_ws: WebSocket, _message: string | ArrayBuffer) {}

	async webSocketClose(_ws: WebSocket, _code: number, _reason: string, _wasClean: boolean) {
		console.log("[SeasonSSE] Disconnected, remaining:", this.ctx.getWebSockets().length);
	}

	async webSocketError(ws: WebSocket, error: unknown) {
		console.error("[SeasonSSE] WebSocket error:", error);
		try {
			ws.close(1011, "error");
		} catch {}
	}
}
