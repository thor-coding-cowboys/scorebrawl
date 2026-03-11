# Session Rotation Rework Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rewrite `computeNextLineup` (winner-stays) with correct, rule-based rotation logic and fix `recalcConsecutiveGames` to track games played (not wins).

**Architecture:** Pure-function rewrite of `computeNextLineup` with clear priority-ordered steps. The function takes player states + match result and returns who rotates out, who plays next, and whether a coin toss is needed. All logic is deterministic except coin toss / random draw which are deferred to the caller.

**Tech Stack:** TypeScript, Vitest

---

## Current Bugs

1. **`recalcConsecutiveGames`** counts consecutive **wins** (including draws), but should count consecutive **games played in a row** (any participation). Used by `cancelCurrentMatch` and `deleteLastMatch`.

2. **`computeNextLineup`** has convoluted displacement logic mixing forced winners, losers, and priority. Several edge cases are wrong:
   - When waiters >= playing, win/lose should be irrelevant (all rotate out)
   - When 7 players in 2v2 (3 waiters), only 1 winner needs to rotate out but current logic doesn't cleanly handle this
   - `gamesPlayedThisSession` is used as secondary tiebreaker but shouldn't be — only `consecutiveGames` matters per the rules

## New Rotation Rules (winner-stays mode, priority order)

### Definitions

- `consecutiveGames` = how many matches a player has played in a row without sitting out
- `slotsToFill` = min(waitingCount, totalPlaying)
- `totalPlaying` = teamSize \* 2 (home + away count)

### Rules

1. **No waiters → nobody out.** If slotsToFill == 0, return same teams.
2. **Consecutive games is ALWAYS the tiebreaker.** When any two players match on all other criteria, the one with more consecutiveGames rotates out.
3. **maxConsecutiveGames forces rotation.** If set and a player has `consecutiveGames >= maxConsecutiveGames`, they MUST rotate out. If more forced players than slots, pick by highest consecutiveGames. This trumps win/lose status.
4. **Losers rotate out before winners.** Among non-forced players, losers are displaced first. If more losers than remaining slots, pick by highest consecutiveGames.
5. **Coin toss for unresolvable 2-player ties.** If two players are perfectly matched (same group + same consecutiveGames) and we need to pick only one, trigger coin toss.
6. **Random draw for 3+ player ties.** Same as coin toss but for 3+ candidates.

### Special Cases

- **Waiters >= playing:** ALL playing players rotate out. Win/lose is irrelevant. The waiters replace everyone.
- **No maxConsecutiveGames set:** Winners stay indefinitely (only displaced when waiters outnumber playing spots).
- **Draw:** Compare team consecutiveGames sums. Higher-sum team is treated as "loser." If sums equal → draw-tiebreak coin toss to determine which team is "loser."

## Algorithm (pseudocode)

```
function computeNextLineup(input):
  // 1. Classify players
  waiting = players.filter(waiting).sortBy(queuePosition)
  winners, losers = classifyByResult(lastResult, home, away)  // handles draw
  slotsToFill = min(waiting.length, home.length + away.length)

  // 2. No waiters → nobody out (Rule 1)
  if slotsToFill == 0:
    return sameTeams

  // 3. Everyone out when waiters >= playing
  if slotsToFill >= totalPlaying:
    return allRotateOut, waiters fill both teams

  // 4. Build rotation priority list
  rotateOut = []

  // 4a. Forced by maxConsecutiveGames (Rule 3)
  if maxConsecutiveGames != null:
    forced = allPlaying.filter(p => p.consecutiveGames >= max).sortDesc(consecutiveGames)
    if forced.length > slotsToFill:
      forced = pickWithTieCheck(forced, slotsToFill)  // may trigger coin toss
    rotateOut.push(...forced)

  // 4b. Fill remaining with losers first, then winners (Rule 4)
  remaining = slotsToFill - rotateOut.length
  if remaining > 0:
    nonForcedLosers = losers.filter(not in rotateOut).sortDesc(consecutiveGames)
    nonForcedWinners = winners.filter(not in rotateOut).sortDesc(consecutiveGames)
    candidates = [...nonForcedLosers, ...nonForcedWinners]
    picked = pickWithTieCheck(candidates, remaining)  // may trigger coin toss
    rotateOut.push(...picked)

  // 5. Build teams from survivors + waiters
  survivors = playing.filter(not in rotateOut)
  winnerSurvivors = survivors.filter(isWinner)
  loserSurvivors = survivors.filter(isLoser)
  winnerTeam = winnerSurvivors
  opposingTeam = [...waiters, ...loserSurvivors]
  // Promote from opposing to winner team if short
  while winnerTeam.length < teamSize && opposingTeam.length > teamSize:
    winnerTeam.push(opposingTeam.shift())

  // 6. Apply always-split constraints
  return enforceAlwaysSplit(winnerTeam, opposingTeam)
```

