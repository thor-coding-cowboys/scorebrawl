# Session Queue Rotation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace mode-centric rotation logic with queue-as-source-of-truth. The queue is always sorted by priority; top N players are selected for the next match.

**Architecture:** New sorting model: all players return to queue after each game, sorted by (1) consecutiveGames ascending, (2) win/loss (winner-stays only), (3) queuePosition tiebreaker. Winners-take-priority and max-consecutive settings control sort behavior.

**Tech Stack:** TypeScript, Drizzle ORM, tRPC, Vitest

---

## File Map

| File                                                 | Change                                                                         |
| ---------------------------------------------------- | ------------------------------------------------------------------------------ |
| `apps/worker/src/db/schema/league-schema.ts`         | Modify `rotationMode` enum, add `winnersTakePriority`, `maxConsecutiveEnabled` |
| `apps/worker/src/lib/session-rotation.ts`            | Rewrite `computeNextLineup` with new sorting model                             |
| `apps/worker/src/repositories/session-repository.ts` | Update `createSession`, `recordMatchResult` for new fields                     |
| `apps/worker/src/trpc/router/session-router.ts`      | Update input schemas, pass new settings                                        |
| `apps/web/src/routes/.../session-types.ts`           | Update frontend types                                                          |
| `apps/web/src/routes/.../start-session-dialog.tsx`   | Update UI for new settings                                                     |
| `apps/worker/test/lib/session-rotation.spec.ts`      | Rewrite tests for new logic                                                    |

---

## Task 1: Schema Changes

**Files:**

- Modify: `apps/worker/src/db/schema/league-schema.ts:277-279`
- Modify: `apps/worker/src/db/schema/league-schema.ts:264-293`

- [ ] **Step 1: Update rotationMode enum**

Change line 277-279 from:

```typescript
rotationMode: text("rotation_mode", {
  enum: ["winner-stays", "winner-stays-hard", "round-robin", "manual"],
}).notNull(),
```

To:

```typescript
rotationMode: text("rotation_mode", {
  enum: ["winner-stays", "round-robin", "manual"],
}).notNull(),
winnersTakePriority: integer("winners_take_priority", { mode: "boolean" }).default(false).notNull(),
maxConsecutiveEnabled: integer("max_consecutive_enabled", { mode: "boolean" }).default(false).notNull(),
```

- [ ] **Step 2: Generate migration**

Run: `bun db:generate`

- [ ] **Step 3: Commit**

```bash
git add apps/worker/src/db/schema/league-schema.ts
git commit -m "feat(session): add winnersTakePriority and maxConsecutiveEnabled, remove winner-stays-hard mode"
```

---

## Task 2: Rewrite Session Rotation Library

**Files:**

- Modify: `apps/worker/src/lib/session-rotation.ts`

- [ ] **Step 1: Update RotationMode type**

Change line 1 from:

```typescript
export type RotationMode = "winner-stays" | "winner-stays-hard" | "round-robin" | "manual";
```

To:

```typescript
export type RotationMode = "winner-stays" | "round-robin" | "manual";
```

- [ ] **Step 2: Add winnersTakePriority to RotationInput**

Add `winnersTakePriority: boolean` to the `RotationInput` interface (after `autoRandomize`).

- [ ] **Step 3: Rewrite computeNextLineup function**

Replace the entire `computeNextLineup` function with a simplified version based on this algorithm:

