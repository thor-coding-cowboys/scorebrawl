# In-App Notifications

## Summary

A notification inbox so users see streaks, new matches, achievements, and session events without having to poll every page.

## Why / Goal

The app already generates rich events (matches, streaks, sessions) via SSE but nothing surfaces them to the user. Notifications are the highest-leverage retention feature and the foundation for future push/mobile.

## Scope

- New `notification` table (recipient, type, actor, payload JSON, read flag, created_at)
- Notification creation hooks where events already fire (match create/remove, streak thresholds, session start/end, achievements)
- Notification router (list, mark-read, unread count, mark-all-read)
- Notification bell in the app header (sidebar) with unread badge
- Notification dropdown + full list page
- Live updates via the existing SSE/WebSocket infra

## Code map

- Events originate in: `apps/worker/src/trpc/router/match-router.ts`, `session-router.ts`
- SSE infra: `apps/worker/src/durable-objects/season-sse.ts`, `apps/worker/src/routes/sse-router.ts`
- Frontend hooks: `apps/web/src/hooks/use-session-sse.ts`
- Header/sidebar: `apps/web/src/routes/-components/layout/header.tsx`, `-components/sidebar/*`

## Acceptance criteria

- Bell shows unread count; badge updates live via SSE
- Clicking a notification navigates to the relevant entity (match/session/achievement)
- Mark single / mark all read
- Notifications generated for: new match, streak milestone, achievement earned, session started/ended

## Open questions / notes

- Scope of notifications per season vs per league vs global
- Should SSO/email notifications be added later (not in this story)
- Deletion/retention policy for notifications
