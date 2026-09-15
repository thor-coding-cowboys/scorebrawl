# WebSocket Hibernation API Migration

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace SSE-over-ReadableStream with WebSocket Hibernation API so the DO sleeps between broadcasts, eliminating duration quota burn.

**Architecture:** Client opens a WebSocket to the DO via Hono route. DO accepts with `this.ctx.acceptWebSocket(server)`, enabling hibernation. Broadcasts iterate `this.ctx.getWebSockets()` — no manual session tracking needed. The runtime manages connections and wakes the DO only on incoming messages or alarms.

**Tech Stack:** Cloudflare Durable Objects (Hibernation WebSocket API), Hono, React (native WebSocket)

---

### Task 1: Rewrite the Durable Object

**Files:**

- Modify: `apps/worker/src/durable-objects/season-sse.ts`

**Step 1: Replace the entire DO class**

```typescript
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
		console.log("[SeasonSSE] Connected, total:", sockets.length);

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
			console.log("[SeasonSSE] Broadcast errors:", errors);
		}
	}

	async webSocketClose(ws: WebSocket, code: number, reason: string) {
		console.log("[SeasonSSE] Disconnected, remaining:", this.ctx.getWebSockets().length);
		ws.close(code, reason);
	}

	async webSocketError(ws: WebSocket, error: unknown) {
		console.log("[SeasonSSE] WebSocket error:", error);
		try {
			ws.close(1011, "error");
		} catch {}
	}
}
```

Key changes vs current:

- No `sessions` Map, no `SessionInfo`, no `lastActivity` tracking
- No alarm scheduling, no idle timeout logic — hibernation handles all of this
- `this.ctx.acceptWebSocket(server)` enables hibernation
- `this.ctx.getWebSockets()` replaces manual session tracking
- `webSocketClose` and `webSocketError` are hibernation event handlers
- Messages are plain JSON strings, not SSE-formatted (`data: ...\n\n`)

**Step 2: Verify types compile**

Run: `bun typecheck`

**Step 3: Commit**

```
feat: rewrite SeasonSSE DO with WebSocket Hibernation API
```

---

### Task 2: Update the Hono SSE router for WebSocket upgrade

**Files:**

- Modify: `apps/worker/src/routes/sse-router.ts`

**Step 1: Update the connect route to forward the Upgrade header**

```typescript
import { Hono } from "hono";
import type { HonoEnv } from "../middleware/context";

export const sseRouter = new Hono<HonoEnv>().get("/:leagueSlug/:seasonSlug", async (c) => {
	const upgradeHeader = c.req.header("Upgrade");
	if (upgradeHeader !== "websocket") {
		return c.text("Expected WebSocket upgrade", 426);
	}

	const { leagueSlug, seasonSlug } = c.req.param();
	const doId = c.env.SEASON_SSE.idFromName(`${leagueSlug}/${seasonSlug}`);
	const stub = c.env.SEASON_SSE.get(doId);

	const url = new URL(c.req.url);
	url.pathname = "/connect";

	return stub.fetch(new Request(url.toString(), { headers: c.req.raw.headers }));
});

export function broadcastSeasonEvent(
	env: Pick<Env, "SEASON_SSE">,
	leagueSlug: string,
	seasonSlug: string,
	event: { type: string; data: unknown; user?: { id: string; name: string } }
): void {
	const doId = env.SEASON_SSE.idFromName(`${leagueSlug}/${seasonSlug}`);
	const stub = env.SEASON_SSE.get(doId);

	void stub
		.fetch(
			new Request("https://internal/broadcast", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(event),
			})
		)
		.catch(() => {});
}
```

Changes:

- Validate `Upgrade: websocket` header, return 426 if missing
- `broadcastSeasonEvent` stays fire-and-forget (same as PR 627) — the DO wakes momentarily to broadcast, then re-hibernates
- Note: the `void` without `waitUntil` issue from PR 627 still applies here. Consider passing `waitUntil` if broadcasts are dropped. But with hibernation the DO handles it independently, so this is less critical than before.

**Step 2: Verify types compile**

Run: `bun typecheck`

**Step 3: Commit**

```
feat: update SSE router to proxy WebSocket upgrade
```

---

### Task 3: Rewrite the client hook

**Files:**

- Modify: `apps/web/src/hooks/use-season-sse.ts`

**Step 1: Replace EventSource with WebSocket**

The key changes in the hook:

- Replace `new EventSource(url)` with `new WebSocket(wsUrl)`
- Build WebSocket URL: convert `http(s)://` to `ws(s)://`, same path `/api/sse/{league}/{season}`
- `ws.onmessage` handler stays identical (parse JSON, dispatch events, invalidate queries)
- `ws.onclose` replaces `eventSource.onerror` for reconnection
- `ws.onerror` can be a no-op (onclose fires after onerror anyway)
- Remove SSE-specific data format parsing — messages arrive as plain JSON, not `data: {...}\n\n`
- Ref name: `eventSourceRef` → `wsRef` (type `WebSocket | null`)

