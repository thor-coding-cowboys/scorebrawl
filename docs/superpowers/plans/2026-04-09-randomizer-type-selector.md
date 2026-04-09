# Randomizer Type Selector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `randomizerType: "fisher-yates" | "diversity"` option when autoRandomize is enabled. Diversity shuffle prefers pairing players who haven't played together recently in the current session.

**Architecture:**

- Add `diversityShuffle` function in `session-rotation.ts` that weights player pairs by inverse co-occurrence in session matches
- Add `randomizerType` to session schema and rotation mode
- Update frontend to show select dropdown when autoRandomize is enabled

**Tech Stack:** TypeScript, Vitest, Cloudflare Workers

---

## File Map

**Backend:**

- `apps/worker/src/lib/session-rotation.ts` - Add `diversityShuffle` and `diversityShuffleWithHistory` functions
- `apps/worker/src/db/schema/league-schema.ts` - Add `randomizerType` field to gameSession
- `apps/worker/src/repositories/session-repository.ts` - Include `randomizerType` in session creation
- `apps/worker/src/trpc/router/session-router.ts` - Add `randomizerType` to createSession input, update computeNextLineup call sites
- `apps/worker/test/lib/session-rotation.spec.ts` - Add tests for diversity shuffle

**Frontend:**

- `apps/web/src/routes/_authenticated/_sidebar/leagues/$slug/seasons/-components/session/start-session-dialog.tsx` - Add randomizerType select

**Migrations:**

- `apps/worker/migrations/` - New migration for `randomizer_type` column

---

## Tasks

### Task 1: Add diversityShuffle function to session-rotation.ts

**Files:**

- Modify: `apps/worker/src/lib/session-rotation.ts`

- [ ] **Step 1: Write failing test for diversityShuffle**

Add to `apps/worker/test/lib/session-rotation.spec.ts`:

```typescript
describe("diversityShuffle", () => {
	it("produces different distribution than fisherYates", () => {
		const items = ["a", "b", "c", "d"];

		// Fisher-Yates should cluster certain pairs more often
		const fisherPairs = new Map<string, number>();
		for (let i = 0; i < 1000; i++) {
			const shuffled = fisherYatesShuffle([...items]);
			// Count adjacent pairs
			for (let j = 0; j < shuffled.length - 1; j++) {
				const pair = [shuffled[j], shuffled[j + 1]].sort().join("|");
				fisherPairs.set(pair, (fisherPairs.get(pair) || 0) + 1);
			}
		}

		// Diversity should distribute pairs more evenly
		const pairWeights = new Map<string, number>();
		const diversityPairs = new Map<string, number>();
		for (let i = 0; i < 1000; i++) {
			const shuffled = diversityShuffle([...items], pairWeights, (a, b) => {
				const key = [a, b].sort().join("|");
				return pairWeights.get(key) || 0;
			});
			for (let j = 0; j < shuffled.length - 1; j++) {
				const pair = [shuffled[j], shuffled[j + 1]].sort().join("|");
				diversityPairs.set(pair, (diversityPairs.get(pair) || 0) + 1);
			}
		}

		// Check diversity has lower max pair count (more even distribution)
		const fisherMax = Math.max(...fisherPairs.values());
		const diversityMax = Math.max(...diversityPairs.values());
		expect(diversityMax).toBeLessThan(fisherMax);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/worker && bun run test -- --grep "diversityShuffle"`
Expected: FAIL with "diversityShuffle not defined"

- [ ] **Step 3: Implement diversityShuffle in session-rotation.ts**

Add after `fisherYatesShuffle`:

```typescript
function diversityShuffle<T>(
	items: T[],
	pairWeights: Map<string, number>,
	getWeight: (a: T, b: T) => number
): T[] {
	const result: T[] = [];
	const remaining = [...items];

	while (remaining.length > 0) {
		const lastAdded = result[result.length - 1];

		// Score each remaining item by total weight against already-placed items
		const scored = remaining.map((item) => {
			let totalWeight = 0;
			for (const placed of result) {
				const key = [item, placed].sort().join("|");
				totalWeight += pairWeights.get(key) || 0;
			}
			// Lower accumulated weight = more diverse = higher chance
			return { item, score: totalWeight };
		});

		// Weighted random selection - prefer lower score (more diverse)
		const totalScore = scored.reduce((sum, s) => sum + s.score + 1, 0);
		let random = Math.random() * totalScore;
		let selected = scored[0];

		for (const s of scored) {
			random -= s.score + 1;
			if (random <= 0) {
				selected = s;
				break;
			}
		}

		result.push(selected.item);
		remaining.splice(remaining.indexOf(selected.item), 1);
	}

	return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/worker && bun run test -- --grep "diversityShuffle"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/worker/src/lib/session-rotation.ts apps/worker/test/lib/session-rotation.spec.ts
git commit -m "feat(session): add diversityShuffle function"
```

