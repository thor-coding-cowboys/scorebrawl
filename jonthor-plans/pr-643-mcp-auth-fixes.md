# PR #643 MCP Auth Fix Plan

## Critical — Security

### 1. SQL injection in query-builder.ts

- `query-builder.ts:112` — join `on.left`/`on.right` interpolated raw into SQL
- `query-builder.ts:150` — `sql.raw(queryStr)` never binds the `params` array
- **Fix**: Use `sql` tagged template with proper parameter binding. Pass params to `db.all()`. Sanitize all identifiers in ON clauses.

### 2. Auth code race condition (double-spend)

- `mcp-auth-router.ts:40-56` — SELECT then UPDATE not atomic
- **Fix**: Use single UPDATE...RETURNING or UPDATE with WHERE `consumedAt IS NULL` and check affected rows.

### 3. CSRF on mcp-login callback

- `mcp-login/index.tsx` — `callback` query param not validated; attacker can redirect auth code to `https://evil.com`
- **Fix**: Validate callback is `http://localhost:*` or `http://127.0.0.1:*` before redirecting.

### 4. Auth codes stored plaintext

- `mcp-auth-router.ts:23,45` — codes compared as plaintext
- **Fix**: Hash codes before storage (same as tokens). Compare hash on exchange.

## High — Bugs

### 5. Tool name mismatch: `execute_query` vs `query_database`

- `mcp-router.ts:80` registers `execute_query` but `tool-registry.ts:233` defines `query_database`
- **Fix**: Rename executor key to `query_database`.

### 6. Missing leagueId filters — tenant data leak

- `tool-executors.ts` — multiple functions query by season slug or match/session ID without leagueId:
  - `getSeasonStandings` (:175), `getTeamStandings` (:1838), `getFixtures` (:1364), `getSeasonProgress` (:1431), `getSeasonHighlights` (:2381)
  - `getMatchById` (:1307), `getSessionLineup` (:2751)
  - `getTeamStats` (:1880) — empty conditions array possible
- **Fix**: Add `.where(eq(season.leagueId, leagueId))` or equivalent to all affected queries.

### 7. `render_chart` tool has no executor

- Listed in registry but no handler in mcp-router.ts
- **Fix**: Either add executor or remove from registry.

### 8. `query_database` league_id assumption

- `query-builder.ts:117` — assumes all tables have `league_id` column
- **Fix**: Maintain allowlist of tables with `league_id`. Skip the filter for junction tables; instead filter via JOIN to parent.

### 9. `p1Name` fallback bug

- `tool-executors.ts:399-406` — searches `name2Lower` instead of `name1Lower` for p1 guest fallback
- **Fix**: Use `name1Lower`.

## Medium — Design

### 10. MCP auth middleware: 2 queries → 1 JOIN

- `mcp-auth.ts:22-37`
- **Fix**: Single query joining `mcpToken` → `user`.

### 11. No token expiration

- `mcp-schema.ts` — tokens valid forever
- **Fix**: Add `expiresAt` column. Check on auth. Default 90 days.

### 12. No body validation on MCP router

- `mcp-router.ts:121` — `c.req.json()` can throw unhandled
- **Fix**: Add try/catch or use `zValidator("json", schema)`.

### 13. N+1 in `getLeagueRecords`

- `tool-executors.ts:2184-2369` — 6 sequential queries when no recordType specified
- **Fix**: Combine into single query with UNION ALL or parallel Promise.all.

### 14. N+1 in `getComparison`

- `tool-executors.ts:1940-1955` — 3 large overlapping queries
- **Fix**: Share base query data.

### 15. Empty `inArray` in `getSessionStats`

- `tool-executors.ts:920-934` — guard against empty arrays

### 16. Config schema mixing (sessionToken in MCPConfig)

- `auth.ts:23,27` — type-casts to store sessionToken in config file that has different schema
- **Fix**: Separate token storage file or add `sessionToken` to `MCPConfig` type.

## Low

### 17. `NODE_TLS_REJECT_UNAUTHORIZED` global disable

- `util.ts:9` — affects entire process
- **Fix**: Use Node `agent` with custom TLS options per-request, or accept risk for dev only.

### 18. No rate limiting on `/exchange`

- `mcp-auth-router.ts:32`
- **Fix**: Add basic rate limiting (future work acceptable).

### 19. Auth code as primary key

- `mcp-schema.ts:7`
- **Fix**: Use auto ID as PK, index hashed code.