```typescript
export function computeNextLineup(input: RotationInput): ProposedLineup {
	const {
		mode,
		teamSize,
		maxConsecutiveGames,
		maxConsecutiveEnabled, // NEW: from input
		winnersTakePriority, // NEW: from input
		autoRandomize,
		alwaysSplitConstraints,
		players,
		lastResult,
		homePlayerIds,
		awayPlayerIds,
		resolvedCoinTossWinnerIds,
	} = input;

	if (mode === "manual") {
		return { homePlayerIds: [], awayPlayerIds: [], rotatedOut: [], coinTossNeeded: null };
	}

	// Get all playing players from last match
	const playingIds = new Set([...homePlayerIds, ...awayPlayerIds]);
	const playingPlayers = players.filter((p) => playingIds.has(p.id));
	const waitingPlayers = players.filter((p) => p.status === "waiting" && !playingIds.has(p.id));

	// Determine winners/losers
	let winnerIds: string[];
	let loserIds: string[];

	if (lastResult === "draw") {
		// Use coin toss or consecutive games sum to determine winners
		if (resolvedCoinTossWinnerIds?.length) {
			const homeSet = new Set(homePlayerIds);
			const winnersAreHome = resolvedCoinTossWinnerIds.some((id) => homeSet.has(id));
			winnerIds = winnersAreHome ? homePlayerIds : awayPlayerIds;
			loserIds = winnersAreHome ? awayPlayerIds : homePlayerIds;
		} else {
			return {
				homePlayerIds: [],
				awayPlayerIds: [],
				rotatedOut: [],
				coinTossNeeded: {
					conflictType: "draw-tiebreak",
					candidates: [...homePlayerIds, ...awayPlayerIds],
				},
			};
		}
	} else {
		winnerIds = lastResult === "home" ? homePlayerIds : awayPlayerIds;
		loserIds = lastResult === "home" ? awayPlayerIds : homePlayerIds;
	}

	const winnerSet = new Set(winnerIds);

	// Sort ALL players (playing + waiting) by priority:
	// 1. consecutiveGames ASC (fewer = higher priority)
	// 2. For winner-stays: win/loss (winners above losers, or absolute top if winnersTakePriority)
	// 3. queuePosition ASC (tiebreaker)

	// Note: `maxConsecutiveEnabled` does NOT change sorting — consecutiveGames ASC already
	// implements the "soft floor" behavior described in the spec. Players with more games
	// are naturally sorted lower. The `maxConsecutiveGames` value is only used during
	// selection if `maxConsecutiveEnabled: true` — players at/above the limit become
	// very low priority but can still be selected if queue is exhausted.
	// (This check happens during team selection, not sorting.)

	const sortedPlayers = [...players].sort((a, b) => {
		// Skip "out" players
		if (a.status === "out") return 1;
		if (b.status === "out") return -1;

		// 1. consecutiveGames ASC — implements soft floor
		if (a.consecutiveGames !== b.consecutiveGames) {
			return a.consecutiveGames - b.consecutiveGames;
		}

		// 2. win/loss sorting (winner-stays only, round-robin skips this)
		if (mode === "winner-stays") {
			const aWon = winnerSet.has(a.id);
			const bWon = winnerSet.has(b.id);

			if (winnersTakePriority) {
				// Winners go to absolute top of queue — separate winners from all other players
				if (aWon !== bWon) return aWon ? -1 : 1;
				// Within winners or losers, sort by consecutiveGames then queuePosition
				return a.queuePosition - b.queuePosition;
			} else {
				// Winners above losers within same consecutiveGames tier
				if (aWon !== bWon) return aWon ? -1 : 1;
				// Same tier and win/loss status — sort by queuePosition
				return a.queuePosition - b.queuePosition;
			}
		}

		// 3. queuePosition ASC
		return a.queuePosition - b.queuePosition;
	});

	// Coin toss: if players are tied on ALL keys, we need a coin toss
	// This is rare - only when same consecutiveGames and no win/loss distinction (or round-robin)
	const coinTossNeeded = detectCoinToss(sortedPlayers, teamSize * 2, mode, winnerSet);

	if (coinTossNeeded) {
		return {
			homePlayerIds: [],
			awayPlayerIds: [],
			rotatedOut: [],
			coinTossNeeded,
		};
	}

	// Select top N players for next match
	const selectedPlayers = sortedPlayers.slice(0, teamSize * 2);
	const rotatedOut = [...playingIds].filter((id) => !selectedPlayers.some((p) => p.id === id));

	// Split into home/away
	let newHome: string[];
	let newAway: string[];

	if (autoRandomize) {
		const shuffled = fisherYatesShuffle(selectedPlayers.map((p) => p.id));
		newHome = shuffled.slice(0, teamSize);
		newAway = shuffled.slice(teamSize, teamSize * 2);
	} else {
		// Winners stay on their side, waiters fill opposing team
		const homeWinners = selectedPlayers.filter(
			(p) => winnerSet.has(p.id) && new Set(homePlayerIds).has(p.id)
		);
		const awayWinners = selectedPlayers.filter(
			(p) => winnerSet.has(p.id) && new Set(awayPlayerIds).has(p.id)
		);
		const nonWinners = selectedPlayers.filter((p) => !winnerSet.has(p.id));

		// Build teams: fill each team up to teamSize, preferring to keep winners
		newHome = [...homeWinners];
		newAway = [...awayWinners];

		// Fill remaining slots with non-winners
		for (const player of nonWinners) {
			if (newHome.length < teamSize) {
				newHome.push(player.id);
			} else if (newAway.length < teamSize) {
				newAway.push(player.id);
			} else {
				break; // Both teams full
			}
		}

		// If still not full (shouldn't happen), add remaining non-winners to any team
		if (newHome.length < teamSize) {
			for (const player of nonWinners) {
				if (!newHome.includes(player.id) && newHome.length < teamSize) {
					newHome.push(player.id);
				}
			}
		}
		if (newAway.length < teamSize) {
			for (const player of nonWinners) {
				if (!newAway.includes(player.id) && newAway.length < teamSize) {
					newAway.push(player.id);
				}
			}
		}
	}

	const constrained = enforceAlwaysSplit(newHome, newAway, alwaysSplitConstraints, players);

	return {
		homePlayerIds: constrained.homeIds,
		awayPlayerIds: constrained.awayIds,
		rotatedOut,
		coinTossNeeded: null,
	};
}
```

