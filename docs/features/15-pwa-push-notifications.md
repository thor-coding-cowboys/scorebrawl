# PWA Install & Push Notifications

## Summary

Make Scorebrawl installable (PWA) and add push notifications so users get alerted when a session/match needs attention even when the tab is closed.

## Why / Goal

Sessions are live and real-time; the killer engagement loop is "your turn / match is live". PWA installability plus push turns a browser tab into something users can keep on their home screen, and push drives re-engagement.

## Scope

- Web app manifest + service worker (offline shell for installability)
- Icon set + theme/color config
- Push subscription storage + send path (uses Web Push API; Cloudflare Workers support)
- Notify on: match recorded, streak milestone, achievement, session started, "you're up" in winner-stays
- Notification click → navigate to the relevant route
- Relies on 01-in-app-notifications for the event/notification source

## Code map

- Vite config + index.html: `apps/web` (manifest/service worker registration)
- Notifications source: see `01-in-app-notifications.md`
- Cloudflare Worker push: `apps/worker/src/index.ts` / a new `routes/push-router.ts`
- Auth already has device/API key infra in `apps/worker/src/db/schema/device-code-schema.ts`

## Acceptance criteria

- App installable via browser (Lighthouse PWA criteria)
- User can opt in to push; subscriptions stored server-side
- Push delivered for configured event types; click routes correctly
- Works in dev and production (VAPID keys configured)

## Open questions / notes

- Depends on 01-in-app-notifications (event plumbing) — sequence after it
- iOS Safari push caveats; scope messaging accordingly
