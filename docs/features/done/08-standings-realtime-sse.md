# Real-Time Standings via SSE

## Status

Done (#746): `standings:update` is emitted as a lightweight invalidation signal (no standings snapshot) after match create/remove and session record/delete-last-match. Web and mobile invalidate `getSeasonInvalidations`; the season dashboard, matches list and session standings update without a reload.

## Summary

Emit the `standings:update` SSE event so standings refresh live without manual reload.

## Why / Goal

Match insert/delete already broadcasts via SSE, but standings are computed separately and don't push. Two users in a session or an office league watching a match expect the table to update in real time. Small change, big perceived responsiveness.

## Scope

- Emit `standings:update` after match create / remove / session recordResult / delete-last-match
- Frontend: subscribe to the event and invalidate the standings query
- Lightweight signal + refetch; no standings snapshot in the payload

## Implementation

- Signal payload: `{ reason, matchId?, sessionId? }` (`SeasonStandingsUpdateData`)
- Emits: `finalizeMatchCreation` (tRPC create, fixtures, 1-v-n, public REST), `match.remove`, session `recordResult` and `deleteLastMatch`. Live score updates and `cancelMatch` do not change ratings, so they do not emit
- The write path no longer computes `getStanding`; `match:insert` / `match:delete` carry no `standings`
- Shared event union: `packages/core/src/realtime` (re-exported by `packages/client/realtime`)
- Shared invalidation set: `getSeasonInvalidations` in `packages/client/src/realtime/invalidations.ts`

## Code map

- Event type + DO: `packages/core/src/realtime/index.ts`, `apps/worker/src/durable-objects/season-sse.ts`
- Broadcast helper: `apps/worker/src/routes/sse-router.ts` (`broadcastStandingsUpdate`)
- Broadcast sites: `apps/worker/src/services/match-creation.ts`, `apps/worker/src/trpc/router/match-router.ts`, `apps/worker/src/services/session/session-actions.ts`
- Web hook: `apps/web/src/hooks/use-season-sse.tsx`
- Mobile hooks: `apps/mobile/src/hooks/use-season-realtime.ts`, `apps/mobile/src/hooks/use-session-realtime.ts`, shared socket `apps/mobile/src/lib/season-socket.ts`
- Tests: `apps/worker/test/routes/season-sse.spec.ts`, `packages/client/src/realtime/invalidations.spec.ts`

## Acceptance criteria

- Standings table on season dashboard + session page updates live when a match is recorded
- No page reload needed
- Match removal also refreshes standings
- No N+1: event is lightweight and clients refetch through the shared invalidation set
- Mobile dashboard and session standings update live from the same season socket

## Open questions / notes

- Resolved: signal + refetch chosen over a computed standings snapshot, removing one `getStanding` query per write
- Match score updates that do not change a recorded result are intentionally not broadcast as standings changes