---

### Task 2: Add randomizerType to schema and migrations

**Files:**

- Modify: `apps/worker/src/db/schema/league-schema.ts`
- Create: `apps/worker/migrations/0015_20260409000000_add_randomizer_type.sql`

- [ ] **Step 1: Add randomizerType to gameSession schema**

In `apps/worker/src/db/schema/league-schema.ts`, add to gameSession table after `autoCoinToss`:

```typescript
randomizerType: text("randomizer_type", {
  enum: ["fisher-yates", "diversity"]
}).default("fisher-yates").notNull(),
```

- [ ] **Step 2: Create migration**

Create `apps/worker/migrations/0015_20260409000000_add_randomizer_type.sql`:

```sql
ALTER TABLE `game_session` ADD `randomizer_type` text DEFAULT 'fisher-yates' NOT NULL;
```

- [ ] **Step 3: Run migration locally**

```bash
cd apps/worker && bun run db:migrate
```

- [ ] **Step 4: Commit**

```bash
git add apps/worker/src/db/schema/league-schema.ts apps/worker/migrations/0015_add_randomizer_type.sql
git commit -m "feat(session): add randomizerType column to game_session"
```

---

### Task 3: Update session repository and router

**Files:**

- Modify: `apps/worker/src/repositories/session-repository.ts`
- Modify: `apps/worker/src/trpc/router/session-router.ts`

- [ ] **Step 1: Add randomizerType to createSession input**

In `apps/worker/src/repositories/session-repository.ts`, find `createSession` input type and add:

```typescript
randomizerType?: "fisher-yates" | "diversity";
```

- [ ] **Step 2: Pass randomizerType to insert**

In the insert statement, add:

```typescript
randomizerType: input.randomizerType ?? "fisher-yates",
```

- [ ] **Step 3: Update tRPC router input**

In `apps/worker/src/trpc/router/session-router.ts`, add to create input:

```typescript
randomizerType: z.enum(["fisher-yates", "diversity"]).default("fisher-yates"),
```

- [ ] **Step 4: Commit**

```bash
git add apps/worker/src/repositories/session-repository.ts apps/worker/src/trpc/router/session-router.ts
git commit -m "feat(session): support randomizerType in session creation"
```

---

### Task 4: Update computeNextLineup to use randomizerType

**Files:**

- Modify: `apps/worker/src/lib/session-rotation.ts`

- [ ] **Step 1: Add matchHistory and randomizerType to RotationInput**

```typescript
export interface RotationInput {
	// ... existing fields
	randomizerType?: "fisher-yates" | "diversity";
	matchHistory?: Array<{ homePlayerIds: string[]; awayPlayerIds: string[] }>;
}
```

- [ ] **Step 2: Modify autoRandomize logic in computeNextLineup**

Find the autoRandomize block and update:

```typescript
if (autoRandomize) {
	const allPlaying =
		input.randomizerType === "diversity" && input.matchHistory
			? diversityShuffleWithHistory([...homePlayerIds, ...awayPlayerIds], input.matchHistory)
			: fisherYatesShuffle([...homePlayerIds, ...awayPlayerIds]);
	// ... rest unchanged
}
```

Add helper after `fisherYatesShuffle`:

```typescript
function diversityShuffleWithHistory(
	playerIds: string[],
	matchHistory: Array<{ homePlayerIds: string[]; awayPlayerIds: string[] }>
): string[] {
	const pairWeights = new Map<string, number>();

	for (const match of matchHistory) {
		const allPlayers = [...match.homePlayerIds, ...match.awayPlayerIds];
		for (let i = 0; i < allPlayers.length; i++) {
			for (let j = i + 1; j < allPlayers.length; j++) {
				const key = [allPlayers[i], allPlayers[j]].sort().join("|");
				pairWeights.set(key, (pairWeights.get(key) || 0) + 1);
			}
		}
	}

	return diversityShuffle(playerIds, pairWeights, (a, b) => {
		const key = [a, b].sort().join("|");
		return pairWeights.get(key) || 0;
	});
}
```