- [ ] **Step 4: Add/replace detectCoinToss helper**

The existing `detectCoinToss` function (line ~400) should be replaced with this new implementation:

```typescript
function detectCoinToss(
	sortedPlayers: SessionPlayerState[],
	needed: number,
	mode: RotationMode,
	winnerSet: Set<string>
): CoinTossNeeded | null {
	if (needed >= sortedPlayers.length) return null;

	const lastSelected = sortedPlayers[needed - 1]!;
	const firstExcluded = sortedPlayers[needed]!;

	// If tied on consecutiveGames AND tied on win/loss (or round-robin has no win/loss)
	if (lastSelected.consecutiveGames === firstExcluded.consecutiveGames) {
		const lastWon = winnerSet.has(lastSelected.id);
		const firstWon = winnerSet.has(firstExcluded.id);

		if (mode === "round-robin" || lastWon === firstWon) {
			// Find all tied players
			const tiedPlayers = sortedPlayers.filter(
				(p) =>
					p.consecutiveGames === lastSelected.consecutiveGames &&
					(mode === "round-robin" || winnerSet.has(p.id) === lastWon)
			);
			return {
				conflictType: "loser-rotation",
				candidates: tiedPlayers.map((p) => p.id),
			};
		}
	}
	return null;
}
```

- [ ] **Step 5: Run tests to verify**

Run: `bun run test -- apps/worker/test/lib/session-rotation.spec.ts`
Expected: Tests should fail initially (expected, since algorithm changed)

- [ ] **Step 6: Commit**

```bash
git add apps/worker/src/lib/session-rotation.ts
git commit -m "refactor(session): rewrite computeNextLineup with queue-as-source-of-truth"
```

---

## Task 3: Update Session Repository

**Files:**

- Modify: `apps/worker/src/repositories/session-repository.ts:103-125` (`createSession`)
- Modify: `apps/worker/src/repositories/session-repository.ts:631-765` (`recordMatchResult`)

- [ ] **Step 1: Update createSession function**

Update the `createSession` function to accept and store the new `winnersTakePriority` and `maxConsecutiveEnabled` fields. Add `winnersTakePriority: boolean` and `maxConsecutiveEnabled: boolean` to the input type and insert them into the database.

- [ ] **Step 2: Update recordMatchResult function**

The `recordMatchResult` function needs to be updated to use the new `winnersTakePriority` and `maxConsecutiveEnabled` settings instead of checking `rotationMode === "winner-stays-hard"`. Change the hardcoded check to a boolean check on the new field.

- [ ] **Step 3: Update recalcQueuePositions**

The `recalcQueuePositions` function rebuilds queue positions from historical match data. With the new queue-as-source-of-truth model, this function needs a different algorithm:

1. For each completed match, ALL playing players return to queue (no one stays)
2. Queue is sorted by: consecutiveGames ASC → win/loss (if winner-stays) → queuePosition ASC
3. `winnersTakePriority` affects win/loss sorting weight

**If the session has `winnersTakePriority: true`**, winners are sorted to absolute top.
**If `false`**, winners are sorted above losers within their consecutiveGames tier.

This function may need significant rewriting or may become unnecessary if the new model makes it redundant (since queue position is now computed from the sorting algorithm, not stored separately).

- [ ] **Step 4: Run tests**

Run: `bun run test -- apps/worker/test/trpc/session-router.spec.ts`
Expected: Should pass

- [ ] **Step 5: Commit**

```bash
git add apps/worker/src/repositories/session-repository.ts
git commit -m "feat(session): support winnersTakePriority and maxConsecutiveEnabled settings"
```

---

## Task 4: Update tRPC Router

**Files:**

- Modify: `apps/worker/src/trpc/router/session-router.ts`

