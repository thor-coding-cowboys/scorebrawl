# Real-Time Standings via SSE

## Summary

Emit the `standings:update` SSE event (declared in the event type but never sent) so standings refresh live without manual reload.

## Why / Goal

Match insert/delete already broadcasts via SSE, but standings are computed separately and don't push. Two users in a session or an office league watching a match expect the table to update in real time. Small change, big perceived responsiveness.

## Scope

- Emit `standings:update` after match create / remove / session recordResult (and match score updates)
- Frontend: subscribe to the event and invalidate the standings query
- Optionally include the computed standings payload in the event to avoid a refetch

## Code map

- Event type: `apps/worker/src/durable-objects/season-sse.ts` (`SeasonSSEEvent`, `standings:update` already in union, never emitted)
- Broadcast sites: `apps/worker/src/trpc/router/match-router.ts`, `session-router.ts`
- Frontend hooks: `apps/web/src/hooks/use-session-sse.ts` (+ a season-level SSE hook)

## Acceptance criteria

- Standings table on season dashboard + session page updates live when a match is recorded
- No page reload needed
- Match removal also refreshes standings
- No N+1: event is either lightweight or carries a single precomputed standings snapshot

## Open questions / notes

- Payload design: send computed standings vs just an invalidation signal (recommend signal + refetch for simplicity)
