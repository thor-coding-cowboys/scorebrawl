# PR 627: DO SSE Optimization Fixes

Branch: `fix/do-sse-optimization`

## Critical: Add `waitUntil` to fire-and-forget broadcasts

`void stub.fetch()` without `waitUntil` — runtime can kill isolate before DO fetch completes, silently dropping broadcasts.

### Steps

1. Update `broadcastSeasonEvent` signature in `apps/worker/src/routes/sse-router.ts` to accept `waitUntil: (p: Promise<unknown>) => void`
2. Wrap `stub.fetch(...)` in `waitUntil(...)` instead of `void`
3. Update all call sites:
   - `apps/worker/src/trpc/router/session-router.ts` — 11 calls, pass `ctx.waitUntil`
   - `apps/worker/src/trpc/router/match-router.ts` — 3 calls, pass `ctx.waitUntil`
   - `apps/worker/src/routes/device-router.ts` — 3 calls, pass `c.executionCtx.waitUntil.bind(c.executionCtx)`

## Minor: Remove stale `await` keywords

`broadcastSeasonEvent` returns `void` now. 16 call sites still `await` it — misleading dead code.

### Steps

1. Remove `await` from all `broadcastSeasonEvent` calls in:
   - `session-router.ts`: lines 78, 166, 186, 242, 267, 441, 587, 610, 657, 684, 690
   - `device-router.ts`: lines 345, 509, 681
   - `match-router.ts`: lines 169, 287

## Nit: Remove redundant comments

Per repo conventions, no redundant comments.

- `season-sse.ts:119` — `// Check for idle connections and close them`
- `season-sse.ts:123` — `// Controller might already be closed`
- `sse-router.ts:25` — `// Fire-and-forget: don't await the response...`
- `sse-router.ts:34` — `// Silently ignore errors - SSE is best-effort`

## Verification

```bash
bun typecheck
bun oxc
bun run test
```
