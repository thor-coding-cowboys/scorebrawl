import { DurableObject } from "cloudflare:workers";

export interface SeasonSSEEvent {
	type: "match:insert" | "match:delete" | "standings:update";
	data: unknown;
	user?: {
		id: string;
		name: string;
	};
}

export class SeasonSSE extends DurableObject {
	private sessions: Map<string, ReadableStreamDefaultController> = new Map();
	private alarmScheduled = false;

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === "/broadcast") {
			// Handle broadcast from router
			const event: SeasonSSEEvent = await request.json();
			console.log("[SeasonSSE] Broadcasting to", this.sessions.size, "sessions:", event.type);
			this.broadcast(event);
			return new Response("OK");
		}

		// SSE connection
		const sessionId = crypto.randomUUID();
		let controller: ReadableStreamDefaultController;

		const stream = new ReadableStream({
			start: (ctrl) => {
				controller = ctrl;
				this.sessions.set(sessionId, controller);

				// Send initial connection message
				const data = `data: ${JSON.stringify({ type: "connected", sessionId })}\n\n`;
				controller.enqueue(new TextEncoder().encode(data));

				// Schedule alarm for cleanup
				this.scheduleAlarm();
			},
			cancel: () => {
				this.sessions.delete(sessionId);
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

	broadcast(event: SeasonSSEEvent) {
		const data = `data: ${JSON.stringify(event)}\n\n`;
		const encoded = new TextEncoder().encode(data);

		for (const controller of this.sessions.values()) {
			try {
				controller.enqueue(encoded);
			} catch {
				// Client disconnected, will be cleaned up
			}
		}
	}

	private async scheduleAlarm() {
		if (this.alarmScheduled) return;

		// Clean up if no sessions after 1 minute
		const alarmTime = Date.now() + 60_000;
		await this.ctx.storage.setAlarm(alarmTime);
		this.alarmScheduled = true;
	}

	async alarm() {
		this.alarmScheduled = false;

		// If no active sessions, we can let the DO hibernate
		if (this.sessions.size === 0) {
			// Clear any stored data if needed
			await this.ctx.storage.deleteAll();
		} else {
			// Reschedule if there are still sessions
			this.scheduleAlarm();
		}
	}
}
