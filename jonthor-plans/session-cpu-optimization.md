# Session CPU Optimization Plan

Investigation of session feature for Cloudflare Worker CPU limit violations.

---

## CRITICAL: `recordResult` (tRPC + device router)

**Heaviest single request in the codebase.** Both `session-router.ts:276-503` and `device-router.ts:371-601` execute this chain sequentially in a single Worker invocation:

1. `getSessionForOrg` or `resolveLeagueAndMembership` (1-3 queries)
2. `getSessionById` (1 + 3 parallel queries with 4-way joins)
3. `matchRepository.create` (transaction: season lookup + player lookup + ELO calc + insert match + insert matchPlayers in batches + N individual `UPDATE seasonPlayer` + team creation/scoring)
4. `ACHIEVEMENT_QUEUE.send`
5. `sessionRepository.recordMatchResult` (transaction: update match + select match + select playing players + CASE-based batch update + select all players)
6. `computeNextLineup` (CPU: in-memory rotation algorithm)
7. If coin toss needed + autoCoinToss: `createCoinToss` + `resolveCoinToss` + **second** `computeNextLineup`
8. `updateProposedLineup`
9. SSE broadcast
10. `checkStreakThresholds` + `checkTeamStreakThresholds` (parallel, but unbounded queries)
11. SSE broadcast per streak event
12. **Device router only:** `getSessionById` again (full re-fetch for response formatting)

**Estimated DB round-trips:** 15-25+ per request depending on team size and coin toss path.

### Issues

#### P0: Unbounded streak queries

- `checkStreakThresholds` (`match-repository.ts:410-424`): fetches ALL `matchPlayer` rows for given `seasonPlayerIds` with no SQL LIMIT, then truncates to 16 per player in JS. A season with 500 matches and 10 players = 5000+ rows fetched, only 160 needed.
- `checkTeamStreakThresholds` (`match-repository.ts:523-535`): same pattern for teams.
- **Fix:** Add `LIMIT` via SQL window function or subquery. Each player needs at most 16 recent matches. Use `ROW_NUMBER() OVER (PARTITION BY seasonPlayerId ORDER BY createdAt DESC)` with `WHERE row_num <= 16`, or fetch last 16 matches per player individually (still fewer rows than current approach).

#### P1: N individual UPDATE statements in `matchRepository.create`

- `match-repository.ts:309-316`: Updates each player's ELO score with individual `UPDATE seasonPlayer SET score = X WHERE id = Y` wrapped in `Promise.all`. For a 6v6 match = 12 individual updates.
- **Fix:** Single CASE-based UPDATE like `recordMatchResult` already does (line 595-614).

#### P1: Sequential team score updates in `matchRepository.create`

- `match-repository.ts:372-380`: `for...of` loop with `await` per team update (2 sequential writes).
- **Fix:** Use `Promise.all` or batch into single CASE update.

#### P1: `getOrInsertTeam` called twice sequentially

- Each call queries `leagueTeam` + `seasonTeam` + potentially inserts both + inserts `leagueTeamPlayer` records in batched loop.
- **Fix:** Could parallelize the two `getOrInsertTeam` calls for home/away teams.

#### P2: Device router double-fetch pattern

- `device-router.ts:389-401`: Every device session endpoint calls `getActiveSession` (2 queries) then `getSessionById` (4 queries) = 6 queries just to locate the session.
- `getActiveSession` returns the session + players, then `getSessionById` re-fetches the same session + players + matches + coin tosses.
- **Fix:** Create `getActiveSessionFull` that combines both into a single code path. Or skip `getActiveSession` and query directly with `seasonId + status = active`.

#### P2: Device router record-result re-fetches full session at end

- `device-router.ts:591-594`: After all the work is done, calls `getSessionById` a second time just to format the response. The data is already available from earlier queries + mutation results.
- **Fix:** Construct response from already-fetched data instead of re-querying.

---

