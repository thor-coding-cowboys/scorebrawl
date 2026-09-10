# MCP Server OAuth (replace session auth with better-auth `mcp()`)

## Status

Not started.

## Summary

The MCP server (`POST /api/mcp`) currently authenticates clients with a better-auth **session cookie** (`mcp-router.ts` calls `getSession`). That works for a browser but not for real MCP clients (Claude Desktop, Cursor, IDE agents, CLI tools), which can't hold a session cookie. Replace it with the better-auth **MCP plugin** (`@better-auth/mcp`): ScoreBrawl's auth server becomes an OAuth authorization server + protected resource for MCP clients, using the standard MCP OAuth flow (discovery → authorization code + PKCE → resource-bound access tokens).

**Sequencing:** this builds on the OAuth provider server (feature 19). Build 19 first, then this.

## Why / Goal

MCP clients authenticate via OAuth against a discovery endpoint and protected-resource metadata. Today our hand-rolled MCP endpoint is unusable from those clients. Moving to `@better-auth/mcp` gives us: RFC 9728 protected-resource metadata, RFC 8414 discovery, PKCE authorization, resource-bound access tokens (`aud` = the MCP resource), DPoP, and per-scope `insufficient_scope` challenges — all maintained by Better Auth instead of our own session handshake.

## Approach

1. **Install** `@better-auth/mcp`, `@better-auth/cimd`, the official MCP TypeScript SDK v2 (`@modelcontextprotocol/server`), and `zod`. The JWT plugin is required (stable signing key + `/jwks`).
2. **Auth config** (`apps/worker/src/lib/better-auth.ts`): add `jwt()`, `mcp({ loginPage: "/auth/sign-in", consentPage: "/consent", resource: <mcp-resource-url>, scopes: [...] })`, and `cimd({ fetchClientMetadataResource, metadataProfile: "mcp-2026-07-28" })` with a Workers-compatible transport (resolve hostname once, reject RFC 6890 special-use addresses, pin address, refuse redirects). Do NOT register a separate `oauthProvider()` — `mcp()` is the OAuth provider.
3. **Dynamic client registration (DCR)**: enable `allowDynamicClientRegistration: true` and `allowUnauthenticatedClientRegistration: true` on `mcp()` so MCP clients can self-register (docs note MCP deprecates DCR, but we explicitly want it). The `mcp()` resource is added as a default registration resource.
4. **Re-implement the MCP endpoint** with the SDK: build an `McpServer` (SDK v2), register the existing tools from `apps/worker/src/services/mcp-tools/tool-registry.ts`, wrap the POST handler with `requireMcpAuth(auth, handler, { resource, requiredScopes })`. `requireMcpAuth` verifies the access token locally against JWKS (signature, issuer, aud, expiry, DPoP), returns JSON-RPC `401` + RFC 9728 `WWW-Authenticate` for unauthenticated requests, and `403` + `insufficient_scope` when a required scope is missing.
5. **Replace** the current `/api/mcp` route (drop the `getSession` hand-rolled handler once migrated; keep the route path `/api/mcp` for compatibility).
6. **Schema/migrations**: run `bun db:generate` + `bun db:migrate` for the OAuth tables (`oauthClient`, `oauthAccessToken`, `oauthRefreshToken`, `oauthConsent`, `oauthClientAssertion`).

## Current state (to be replaced)

- `apps/worker/src/routes/mcp-router.ts` — hand-rolled JSON-RPC over Hono POST `/api/mcp`; auth via `betterAuth.api.getSession` (session cookie); requires an active league set on the session.
- `apps/worker/src/services/mcp-tools/tool-registry.ts` — tool metadata (name, description, parameters).
- `apps/worker/src/services/mcp-tools/tool-executors.ts` — ~40 read-only executors scoped to `leagueId` (active org).

## Code map

- `apps/worker/src/lib/better-auth.ts` — add `jwt()`, `mcp()`, `cimd()`; DCR flags; consent/login page wiring
- `apps/worker/src/routes/mcp-router.ts` — rewrite with SDK v2 + `requireMcpAuth`
- `apps/worker/src/services/mcp-tools/tool-registry.ts` / `tool-executors.ts` — adapt to SDK `registerTool` (zod input schemas)
- `apps/web/src/routes/consent` — new OAuth/MCP consent page (matching `mcp({ consentPage: "/consent" })`)
- `apps/worker/src/db/schema/` — OAuth tables via migration

## Acceptance criteria

- An MCP client (e.g. Claude Desktop / a test SDK v2 client) discovers ScoreBrawl's authorization server from protected-resource metadata, completes authorization code + PKCE, and receives a resource-bound access token.
- `POST /api/mcp` rejects unauthenticated requests with JSON-RPC `401` + `WWW-Authenticate`; rejects tokens missing the required scope with `403 insufficient_scope`.
- Existing tools still work through the SDK handler (parity with the current tool registry).
- DCR works: a client can register dynamically and immediately use the MCP resource.
- CIMD (`mcp-2026-07-28`) discovery advertises `client_id_metadata_document_supported`; SDK pinned to `2026-07-28`, `legacy: "reject"`.
- Integration tests (Vitest): discovery metadata, authorization code flow, token verification via JWKS, scope enforcement, DCR registration.

## Open questions

- Verify `@better-auth/mcp` / `@better-auth/cimd` compatibility with the pinned better-auth catalog version (1.7.2); may need a bump.
- `resource` value: `https://api.scorebrawl.com/api/mcp` (must be an HTTPS URL, no query/fragment).
- Scopes for MCP tools: coarse `mcp:tools` vs per-tool scopes; keep `query_database`/`render_chart` restrictions (CLIENT_ONLY_TOOLS).
- Keep a legacy session-cookie path for the in-app MCP UI, or migrate fully to OAuth?
- Consent page UX: reuse device-flow consent styling (`/device`) or build a dedicated `/consent` page.
- DCR trust model: fully open registration (docs note MCP deprecates DCR) vs shared registration secret.
