# Admin: User Ban & Impersonation

## Summary

Implement platform-admin user banning and session impersonation. The schema (banned/banReason/banExpires, impersonatedBy) and auth plugin support already exist; admin stats hardcode `bannedUsers: 0`.

## Why / Goal

As the app grows, admins need moderation tools (ban abusive users, inspect accounts). Banning is schema-ready and cheap to finish; impersonation gives support a way to debug user-reported issues.

## Scope

- Ban/unban user with optional reason + expiry from the admin users page
- Ban enforcement at auth/session level (blocked sign-in, revoked sessions)
- Surface real `bannedUsers` count in admin stats
- Impersonate a user (session with `impersonatedBy`) with a clear "viewing as" banner
- Audit trail of ban/impersonation actions

## Code map

- Schema: `apps/worker/src/db/schema/auth-schema.ts` (banned fields, `impersonatedBy`)
- Hardcoded value: `apps/worker/src/trpc/router/admin-router.ts` (`bannedUsers: 0`)
- better-auth admin plugin already configured in `apps/worker/src/lib/better-auth.ts`
- Admin UI: `apps/web/src/routes/_authenticated/admin/users/-components/admin-users-page.tsx`

## Acceptance criteria

- Admin can ban/unban a user with reason + expiry; banned user cannot sign in
- Admin stats show a real banned-user count
- Impersonation works with an obvious banner and safe exit
- Actions are logged

## Open questions / notes

- Does better-auth ban enforcement require a hook, or is it built into the admin plugin? Verify with better-auth docs before implementing.
- Impersonation permissions: admin role only
