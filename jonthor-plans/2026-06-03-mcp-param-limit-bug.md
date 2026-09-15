# MCP tools fail for high-volume players (SQLite param limit)

## Problem

`get_head_to_head` and `get_team_chemistry` (and any MCP tool routed through `fetchMatchPlayerRows`) crash for players with many matches in scope.

Example: querying head-to-head for Ívar (~328 matches in Q2 2026 alone, ~3.7k+ all-time) returns:

```
MCP error -32603: Failed query: ... where "match"."id" in (?, ?, ?, ...hundreds...)
```

Root cause: SQLite default `SQLITE_MAX_VARIABLE_NUMBER` is 999 (libsql/Turso commonly enforces this too). The bound-parameter list overflows.

## Where

`apps/worker/src/services/mcp-tools/tool-executors.ts`

- L74 — `fetchMatchPlayerRows`: `conditions.push(inArray(match.id, matchIds))` after pulling match IDs in a separate query. Used by `getTeamChemistry`, `getSessionStats`, `getPlayerActivity`, etc.
- L431 — `getHeadToHead`: `where(inArray(match.id, sharedMatchIds))` after intersecting two per-player match-ID lists in JS.

Same anti-pattern: query → collect IDs to memory → re-query with `IN (...)`.

## Fix

Rewrite to a single query — filter by player name in a subquery / self-join instead of round-tripping through JS.

### `fetchMatchPlayerRows`

Replace the two-step (fetch ids → `inArray`) with one query whose match-existence filter is a correlated subquery:

```ts
const playerMatchSubquery = db
	.select({ matchId: matchPlayer.matchId })
	.from(matchPlayer)
	.innerJoin(seasonPlayer, eq(seasonPlayer.id, matchPlayer.seasonPlayerId))
	.innerJoin(player, eq(player.id, seasonPlayer.playerId))
	.leftJoin(user, eq(user.id, player.userId))
	.leftJoin(guest, eq(guest.id, player.guestId))
	.where(
		or(like(sql`LOWER(${user.name})`, pattern), like(sql`LOWER(${guest.displayName})`, pattern))
	);

// then: inArray(match.id, playerMatchSubquery)  — drizzle pushes this down to SQL, no JS round-trip
```

### `getHeadToHead`

Same pattern, but the filter becomes `match.id IN (p1-subquery) AND match.id IN (p2-subquery)`. Drop the JS `.filter(...)` intersection.

## Verification

- Unit test (or one-off query) for Ívar in Q2 2026 — should return non-empty h2h record vs. any player and a teammate chemistry breakdown.
- Spot-check Pálmi too (Q1 2026 had 621 matches — also over the limit).

## Unresolved

- Is the DB libsql/Turso or local SQLite? If libsql, the limit may be lower (250) — worth confirming so we know the exact threshold the fix has to clear.
- Other tools using the same `fetchMatchPlayerRows` (`getPlayerActivity`, `getStreaks`, `getSessionStats`, etc.) inherit the fix automatically — but they should be smoke-tested for the same player.
