# Standings realtime (feature 08) — impl plan

Spec: `docs/features/08-standings-realtime-sse.md`. Transport is WebSocket on `SeasonSSE` DO (`/api/sse/:league/:season`), name kept.

## Current state

- Emitted: `match:insert` (match-creation.ts), `match:delete` (match-router.ts, session-actions deleteLastMatch), `session:*`, `streak`, `achievement:unlock`.
- `standings:update` in union, never emitted. Web handler only reacts if `data.standings` set.
- Web `useSeasonSSE` (season `route.tsx`): on others' `match:insert|delete` invalidates standings, top, all, countInfo, latest, fixtures, match lists. OK for dashboard.
- Session `recordResult` emits only `session:update` → web invalidates `getSessionInvalidations` (session, active, player/team standings) + latest. Missing: `seasonPlayer.getTop`, `getAll`, `season.getCountInfo`, `getFixtures`, match lists.
- `match:insert` / `match:remove` compute full `getStanding` per write only for payload; clients ignore it and refetch. Wasted DB query on hot path.
- Mobile: only `useSessionRealtime` inside session screen. No season-level realtime → mobile dashboard (`season-standings`, `season-team-standings`, `latest-matches`, `dashboard-cards`, matches list) never updates live.
- Event types duplicated: worker `SeasonSSEEvent`, web `use-season-sse.tsx`, mobile `SeasonRealtimeEvent`. `broadcastSeasonEvent` takes `type: string`.
- No worker tests for broadcasts.

## Decision

Signal + refetch (spec recommendation). `standings:update` = lightweight invalidation signal, payload `{ reason, matchId?, sessionId? }`. Drop standings snapshot from `match:*`.

## Steps

1. Shared types — `packages/client/src/realtime/event-types.ts`: `SeasonRealtimeEvent` discriminated union (all types + payloads). Worker `SeasonSSEEvent` + `broadcastSeasonEvent` typed from it (move to `packages/core` if worker cannot import client pkg). Web + mobile consume it.
2. Shared invalidations — `getSeasonInvalidations(trpc, { seasonSlug })` in `invalidations.ts`: player/team standing, top, all, countInfo, latest, fixtures, `match.getAll`. Spec test next to `invalidations.spec.ts`. Web `reconcile` + match handler use it.
3. Worker emit — helper `broadcastStandingsUpdate(ctx, seasonSlug, data)` in `sse-router.ts`. Call after: `finalizeMatchCreation`, `match.remove`, session `recordResult`, `deleteLastMatch`, match edit/update procedures that change result/score (audit `match-router.ts` + `matches-v1.ts` REST). Live score updates (`session:score-update`) do NOT emit (no standings change).
4. Worker trim — remove `getStanding` call + `standings` field from `buildMatchInsertData` / `match:delete` payload. Check no consumer reads `data.standings` (web types `MatchData.standings`, mobile).
5. Web — `standings:update` → `getSeasonInvalidations` for all events incl. own (cheap, idempotent; replaces scattered own-mutation invalidations only if safe). Keep `match:*` for toasts + match lists only. Infinite match list keys `["infinite-matches", id]` stay.
6. Mobile — new `useSeasonRealtime({ leagueSlug, seasonSlug })` hook, one socket per season screen (`seasons/[seasonSlug]/index.tsx` + `matches.tsx`). Refactor `useSessionRealtime` to share connect/reconnect/AppState logic (`createSeasonSocket` util) so session screen does not open a second socket. On `standings:update` / `match:*` → `getSeasonInvalidations`. Reconnect → reconcile.
7. Tests — worker vitest (`apps/worker/test/`): stub/spy `SEASON_SSE` broadcast, assert `standings:update` after match create, remove, session recordResult, deleteLastMatch. Client spec for `getSeasonInvalidations`.
8. Docs — move `08-standings-realtime-sse.md` to `docs/features/done/`, note signal design.

## Acceptance check

- Web dashboard + session page: other user records match / session result / delete → table updates, no reload.
- Mobile dashboard + session standings tab: same.
- One `getStanding` query per write removed.
- `bun check && bun run test` green.

## Done in this pass

- Mobile score flicker (`next-match-tab.tsx`): own `session:score-update` echoes of older debounced values overwrote newer local taps. Now SSE scores ignored while a sync is in flight and for 1000 ms after last tap / sync settle. Not filtered by user id, so Garmin / web updates from same account still apply.

## Open questions

- Web live score (`manual-session.tsx`, `winner-stays-session.tsx`) has same 500 ms guard → same flicker risk. Apply same fix (ideally inside `useScoreSync` so both apps share it)?
- Remote score update dropped during grace window is not replayed. Acceptable, or stash last ignored update and apply after grace?
- Emit `standings:update` also from REST public API match endpoints (`matches-v1.ts`)? Plan assumes yes, via shared `finalizeMatchCreation`.
