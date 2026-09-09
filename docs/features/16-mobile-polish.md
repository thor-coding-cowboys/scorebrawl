# Mobile-First Polish Pass

## Summary

Audit and improve the mobile experience. The session dialog already has mobile step-based navigation; other primary flows are desktop-first.

## Why / Goal

Live sessions happen around a physical table/office with phones. If match recording and session management work well on mobile, the app is usable in the moment it matters most.

## Scope

- Mobile audit of primary flows: session, match entry, standings, player profiles
- Fix touch targets, horizontal scroll, responsive tables (standings), sheet/drawer usage on small screens
- Confirm match creation + session "start match" flows are fully usable on mobile
- Test on a phone-size viewport (agent-browser device emulation)

## Code map

- Mobile handling reference: `apps/web/src/routes/_authenticated/_sidebar/leagues/$slug/seasons/$seasonSlug/session/$sessionId/-components/winner-stays/winner-stays-session.tsx` and the start-session dialog (step layout)
- Standings table: `-components/season/standing.tsx` / `session-standings.tsx`
- UI primitives: `apps/web/src/routes/-components/ui/*` (Drawer, Sheet already exist)

## Acceptance criteria

- Match entry and session controls are usable on a phone viewport
- No horizontal page scroll on core pages
- Standings readable on mobile (scroll/collapse pattern)
- Verified via device-emulated browser

## Open questions / notes

- Run as a bug-hunt + fixes pass rather than a redesign; gather a concrete list first
