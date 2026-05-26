# Scorebrawl MCP Server Design

**Date:** 2026-05-26
**Status:** Approved

## 1. Overview

Provide a local MCP (Model Context Protocol) server so users can connect their own agent harness (Claude Code, OpenCode, etc.) directly to their Scorebrawl database for read-only league data queries.

The MCP server reuses the existing "Ask AI" tool harness (`tool-registry.ts`, `tool-executors.ts`) with zero duplication of business logic or tool definitions.

## 2. Architecture

```
┌─────────────────┐     stdio (JSON-RPC)     ┌─────────────────────┐
│  Claude Code /  │◄────────────────────────►│  @scorebrawl/mcp    │
│  OpenCode / ... │                          │  CLI (local Node)   │
└─────────────────┘                          └──────────┬──────────┘
                                                        │ HTTPS
                                                        ▼
                                               ┌─────────────────────┐
                                               │  /mcp Hono route    │
                                               │  on Cloudflare      │
                                               │  Worker             │
                                               └──────────┬──────────┘
                                                          │
                                               ┌──────────▼──────────┐
                                               │  Existing tRPC      │
                                               │  context + DB       │
                                               │  (tool-executors)   │
                                               └─────────────────────┘
```

## 3. MCP Protocol & Transport

- **Transport:** stdio (stdin/stdout JSON-RPC 2.0)
- **Methods handled by CLI:**
  - `initialize` — protocol version negotiation (MCP 2024-11-05)
  - `tools/list` — proxied to worker, returns all read-only data tools
  - `tools/call` — proxied to worker, executes tool and returns result
  - `notifications/initialized` — no-op

## 4. Authentication Flow

1. User runs: `npx @scorebrawl/mcp login`
2. CLI starts a temporary localhost HTTP server on a random port
3. CLI opens browser: `https://scorebrawl.localhost:1355/auth/mcp-login?callback=http://localhost:<port>/callback`
4. User authenticates via better-auth in browser
5. Browser redirects to localhost callback with session token
6. CLI stores token in OS keychain (via `keytar`) with a `keytar` fallback to `~/.config/scorebrawl/mcp.json`
7. All subsequent MCP requests include: `Authorization: Bearer <token>`

If no token exists or token is expired, the CLI exits with a clear message: `Run "npx @scorebrawl/mcp login" to authenticate.`

## 5. Backend `/mcp` Endpoint

New Hono route: `apps/worker/src/routes/mcp.ts`

- `POST /mcp` with JSON-RPC body
- Validates `Authorization` header via existing better-auth session validation (same middleware as `protectedProcedure`)
- Extracts `activeOrganizationId` from session (same as `activeOrgProcedure`)
- **tools/list**: returns tools from `tool-registry.ts` (the same ~30 read-only tools Ask AI uses)
- **tools/call**: dispatches to `tool-executors.ts` functions using the same DB context, organization scoping, and result summarization

No new tool logic. The MCP server reuses the exact same tool registry and executors.

## 6. Tool Mapping

Each existing tool maps 1:1 to an MCP tool:

| MCP Tool Name | Existing Executor |
|---------------|-------------------|
| `get_players` | `getPlayers` |
| `get_matches` | `getMatches` |
| `get_season_standings` | `getSeasonStandings` |
| `get_player_stats` | `getPlayerStats` |
| `get_head_to_head` | `getHeadToHead` |
| `get_scoring_stats` | `getScoringStats` |
| `get_streaks` | `getStreaks` |
| `get_elo_progression` | `getEloProgression` |
| `get_form_guide` | `getFormGuide` |
| `get_team_chemistry` | `getTeamChemistry` |
| `get_session_stats` | `getSessionStats` |
| `get_biggest_margins` | `getBiggestMargins` |
| `get_closest_matches` | `getClosestMatches` |
| `get_upsets` | `getUpsets` |
| `get_recent_matches` | `getRecentMatches` |
| `get_match_by_id` | `getMatchById` |
| `get_fixtures` | `getFixtures` |
| `get_season_progress` | `getSeasonProgress` |
| `get_achievements` | `getAchievements` |
| `get_unbeaten_runs` | `getUnbeatenRuns` |
| `get_most_improved` | `getMostImproved` |
| `get_player_activity` | `getPlayerActivity` |
| `get_player_peak` | `getPlayerPeak` |
| `get_team_standings` | `getTeamStandings` |
| `get_team_stats` | `getTeamStats` |
| `get_comparison` | `getComparison` |
| `get_win_probability` | `getWinProbability` |
| `get_rivalries` | `getRivalries` |
| `get_league_records` | `getLeagueRecords` |
| `get_season_highlights` | `getSeasonHighlights` |
| `get_fairness_index` | `getFairnessIndex` |
| `get_busiest_periods` | `getBusiestPeriods` |
| `get_active_sessions` | `getActiveSessions` |
| `get_session_lineup` | `getSessionLineup` |
| `execute_query` | `executeQuery` |

