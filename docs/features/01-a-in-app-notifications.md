# In-App Notifications (Shipped)

## Summary

Real-time toast notifications surfaced via the season SSE stream — match result, match deleted, session started/ended, achievement unlocked.

## Status

Shipped (PR #651): real-time toast notifications via season SSE — match result, match deleted, session started/ended, achievement unlocked.

## Why / Goal

The app already generates rich events (matches, streaks, sessions) via SSE. #651 surfaces them as ephemeral toasts; the inbox makes them durable, so users catch what they missed. It's the foundation for future push/mobile.

## Code map

- Events originate in: `apps/worker/src/trpc/router/match-router.ts`, `session-router.ts`; achievement unlock emitted from the queue consumer in `apps/worker/src/index.ts`
- Event payload builders: `apps/worker/src/services/match-events.ts`, `apps/worker/src/services/achievement-calculation.ts`
- SSE infra: `apps/worker/src/durable-objects/season-sse.ts`, `apps/worker/src/routes/sse-router.ts`
- Frontend hook: `apps/web/src/hooks/use-season-sse.tsx`
- Header/sidebar: `apps/web/src/routes/-components/layout/header.tsx`, `-components/sidebar/*`

## Out of scope

The persistent inbox (bell, unread badge, list, mark-read) is a separate story — see `01-b-in-app-notifications.md`.