# PR #610 Review: Garmin Connect IQ Session Remote

Review of `feat/garmin-session-remote` — 4 new REST endpoints + Garmin watch app + 10 integration tests.

---

## Security Findings

### CRITICAL: Coin Toss IDOR — No Session Scoping

**`device-router.ts:614-618`**

The `resolve-coin-toss` endpoint fetches coin toss by ID alone:

```typescript
const [coinToss] = await db
	.select()
	.from(sessionCoinToss)
	.where(eq(sessionCoinToss.id, coinTossId))
	.limit(1);
```

`resolveLeagueAndMembership` verifies the user is a member of the _requested_ league, but the fetched `coinTossId` is never verified to belong to that league's session. An attacker with a valid API key to league A can resolve coin tosses belonging to league B by passing arbitrary coin toss IDs.

**Fix:** Add `AND sessionId = rawSession.id` to the where clause, or verify `coinToss.sessionId` matches the active session after fetching.

### HIGH: Winner IDs Not Validated Against Coin Toss Candidates

**`device-router.ts:607-608`**

```typescript
const winnerIds = winnerIdsRaw.split(",");
```

These are passed directly to `resolveCoinToss` without checking they're a subset of the coin toss's actual `candidates`. Arbitrary session player IDs can be injected as "winners", corrupting rotation logic and game state.

**Fix:** After fetching the coin toss, validate `winnerIds.every(id => coinToss.candidates.includes(id))`.

### HIGH: No Score Upper Bound

**`device-router.ts:376-377` and `711-714`**

Scores validated with `z.coerce.number().int().min(0)` — no max. A compromised device could submit `homeScore=2147483647`. This flows into ELO calculations and permanent match records.

**Fix:** Add `.max(99)` or similar reasonable cap.

### MEDIUM: API Key Sent in Garmin Query Params (POST)

**`apps/garmin/source/ApiClient.mc:56-68`**

The Garmin POST method encodes parameters into the URL query string. While the API key is sent via `x-api-key` header (good), the actual POST data (scores, coin toss IDs, winner IDs) are in the URL. This means:

- Server access logs will contain full request URLs with all mutation parameters
- Intermediate proxies/CDNs may cache or log these URLs

Not a direct vulnerability but increases exposure surface. Acceptable for v1 given Garmin SDK constraints.

### LOW: No `leagueSlug` Route Param Validation

**`device-router.ts:152`**

`c.req.param("leagueSlug")` used directly. Not a SQL injection risk (Drizzle parameterizes), but no early rejection of malformed slugs. Minor.

---

## Code Quality

### HIGH: ~230 Lines Duplicated from tRPC Session Router

**`device-router.ts:371-599`** mirrors **`session-router.ts:175-400`**

The `record-result` endpoint is a near line-for-line copy of the tRPC `session.recordResult` mutation:

- Match result calculation
- `createMatch` call
- Achievement queue dispatch
- `recordMatchResult` + `computeNextLineup`
- Auto coin toss logic
- `updateProposedLineup`
- SSE broadcast
- Streak threshold checks

The `resolve-coin-toss` endpoint similarly mirrors `session-router.ts:402-484`.

Any bugfix or feature change to match recording needs dual application. Should be extracted into a shared service function.

### MEDIUM: `/context` Endpoint Doesn't Use `resolveLeagueAndMembership`

**`device-router.ts:68-147`** manually does league lookup + membership + season fetch — identical to the helper at `device-router.ts:149-188`. The `/context` endpoint should use the helper.

### MEDIUM: 3 Sequential DB Queries in `resolveLeagueAndMembership`

**`device-router.ts:154-185`**

Three serial round-trips: league → member → seasons. Could be 1-2 queries with joins. On Cloudflare Workers with strict CPU limits, this matters — especially since every session endpoint calls this.

### LOW: Redundant Comments

**`device-router.ts:750, 759, 810, 813, 837`**

`// Update the session match scores`, `// Broadcast score update via SSE`, `// Get all players from current lineup`, `// Shuffle all players`, `// Broadcast lineup update`. Per AGENTS.md: no redundant comments.