- [ ] **Step 1: Update input schema**

Update the `create` mutation input schema (around line 44) to change `rotationMode` enum and add `winnersTakePriority` and `maxConsecutiveEnabled` fields:

```typescript
rotationMode: z.enum(["winner-stays", "round-robin", "manual"]),
// ... existing fields
winnersTakePriority: z.boolean().default(false),
maxConsecutiveEnabled: z.boolean().default(false),
```

- [ ] **Step 2: Update computeNextLineup call**

Update the call to `computeNextLineup` in the `recordResult` mutation (around line 385) to pass the new `winnersTakePriority` and `maxConsecutiveEnabled` fields.

- [ ] **Step 3: Run tests**

Run: `bun run test -- apps/worker/test/trpc/session-router.spec.ts`
Expected: Should pass

- [ ] **Step 4: Commit**

```bash
git add apps/worker/src/trpc/router/session-router.ts
git commit -m "feat(session-router): update for new rotation settings"
```

---

## Task 5: Update Frontend Types

**Files:**

- Modify: `apps/web/src/routes/_authenticated/_sidebar/leagues/$slug/seasons/$seasonSlug/session/$sessionId/-components/session-types.ts`

- [ ] **Step 1: Update GameSession type**

Change `rotationMode` type and add new fields:

```typescript
rotationMode: "winner-stays" | "round-robin" | "manual";
winnersTakePriority: boolean;
maxConsecutiveEnabled: boolean;
```

- [ ] **Step 2: Commit**

```bash
git add "apps/web/src/routes/_authenticated/_sidebar/leagues/$slug/seasons/$seasonSlug/session/$sessionId/-components/session-types.ts"
git commit -m "feat(web): update session types for new rotation settings"
```

---

## Task 6: Update Frontend Dialog

**Files:**

- Modify: `apps/web/src/routes/_authenticated/_sidebar/leagues/$slug/seasons/-components/session/start-session-dialog.tsx`

- [ ] **Step 1: Update rotation mode options**

Replace the hard/standard winner-stays option with a toggle for `winnersTakePriority`. When `winner-stays` mode is selected, show:

- `winnersTakePriority` toggle (labeled "Winners play again" or similar)
- `maxConsecutiveEnabled` toggle with `maxConsecutiveGames` number input

- [ ] **Step 2: Commit**

```bash
git add "apps/web/src/routes/_authenticated/_sidebar/leagues/$slug/seasons/-components/session/start-session-dialog.tsx"
git commit -m "feat(web): update session dialog for new rotation settings"
```

---

## Task 7: Rewrite Rotation Tests

**Files:**

- Modify: `apps/worker/test/lib/session-rotation.spec.ts`

- [ ] **Step 1: Add new input fields to base() helper**

Update the `base()` helper function to include `winnersTakePriority: false` and `maxConsecutiveEnabled: false` by default.

- [ ] **Step 2: Rewrite tests for new queue model**

The new tests should verify:

1. **Basic queue sorting**: After a game, all players return to queue sorted by consecutiveGames ASC, then win/loss, then queuePosition

2. **Winner stays standard** (`winnersTakePriority: false`): Winners sorted above losers within same consecutiveGames tier

3. **Winner stays priority** (`winnersTakePriority: true`): Winners sorted to absolute top of queue

4. **Max consecutive soft floor**: Players with more consecutiveGames are lower in queue but still selected if queue exhausted

5. **Round robin**: Sort by consecutiveGames ASC, then queuePosition. No win/loss weight.

6. **Manual mode**: Returns empty lineup (unchanged)

7. **Coin toss**: When players tied on all keys

8. **Team assignment**: Winners stay on original side (unless autoRandomize)

- [ ] **Step 3: Run tests**

Run: `bun run test -- apps/worker/test/lib/session-rotation.spec.ts`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add apps/worker/test/lib/session-rotation.spec.ts
git commit -m "test(session): rewrite rotation tests for new queue model"
```

---

## Task 8: Run Full Verification

- [ ] **Step 1: Run typecheck**

Run: `bun typecheck`
Expected: No errors

- [ ] **Step 2: Run lint**

Run: `bun oxc`
Expected: No errors

- [ ] **Step 3: Run all session tests**

Run: `bun run test -- apps/worker/test/lib/session-rotation.spec.ts apps/worker/test/trpc/session-router.spec.ts`
Expected: All pass

- [ ] **Step 4: Commit all changes**

```bash
git add -A
git commit -m "feat(session): implement queue-as-source-of-truth rotation model"
```
