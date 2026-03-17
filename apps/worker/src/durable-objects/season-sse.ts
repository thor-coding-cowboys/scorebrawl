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
		| "connected";
	data: unknown;
	user?: {
		id: string;
		name: string;
	};
}

const ALARM_INTERVAL = 10_000; // 10 seconds - hibernate quickly when idle
const CONNECTION_IDLE_TIMEOUT = 5 * 60 * 1000; // 5 minutes idle timeout

interface SessionInfo {
	controller: ReadableStreamDefaultController;
	lastActivity: number;
}

export class SeasonSSE extends DurableObject {
	private sessions: Map<string, SessionInfo> = new Map();
	private alarmScheduled = false;

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === "/broadcast") {
			const event: SeasonSSEEvent = await request.json();
			if (this.sessions.size > 0) {
				const errors = this.broadcast(event);
				if (errors > 0) {
					console.log(
						"[SeasonSSE] Broadcast errors:",
						errors,
						"of",
						this.sessions.size,
						"sessions"
					);
				}
			}
			return new Response("OK");
		}

		// SSE connection
		const sessionId = crypto.randomUUID();
		let controller: ReadableStreamDefaultController;
		const now = Date.now();

		const stream = new ReadableStream({
			start: (ctrl) => {
				controller = ctrl;
				this.sessions.set(sessionId, { controller, lastActivity: now });
				console.log("[SeasonSSE] Connected, total:", this.sessions.size);

				if (this.sessions.size > 50) {
					console.warn("[SeasonSSE] High session count:", this.sessions.size);
				}

				const data = `data: ${JSON.stringify({ type: "connected", sessionId })}\n\n`;
				controller.enqueue(new TextEncoder().encode(data));
				this.scheduleAlarm();
			},
			cancel: () => {
				this.sessions.delete(sessionId);
				console.log("[SeasonSSE] Disconnected, remaining:", this.sessions.size);
				this.scheduleAlarm();
			},
		});

		return new Response(stream, {
			headers: {
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-cache",
				Connection: "keep-alive",
			},
		});
	}

	broadcast(event: SeasonSSEEvent): number {
		const data = `data: ${JSON.stringify(event)}\n\n`;
		const encoded = new TextEncoder().encode(data);
		let errors = 0;
		const now = Date.now();

		for (const [sessionId, sessionInfo] of this.sessions) {
			try {
				sessionInfo.controller.enqueue(encoded);
				sessionInfo.lastActivity = now;
			} catch {
				errors++;
				this.sessions.delete(sessionId);
			}
		}
		return errors;
	}

	private async scheduleAlarm() {
		if (this.alarmScheduled) return;

		const alarmTime = Date.now() + ALARM_INTERVAL;
		await this.ctx.storage.setAlarm(alarmTime);
		this.alarmScheduled = true;
	}

	async alarm() {
		this.alarmScheduled = false;
		const now = Date.now();
		let closedCount = 0;

		// Check for idle connections and close them
		for (const [sessionId, sessionInfo] of this.sessions) {
			if (now - sessionInfo.lastActivity > CONNECTION_IDLE_TIMEOUT) {
				try {
					sessionInfo.controller.close();
				} catch {
					// Controller might already be closed
				}
				this.sessions.delete(sessionId);
				closedCount++;
			}
		}

		if (closedCount > 0) {
			console.log(
				`[SeasonSSE] Closed ${closedCount} idle connections, remaining:`,
				this.sessions.size
			);
		}

		if (this.sessions.size === 0) {
			await this.ctx.storage.deleteAll();
		} else {
			this.scheduleAlarm();
		}
	}
}