### LOW: `System.println` Debug Logging in Garmin App

**`ApiClient.mc:64`, `ScoreEntryDelegate.mc:142-143`, `SessionView.mc:56`, etc.**

Multiple `System.println` calls left in production code. Not a security risk on Garmin (logs are local to simulator), but indicates unfinished cleanup.

---

## Test Coverage Gaps

### Missing Tests

| Endpoint                                             | Status                                                                                         |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `GET /session/active` — no session                   | Covered                                                                                        |
| `GET /session/active` — proposed lineup              | Covered                                                                                        |
| `GET /session/active` — match in progress            | Covered                                                                                        |
| `POST /session/start-match` — success                | Covered                                                                                        |
| `POST /session/start-match` — no lineup              | Covered                                                                                        |
| `POST /session/start-match` — match in progress      | Covered                                                                                        |
| `POST /session/record-result` — success              | Covered                                                                                        |
| `POST /session/record-result` — no match             | Covered                                                                                        |
| **`POST /session/update-score`**                     | **MISSING**                                                                                    |
| **`POST /session/shuffle-lineup`**                   | **MISSING**                                                                                    |
| **`POST /session/resolve-coin-toss`**                | **MISSING** — especially concerning given the IDOR finding                                     |
| **Invalid score validation** (negative, non-integer) | **MISSING**                                                                                    |
| **Score upper bound**                                | **MISSING** (can't test what doesn't exist yet)                                                |
| **Closed season behavior**                           | **MISSING** — `resolveLeagueAndMembership` falls back to first closed season if all are closed |
| Auth 401 / 403                                       | Covered                                                                                        |

### Closed Season Edge Case

**`device-router.ts:185`**

```typescript
const activeSeason = seasons.find((s) => !s.closed) || seasons[0];
```

If all seasons are closed, this returns the first closed season as "active". Mutations would then operate on a closed season. Should either return null or explicitly check `activeSeason.closed`.

---

## Standards Compliance (AGENTS.md)

| Rule                       | Status | Notes                                                                  |
| -------------------------- | ------ | ---------------------------------------------------------------------- |
| zValidator for Hono routes | PASS   | All POST endpoints with input use zValidator                           |
| No N+1 queries             | PASS   | No loop queries, but 3 sequential queries in helper could be optimized |
| Proper auth checks         | PASS   | Middleware uses betterAuth session, all endpoints verify membership    |
| No `@ts-expect-error`      | PASS   | None found                                                             |
| No redundant comments      | FAIL   | ~5 redundant comments in device-router.ts                              |
| Well-typed code            | PASS   | Good TypeScript throughout                                             |

---

## Garmin App Notes

- **API key stored in Garmin Connect settings** — standard pattern, acceptable
- **Hardcoded fallback URL** (`properties.xml:7`) — points to `https://scorebrawl.com`, correct for prod
- **Cache-busting on GETs** (`ApiClient.mc:35-40`) — adds `_t=<timestamp>` param, good for BLE proxy caching
- **Polling interval:** 10s for session, 2s for score entry — reasonable
- **No input sanitization on Garmin side** — acceptable, server-side validation handles this

---

## Recommended Actions (Priority Order)

1. **Fix coin toss IDOR** — scope coin toss lookup to the active session (CRITICAL)
2. **Validate winner IDs against candidates** — check winnerIds ⊆ coinToss.candidates (HIGH)
3. **Add score upper bound** — `.max(99)` on homeScore/awayScore (HIGH)
4. **Add tests for resolve-coin-toss, update-score, shuffle-lineup** (HIGH)
5. **Handle closed season edge case** — return null instead of fallback (MEDIUM)
6. Extract record-result + resolve-coin-toss into shared service function (MEDIUM — can be follow-up)
7. Consolidate `resolveLeagueAndMembership` with `/context` endpoint (LOW)
8. Remove redundant comments (LOW)
9. Optimize `resolveLeagueAndMembership` to fewer queries (LOW)
