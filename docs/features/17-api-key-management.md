# API Key Management UI

## Summary

Provide a UI to create and manage API keys. The better-auth admin plugin and `apikey` table exist; there is no user-facing key management surface.

## Why / Goal

Programmatic access (scripts, integrations, the MCP client) needs scoped credentials. Today keys can't be created/managed without admin plumbing. A self-service key UI enables integrations and power users.

## Scope

- Profile/league settings page: create API key with permissions + expiry
- List, revoke, and delete keys
- Show the key once at creation (copy to clipboard)
- Scope keys to a league/org where applicable
- Rate-limit display (better-auth tracks usage)

## Code map

- Table: `apps/worker/src/db/schema/auth-schema.ts` (`apikey` with rate limiting + permissions)
- Plugin wiring: `apps/worker/src/lib/better-auth.ts` (admin plugin)
- Profile page: `apps/web/src/routes/_authenticated/_sidebar/profile.tsx`
- MCP client auth reference: `packages/mcp`

## Acceptance criteria

- User can create, copy, list, revoke, and delete API keys
- Keys carry permission scopes that are enforced server-side
- Key creation is surfaced in a settings section (not admin-only)

## Open questions / notes

- Key storage/serialization handled by better-auth admin plugin; confirm exact API before wiring UI
- Whether keys should be admin-created only for now (scoped to admins) vs all users
