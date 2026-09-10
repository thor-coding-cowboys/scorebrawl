# In-App Notifications (Remaining)

## Summary

A notification inbox so users see streaks, new matches, achievements, and session events without having to poll every page.

## Status

Not implemented. The real-time toast layer is shipped (see `done/01-a-in-app-notifications.md`); the persistent inbox (bell, unread badge, list, mark-read) is remaining.

## Remaining scope

- New `notification` table (recipient, type, actor, payload JSON, read flag, created_at)
- Persist a notification where events already fire and toast (match create/remove, session start/end, achievements) — reuse the event payloads built in `match-events.ts` / `achievement-calculation.ts`
- Notification router (list, mark-read, unread count, mark-all-read)
- Notification bell in the app header (sidebar) with unread badge
- Notification dropdown + full list page
- Live unread-count updates via the existing SSE/WebSocket infra

## Code map

- Events originate in: `apps/worker/src/trpc/router/match-router.ts`, `session-router.ts`; achievement unlock emitted from the queue consumer in `apps/worker/src/index.ts`
- Event payload builders: `apps/worker/src/services/match-events.ts`, `apps/worker/src/services/achievement-calculation.ts`
- SSE infra: `apps/worker/src/durable-objects/season-sse.ts`, `apps/worker/src/routes/sse-router.ts`
- Frontend hook: `apps/web/src/hooks/use-season-sse.tsx`
- Header/sidebar: `apps/web/src/routes/-components/layout/header.tsx`, `-components/sidebar/*`

## Acceptance criteria

- Bell shows unread count; badge updates live via SSE
- Clicking a notification navigates to the relevant entity (match/session/achievement)
- Mark single / mark all read
- Notifications persisted for: new match, streak milestone, achievement earned, session started/ended

## Open questions / notes

- Scope of notifications per season vs per league vs global
- Should SSO/email notifications be added later (not in this story)
- Deletion/retention policy for notifications