## HIGH: `getSessionSummary`

`session-repository.ts:976-1256` -- 4 sequential DB queries + heavy in-memory processing.

### Issues

#### P1: 4 sequential queries (not parallelized)

1. Fetch session (line 983)
2. Count matches (line 1000)
3. Fetch session players with 4-way join (line 1007)
4. Fetch completed matches with join (line 1035)
5. Fetch matchPlayer stats (line 1054)

Queries 1-3 could run in parallel. Query 4-5 could run in parallel after 3 (they don't depend on each other, only on `sessionId` and `sessionPlayerIds`).

#### P2: Team combo O(n^2 \* m) computation

- `session-repository.ts:1169-1203`: For each match, generates all player pairs (O(teamSize^2)) and tracks win/loss. Capped at 100 matches but still significant CPU for 6v6 (15 pairs _ 2 teams _ 100 matches = 3000 iterations with Map operations).
- Already has `MAX_MATCHES_FOR_COMBOS = 100` cap, which is reasonable.

---

## MEDIUM: `recalcConsecutiveGames`

`session-repository.ts:815-905` -- Called by `cancelCurrentMatch` and `deleteLastMatch`.

### Issues

#### P2: Fetches all completed matches + all players

- Two sequential queries, then O(matches \* players) iteration.
- Has early termination (`finalized.size === allPlayers.length`), which helps.
- Batched updates grouped by consecutive count (good).
- **Risk:** Long sessions (50+ matches, 10+ players) could be slow. Not the worst offender since it's only called on cancel/delete (less frequent).

---

## MEDIUM: `resolveCoinToss` (tRPC)

`session-router.ts:505-588`

### Issues

#### P2: Full session re-fetch

- Line 530: Calls `getSessionById` (4 queries) just to get player data for lineup computation.
- Could fetch only the specific data needed (players + the triggering match).

---

## LOW: `removePlayer` procedure

`session-router.ts:195-247`

### Issues

#### P3: Full session re-fetch for lineup recomputation

- After removing a player, re-fetches entire session via `getSessionById` just to recompute proposed lineup. Only needs players list.

---

## Summary by priority

| Priority | Issue                                 | Location               | Est. Impact                                |
| -------- | ------------------------------------- | ---------------------- | ------------------------------------------ |
| P0       | Unbounded streak queries (no LIMIT)   | match-repo:410,523     | High - grows linearly with season history  |
| P1       | N individual ELO UPDATE statements    | match-repo:309-316     | Medium - 12 writes for 6v6                 |
| P1       | Sequential team score updates         | match-repo:372-380     | Low-Medium - 2 sequential writes           |
| P1       | getOrInsertTeam not parallelized      | match-repo (create)    | Medium - 2 sequential multi-query calls    |
| P1       | getSummary queries not parallelized   | session-repo:976-1074  | Medium - 4 sequential round-trips          |
| P2       | Device router double-fetch            | device-router:389-401  | Medium - 6 unnecessary queries per request |
| P2       | Device router end-of-request re-fetch | device-router:591      | Medium - 4 extra queries                   |
| P2       | recalcConsecutiveGames fetch-all      | session-repo:815-905   | Low - only on cancel/delete                |
| P2       | resolveCoinToss full session fetch    | session-router:530     | Low - only when coin toss happens          |
| P3       | removePlayer full session fetch       | session-router:195-247 | Low - infrequent operation                 |

## Worst-case: `recordResult` via device router

Counting minimum DB round-trips for a 2v2 match with auto coin toss:

```
resolveLeagueAndMembership:     3 sequential queries
getActiveSession:               2 queries
getSessionById:                 1 + 3 parallel = 4 queries
matchRepository.create:         ~8-12 queries (season + players + insert + N updates + teams)
ACHIEVEMENT_QUEUE.send:         1 queue write
recordMatchResult:              transaction with ~5 operations
computeNextLineup:              0 DB (CPU only)
createCoinToss:                 1 insert
resolveCoinToss:                1 update
computeNextLineup (2nd):        0 DB (CPU only)
updateProposedLineup:           1 update
broadcastSeasonEvent:           1 DO call
checkStreakThresholds:          1 unbounded query
checkTeamStreakThresholds:      2 queries (teams lookup + unbounded matches)
streak broadcasts:              N DO calls
getSessionById (re-fetch):      4 queries
                                ─────────────
Total:                          ~30-40 DB operations
```

This is the most likely cause of CPU timeouts.

---

## Implementation Guide

### Phase 1: Quick wins (biggest impact, smallest diff)

#### 1a. Bounded streak queries

`match-repository.ts` — `checkStreakThresholds`:

Replace the unbounded query with a window function:

```sql
SELECT * FROM (
  SELECT mp.season_player_id, mp.result, mp.created_at, p.id as player_id, u.name, u.image,
    ROW_NUMBER() OVER (PARTITION BY mp.season_player_id ORDER BY mp.created_at DESC) as rn
  FROM match_player mp
  INNER JOIN season_player sp ON mp.season_player_id = sp.id
  INNER JOIN player p ON sp.player_id = p.id
  INNER JOIN user u ON p.user_id = u.id
  WHERE mp.season_player_id IN (...)
) sub WHERE rn <= 16
```

D1 supports window functions. Same approach for `checkTeamStreakThresholds`.

If window functions cause issues on D1, fallback: run one query per player with `LIMIT 16`. For 2-12 players this is still far fewer rows than unbounded fetch-all.

#### 1b. Batch ELO updates in `matchRepository.create`

Replace `match-repository.ts:309-316`:

```ts
// BEFORE: N individual updates
const updatePromises = [...eloResult.homeTeam.players, ...eloResult.awayTeam.players].map((p) =>
	tx.update(seasonPlayer).set({ score: p.scoreAfter }).where(eq(seasonPlayer.id, p.id))
);
await Promise.all(updatePromises);

// AFTER: Single CASE-based update (same pattern as recordMatchResult:595-614)
const allResults = [...eloResult.homeTeam.players, ...eloResult.awayTeam.players];
const caseParts = allResults
	.map((p) => sql`WHEN ${seasonPlayer.id} = ${p.id} THEN ${p.scoreAfter}`)
	.reduce((acc, part) => sql`${acc} ${part}`);
await tx
	.update(seasonPlayer)
	.set({ score: sql`CASE ${caseParts} END` })
	.where(
		inArray(
			seasonPlayer.id,
			allResults.map((p) => p.id)
		)
	);
```

Same for team score updates (lines 372-380): combine into single CASE update.

#### 1c. Parallelize `getOrInsertTeam` calls

```ts
// BEFORE (sequential)
const homeTeam = await getOrInsertTeam({ ...homePlayers });
const awayTeam = await getOrInsertTeam({ ...awayPlayers });

// AFTER (parallel)
const [homeTeam, awayTeam] = await Promise.all([
	getOrInsertTeam({ ...homePlayers }),
	getOrInsertTeam({ ...awayPlayers }),
]);
```

Caveat: both run in same transaction. D1 transactions are serialized, so this may not actually help on D1 specifically. Verify with testing.

### Phase 2: Device router deduplication

#### 2a. Create `getActiveSessionFull`

New function in `session-repository.ts` that replaces `getActiveSession` + `getSessionById`:

```ts
export const getActiveSessionFull = async ({ db, seasonId }: { db: DrizzleDB; seasonId: string }) => {
  const [session] = await db
    .select()
    .from(gameSession)
    .where(and(eq(gameSession.seasonId, seasonId), eq(gameSession.status, "active")))
    .limit(1);

  if (!session) return null;

  // Reuse same parallel queries as getSessionById but skip the initial session fetch
  const [players, matches, coinTosses] = await Promise.all([...]);
  return { ...session, players, matches, pendingCoinTosses: coinTosses };
};
```

Replace all device router instances of `getActiveSession` -> `getSessionById` with this single call. Saves 2 queries per device request.

#### 2b. Eliminate record-result re-fetch

In `device-router.ts:591-600`, instead of calling `getSessionById` again, construct the response from data already in scope:

- `fullSession` has players/rotation config (fetched at line 398)
- `updatedPlayers` has current player state (from `recordMatchResult`)
- `updatedMatch` has current match state
- `proposedLineup` is already computed

Merge these into the `fullSession` object and pass to `formatSessionState`:

```ts
const mergedSession = {
	...fullSession,
	players: updatedPlayers.map((p) => ({
		...p,
		displayName: fullSession.players.find((fp) => fp.id === p.id)?.displayName ?? "Unknown",
		playerImage: fullSession.players.find((fp) => fp.id === p.id)?.playerImage ?? null,
		score: fullSession.players.find((fp) => fp.id === p.id)?.score ?? 0,
		userId: fullSession.players.find((fp) => fp.id === p.id)?.userId ?? null,
	})),
	matches: fullSession.matches.map((m) =>
		m.id === updatedMatch.id
			? {
					...m,
					...updatedMatch,
					homePlayerIds: parseStringArray(updatedMatch.homePlayerIds),
					awayPlayerIds: parseStringArray(updatedMatch.awayPlayerIds),
				}
			: m
	),
	proposedLineup,
};
return c.json(formatSessionState(mergedSession, activeSeason.slug));
```

Same approach for `resolve-coin-toss` endpoint (line 716-725).

### Phase 3: Parallelize `getSessionSummary`

```ts
// BEFORE: 5 sequential queries
const session = await ...;      // needs nothing
const totalMatches = await ...; // needs sessionId
const sessionPlayers = await ...; // needs sessionId
const completedMatches = await ...; // needs sessionId
const matchPlayerStats = await ...; // needs matchIds from completedMatches

// AFTER: 2 rounds
const [session, totalMatches, sessionPlayers, completedMatches] = await Promise.all([
  db.select(...).from(gameSession)...,
  db.select({ count: sql`COUNT(*)` }).from(sessionMatch)...,
  db.select(...).from(sessionPlayer)...,
  db.select(...).from(sessionMatch).innerJoin(match, ...)...,
]);

if (!session) return null;
// matchPlayerStats depends on completedMatches, so sequential
const matchPlayerStats = matchIds.length > 0 ? await db.select(...)... : [];
```

Reduces from 5 sequential round-trips to 2.

### Phase 4: Move streaks off critical path (optional, bigger refactor)

Streak checking is non-essential for the `recordResult` response. Could be deferred:

- Option A: Move to `ACHIEVEMENT_QUEUE` (already exists). Streak events get broadcast from the queue consumer instead.
- Option B: Use `ctx.waitUntil()` (Cloudflare) to run streak checks after response is sent. Frees CPU time for the actual response.

```ts
// In session-router.ts recordResult:
// Move lines 452-494 into waitUntil
ctx.env.waitUntil((async () => {
  const [streakPlayers, streakTeams] = await Promise.all([...]);
  await Promise.all(streakEvents.map(e => broadcastSeasonEvent(...)));
})());
```

This alone could cut 20-30% of the CPU time from `recordResult`.

---

## Unresolved Questions

1. Does D1 actually parallelize queries within a transaction, or are they serialized? If serialized, `Promise.all` inside `withTransaction` gives no benefit and we should focus on reducing query count instead.
2. Does `waitUntil` work reliably for D1 queries after the response is sent? Need to verify D1 connection isn't closed.
3. Should streak checking move entirely to the achievement queue? Cleaner architecture but adds latency to streak notifications.
4. Is `getOrInsertTeam` causing unique constraint races when parallelized for home/away? Both could try to create the same team if player sets overlap (unlikely in practice but possible).