Tool input schemas and output shapes come directly from `tool-registry.ts`. Results pass through the same `summarizeToolResult` helper in `ai-service.ts` to stay within token limits.

## 7. CLI Package Structure

New workspace package: `packages/mcp/`

```
packages/mcp/
├── src/
│   ├── index.ts          # Entry point — MCP stdio server loop
│   ├── auth.ts           # Login flow, token storage/retrieval
│   ├── proxy.ts          # HTTP client to worker /mcp endpoint
│   └── config.ts         # Config file (~/.config/scorebrawl/mcp.json)
├── package.json
└── tsconfig.json
```

**Entry point behavior:** When executed with no arguments, the CLI starts the MCP stdio server. When executed as `npx @scorebrawl/mcp login`, it runs the auth flow.

**Dependencies:**
- `keytar` — OS keychain storage
- `open` — cross-platform browser launch
- `node-fetch` (or native `fetch` if Node 18+)

## 8. Configuration & State

Stored in `~/.config/scorebrawl/mcp.json`:

```json
{
  "apiBaseUrl": "https://api.scorebrawl.com",
  "keychainService": "scorebrawl-mcp"
}
```

The actual session token is stored in the OS keychain under service `scorebrawl-mcp`, account `sessionToken`. If `keytar` is unavailable, the token falls back to being stored (plaintext) in the same config file under a `sessionToken` key.

## 9. Error Handling & Security

- **Auth failure (401):** Worker returns 401, CLI translates to MCP `Error` object with code `-32001` (auth error)
- **No active org (400):** Worker returns 400 with message `"No active league selected. Set an active league in the Scorebrawl web app."`, CLI returns MCP error
- **Network failure:** CLI retries once with exponential backoff (max 3s), then returns MCP error
- **Token expiry:** CLI detects 401, exits with message `"Session expired. Run 'npx @scorebrawl/mcp login' to re-authenticate."`
- **Read-only constraint:** Only tools from `tool-registry.ts` are exposed. No mutation tools (create match, update player, etc.) are available via MCP.

## 10. Worker Route Details

### `POST /mcp`

**Headers:**
- `Authorization: Bearer <sessionToken>` — required
- `Content-Type: application/json`

**Request body (JSON-RPC 2.0):**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list",
  "params": {}
}
```

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "get_players",
    "arguments": {}
  }
}
```

**Response:**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": [
      {
        "name": "get_players",
        "description": "Get all players in the league with their aggregate stats...",
        "inputSchema": { "type": "object", "properties": {} }
      }
    ]
  }
}
```

### Auth Middleware

Reuses the existing `better-auth` session validation. The route extracts the bearer token, calls `betterAuth.api.getSession({ headers })`, and uses `ctx.authentication.session.activeOrganizationId` for organization scoping. If no session or no active org, returns the appropriate 401/400.

## 11. Web App Login Page

New route: `/auth/mcp-login`

- A lightweight page in `apps/web` that verifies the user is logged in
- Displays a "Connect MCP Server" button
- On click, creates a short-lived token and redirects to the provided `callback` URL with `?token=<sessionToken>`
- The token is the existing better-auth session token (no new token type needed)

## 12. Testing Plan

- **Backend:** Integration test for `/mcp` route in `apps/worker/src/test/` — verify tools/list and tools/call with valid session, verify 401 without auth, verify 400 without active org
- **CLI:** Manual test — install locally, run `login`, verify Claude Code MCP config works

## 13. Future Work (Out of Scope)

- SSE/HTTP transport for remote use without local CLI
- Mutation tools (create match, update player) via MCP
- Multiple active organization support in MCP context