- [ ] **Step 3: Update computeNextLineup call sites in session-router.ts**

Find all places that call `computeNextLineup` (likely in `recordResult`, `removePlayer`, `resolveCoinToss`) and add to the input:

```typescript
randomizerType: fullSession.randomizerType as "fisher-yates" | "diversity",
matchHistory: fullSession.matches.map(m => ({
  homePlayerIds: parseStringArray(m.homePlayerIds),
  awayPlayerIds: parseStringArray(m.awayPlayerIds)
})),
```

- [ ] **Step 2: Modify autoRandomize logic to use diversity when selected**

Find the autoRandomize block in `computeNextLineup` and update:

```typescript
if (autoRandomize) {
	const allPlaying =
		input.randomizerType === "diversity" && input.matchHistory
			? diversityShuffleWithHistory([...homePlayerIds, ...awayPlayerIds], input.matchHistory)
			: fisherYatesShuffle([...homePlayerIds, ...awayPlayerIds]);
	// ... rest unchanged
}
```

Add helper:

```typescript
function diversityShuffleWithHistory(
	playerIds: string[],
	matchHistory: Array<{ homePlayerIds: string[]; awayPlayerIds: string[] }>
): string[] {
	// Build pair weights from history
	const pairWeights = new Map<string, number>();

	for (const match of matchHistory) {
		const allPlayers = [...match.homePlayerIds, ...match.awayPlayerIds];
		for (let i = 0; i < allPlayers.length; i++) {
			for (let j = i + 1; j < allPlayers.length; j++) {
				const key = [allPlayers[i], allPlayers[j]].sort().join("|");
				pairWeights.set(key, (pairWeights.get(key) || 0) + 1);
			}
		}
	}

	return diversityShuffle(playerIds, pairWeights, (a, b) => {
		const key = [a, b].sort().join("|");
		return pairWeights.get(key) || 0;
	});
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/worker/src/lib/session-rotation.ts
git commit -m "feat(session): integrate randomizerType into computeNextLineup"
```

---

### Task 5: Update frontend start-session-dialog

**Files:**

- Modify: `apps/web/src/routes/_authenticated/_sidebar/leagues/$slug/seasons/-components/session/start-session-dialog.tsx`

- [ ] **Step 1: Add randomizerType state and UI**

Add to `DialogState`:

```typescript
randomizerType: "fisher-yates" | "diversity";
```

Add to `initialState`:

```typescript
randomizerType: "fisher-yates",
```

Add action type:

```typescript
| { type: "SET_RANDOMIZER_TYPE"; value: "fisher-yates" | "diversity" }
```

Add reducer case:

```typescript
case "SET_RANDOMIZER_TYPE":
  return { ...state, randomizerType: action.value };
```

- [ ] **Step 2: Add UI control**

After the `autoRandomize` toggle, conditionally show:

```tsx
{
	state.autoRandomize && (
		<div className="flex items-center gap-2">
			<Label>Randomizer</Label>
			<Select
				value={state.randomizerType}
				onValueChange={(v) =>
					dispatch({
						type: "SET_RANDOMIZER_TYPE",
						value: v as "fisher-yates" | "diversity",
					})
				}
			>
				<SelectTrigger className="w-32">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="fisher-yates">Fisher-Yates</SelectItem>
					<SelectItem value="diversity">Diversity</SelectItem>
				</SelectContent>
			</Select>
		</div>
	);
}
```

- [ ] **Step 3: Add to mutation call**

In `handleSubmit`, add to the mutate call:

```typescript
randomizerType: state.randomizerType,
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/routes/_authenticated/_sidebar/leagues/\$slug/seasons/-components/session/start-session-dialog.tsx
git commit -m "feat(session): add randomizerType selector UI"
```

---

### Task 6: Run full verification

- [ ] **Step 1: Typecheck**

```bash
bun typecheck
```

- [ ] **Step 2: Run tests**

```bash
cd apps/worker && bun run test
```

- [ ] **Step 3: Lint**

```bash
bun oxc
```

---

## Summary

1. Add `diversityShuffle` function (with tests)
2. Add `randomizerType` column to schema with migration
3. Update repository and router to handle `randomizerType`
4. Integrate `randomizerType` into `computeNextLineup`
5. Add UI selector in `start-session-dialog`
6. Full verification (typecheck, tests, lint)