Specific changes in the `connect` function:

```typescript
const connect = () => {
	if (!enabledRef.current || !isMounted) return;

	const { leagueSlug, seasonSlug, seasonId, currentUserId } = paramsRef.current;
	const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
	const wsUrl = `${protocol}//${window.location.host}/api/sse/${leagueSlug}/${seasonSlug}`;
	const ws = new WebSocket(wsUrl);
	wsRef.current = ws;

	ws.onmessage = (event) => {
		try {
			const parsed: SeasonSSEEvent = JSON.parse(event.data);
			// ... rest of event handling is IDENTICAL to current code ...
		} catch (error) {
			console.error("[WS] Failed to parse event:", error);
		}
	};

	ws.onclose = () => {
		wsRef.current = null;
		if (isMounted) {
			reconnectTimeoutRef.current = setTimeout(connect, 3000);
		}
	};
};
```

The `onmessage` handler body is copy-paste identical to the current EventSource handler (lines 101-195 of current file). The only difference is that `event.data` is already a plain JSON string — no SSE framing to deal with. EventSource also delivered plain JSON via `event.data`, so the parsing code (`JSON.parse(event.data)`) stays the same.

Cleanup function:

```typescript
return () => {
	isMounted = false;
	if (reconnectTimeoutRef.current) {
		clearTimeout(reconnectTimeoutRef.current);
	}
	if (wsRef.current) {
		wsRef.current.close();
	}
};
```

**Step 2: Verify types compile**

Run: `bun typecheck`

**Step 3: Commit**

```
feat: switch client SSE hook to WebSocket
```

---

### Task 4: Clean up stale `await` on `broadcastSeasonEvent` calls

**Files:**

- Modify: `apps/worker/src/trpc/router/session-router.ts` (11 occurrences)
- Modify: `apps/worker/src/trpc/router/match-router.ts` (2 occurrences)
- Modify: `apps/worker/src/routes/device-router.ts` (3 occurrences)

**Step 1: Remove `await` from all `broadcastSeasonEvent` calls**

`broadcastSeasonEvent` returns `void`. Remove the `await` keyword from all 16 call sites. Simple find-and-replace: `await broadcastSeasonEvent(` → `broadcastSeasonEvent(`.

**Step 2: Verify types compile**

Run: `bun typecheck`

**Step 3: Commit**

```
chore: remove stale await on fire-and-forget broadcastSeasonEvent
```

---

### Task 5: Lint, format, test

**Step 1: Run full checks**

```bash
bun oxc
bun typecheck
bun run test
```

**Step 2: Fix any failures**

**Step 3: Commit fixes if needed**

---

### Task 6: Manual verification

**Step 1: Start dev server**

```bash
bun dev
```

**Step 2: Open browser to `http://scorebrawl.localhost:1355`**

Log in as `seed@scorebrawl.com`. Navigate to a season page. Use browser DevTools Network tab → WS filter to confirm WebSocket connection established (not SSE).

**Step 3: Verify real-time events**

Open two browser tabs on the same season. Register a match in one tab. Confirm:

- Match appears in the other tab
- Toast notification shows
- Standings update

**Step 4: Verify reconnection**

In DevTools, close the WebSocket connection manually. Confirm it reconnects within ~3 seconds.

---

## Files changed summary

| File                                            | Change                           |
| ----------------------------------------------- | -------------------------------- |
| `apps/worker/src/durable-objects/season-sse.ts` | Full rewrite — Hibernation API   |
| `apps/worker/src/routes/sse-router.ts`          | Add WebSocket upgrade validation |
| `apps/web/src/hooks/use-season-sse.ts`          | EventSource → WebSocket          |
| `apps/worker/src/trpc/router/session-router.ts` | Remove 11 stale `await`          |
| `apps/worker/src/trpc/router/match-router.ts`   | Remove 2 stale `await`           |
| `apps/worker/src/routes/device-router.ts`       | Remove 3 stale `await`           |
| `apps/worker/wrangler.jsonc`                    | No changes needed                |

## No config changes needed

- Wrangler bindings stay the same (`SEASON_SSE` / `SeasonSSE`)
- No new migration needed — same DO class name, same SQLite storage
- Hibernation is opt-in at the code level via `this.ctx.acceptWebSocket()`

## Unresolved questions

1. **`broadcastSeasonEvent` fire-and-forget reliability** — `void stub.fetch()` without `waitUntil` can still drop broadcasts if the worker isolate terminates before the fetch reaches the DO. With hibernation the DO wakes independently, but the initiating fetch could still be cancelled. Worth adding `waitUntil` for reliability? This adds `executionCtx` plumbing to all 16+ call sites.
2. **Rename `sseRouter` / `SEASON_SSE`?** — The naming references SSE but we're using WebSocket now. Cosmetic but potentially confusing. Renaming `SEASON_SSE` requires a DO migration. Probably not worth it — just rename the router and keep the binding name.