### pickWithTieCheck(candidates, count)

```
Take first `count` from sorted candidates.
If candidate[count-1] and candidate[count] have same consecutiveGames
AND are in the same group (forced/loser/winner):
  → Collect all tied candidates in that group
  → If resolvedCoinTossWinnerIds provided, use that to break tie
  → Otherwise return coinTossNeeded with tied candidates
```

---

## Task 1: Write Tests for New Rotation Rules

**Files:**

- Rewrite: `apps/worker/test/lib/session-rotation.spec.ts`
- Delete: `apps/worker/test/lib/session-rotation-bug.spec.ts` (merge into main spec)

All tests go in the main spec file. Tests are organized by rule. Each test uses `makePlayer` and `base` helpers.

See test file for full test cases. Key scenarios:

### Rule 1: No waiters → nobody out

- 1v1, 2v2, 3v3 with 0 waiters
- maxConsecutiveGames set but 0 waiters → nobody forced out (IMPORTANT: current code is WRONG here — it forces players out even with no waiters. New rule says nobody goes out.)

Wait — re-reading the rules: Rule 1 says "If no other player is waiting to play, no player goes to out." But Rule 3 says maxConsecutiveGames trumps. Need to reconcile.

**Resolution:** Rule 1 is absolute. If there are 0 waiters, nobody goes out regardless of maxConsecutiveGames. You can't rotate someone out if there's nobody to replace them. maxConsecutiveGames only matters when there ARE waiters.

### Rule 2: consecutiveGames tiebreaker

- 2 losers, different consecutive → higher out
- 2 winners needing to go, different consecutive → higher out

### Rule 3: maxConsecutiveGames

- Winner at max with waiters → forced out
- Winner below max → NOT forced out
- 2 forced, 1 slot → highest consecutive goes
- maxConsecutiveGames + losers: forced winners out first, then losers
- 0 waiters + maxConsecutiveGames → nobody out (Rule 1 overrides)

### Rule 4: Losers rotate out first

- 1 waiter → 1 loser out (most consecutive)
- 2 waiters → both losers out
- 3 waiters in 2v2 → both losers + 1 winner

### Rule 5/6: Coin toss / random draw

- 2 losers same stats → coin toss
- 3 losers same stats (3v3) → random draw (same mechanism, just 3 candidates)
- Coin toss resolution → correct lineup

### Special: Waiters >= playing

- 8 players 2v2 → all 4 out, win/lose irrelevant
- 6 players 2v2 → both losers out (waiters == losers)
- 9 players 3v3 → all 6 out

### Special: 7 players 2v2

- 3 waiters, 4 playing → losers (2) + 1 winner out
- Winner with most consecutive rotates

### Draw handling

- Unequal consecutive sums → higher sum team = loser
- Equal sums → draw-tiebreak coin toss
- Resolved draw coin toss → correct rotation

### Team sizes: 1v1, 2v2, 3v3

- Each rule tested with at least 2 different team sizes

---

## Task 2: Rewrite `computeNextLineup`

**Files:**

- Modify: `apps/worker/src/lib/session-rotation.ts`

Replace the winner-stays block (lines 139-359) with clean implementation following the algorithm above. Keep types, round-robin, manual, and `enforceAlwaysSplit` unchanged.

Key changes:

- Remove `gamesPlayedThisSession` from priority sorting — only `consecutiveGames` matters
- Remove `playerGroup` tracking — use simpler group detection
- Add explicit "all rotate out" path when waiters >= playing
- Add explicit "nobody out" path when 0 waiters (even if maxConsecutiveGames forces)
- Clean tie detection at cut points

---

## Task 3: Fix `recalcConsecutiveGames`

**Files:**

- Modify: `apps/worker/src/repositories/session-repository.ts:816-876`

Change from counting consecutive wins to counting consecutive games played. Walk matches in reverse order; a player's streak breaks when they are NOT in a match (not when they lose).

```typescript
// Current (WRONG): breaks streak on loss
const won =
	(m.result === "home" && inHome) || (m.result === "away" && !inHome) || m.result === "draw";
if (won) streak++;
else finalized;

// New (CORRECT): breaks streak when not participating
if (inMatch.has(spId)) streak++;
else finalized;
```

---

## Task 4: Verify & Clean Up

- Run all tests: `bunx vitest run test/lib/session-rotation.spec.ts`
- Run typecheck: `bun typecheck`
- Run lint: `bun oxc`
- Delete `session-rotation-bug.spec.ts` (cases merged into main spec)
