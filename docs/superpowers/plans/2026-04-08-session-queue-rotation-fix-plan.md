# Session Queue Rotation Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the winner-stays rotation so `queuePosition` is the sole selection key in `computeNextLineup`, and all priority logic (winner above loser, winnersTakePriority, maxConsecutive override) lives in `recordMatchResult` as queue position assignment.

**Architecture:** `computeNextLineup` becomes a dumb "take top N by queuePosition" function. `recordMatchResult` assigns new positions after each game: winners above losers at back (prioritize-queue mode) or winners at absolute top (prioritize-winners mode), with maxConsecutive overrides going to absolute bottom. `consecutiveGames` always increments for all playing players. `recalcQueuePositions` replays this logic to reconstruct positions after undo.

**Tech Stack:** TypeScript, Drizzle ORM, tRPC, Vitest

**Reference:** `docs/superpowers/specs/2026-03-30-session-queue-rotation-design.md`

---

## File Map

| File                                                 | Change                                                                          |
| ---------------------------------------------------- | ------------------------------------------------------------------------------- |
| `apps/worker/src/lib/session-rotation.ts`            | Simplify winner-stays to sort by `queuePosition ASC` only; remove isWinner sort |
| `apps/worker/src/repositories/session-repository.ts` | Fix `recordMatchResult` queue assignment + `recalcQueuePositions`               |
| `apps/worker/src/trpc/router/session-router.ts`      | Pass `maxConsecutiveEnabled` + `maxConsecutiveGames` to `recordMatchResult`     |
| `apps/worker/test/lib/session-rotation.spec.ts`      | Rewrite unit tests for correct queue-position-based selection                   |
| `apps/worker/test/trpc/session-router.spec.ts`       | Add integration tests for queue position assignment after result                |

---

## Task 1: Revert the consecutive-games freeze for winners

**Files:**

- Modify: `apps/worker/src/repositories/session-repository.ts:705-712`

The commit `5b879c3` made winners NOT increment `consecutiveGames` when `winnersTakePriority` is true. This is wrong — `consecutiveGames` must always increment for all playing players.

- [ ] **Step 1: Replace the conditional consecutive-games increment**

In `recordMatchResult`, find the `consecutiveCaseParts` block (around line 705) and replace:

```typescript
const consecutiveCaseParts = playingSessionPlayerIds
	.map((id) => {
		if (winnersTakePriority && winnerSessionPlayerIds.includes(id)) {
			return sql`WHEN ${sessionPlayer.id} = ${id} THEN ${sessionPlayer.consecutiveGames}`;
		}
		return sql`WHEN ${sessionPlayer.id} = ${id} THEN ${sessionPlayer.consecutiveGames} + 1`;
	})
	.reduce((acc, part) => sql`${acc} ${part}`);
```

With:

```typescript
const consecutiveCaseParts = playingSessionPlayerIds
	.map((id) => sql`WHEN ${sessionPlayer.id} = ${id} THEN ${sessionPlayer.consecutiveGames} + 1`)
	.reduce((acc, part) => sql`${acc} ${part}`);
```

- [ ] **Step 2: Run typecheck**

Run: `bun typecheck`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add apps/worker/src/repositories/session-repository.ts
git commit -m "fix(session): always increment consecutiveGames for all playing players"
```

---

## Task 2: Fix `computeNextLineup` — winner-stays sorts by queuePosition only

**Files:**

- Modify: `apps/worker/src/lib/session-rotation.ts`
- Modify: `apps/worker/test/lib/session-rotation.spec.ts`

The current winner-stays path sorts by `consecutiveGames ASC` first, then win/loss. This is wrong. Queue positions already encode priority (they were set correctly by `recordMatchResult`). Selection is always top N by `queuePosition ASC`.

- [ ] **Step 1: Write failing tests**

Replace the entire content of `apps/worker/test/lib/session-rotation.spec.ts` with:

```typescript
import { describe, expect, it } from "vitest";
import {
	type RotationInput,
	type SessionPlayerState,
	computeNextLineup,
} from "../../src/lib/session-rotation";

function makePlayer(id: string, overrides: Partial<SessionPlayerState> = {}): SessionPlayerState {
	return {
		id,
		seasonPlayerId: `sp-${id}`,
		status: "playing",
		queuePosition: 0,
		gamesPlayedThisSession: 1,
		consecutiveGames: 1,
		...overrides,
	};
}

function waiter(id: string, queuePosition: number, consecutiveGames = 0): SessionPlayerState {
	return makePlayer(id, {
		status: "waiting",
		queuePosition,
		consecutiveGames,
		gamesPlayedThisSession: 0,
	});
}

function base(overrides: Partial<RotationInput> = {}): RotationInput {
	return {
		mode: "winner-stays",
		teamSize: 1,
		maxConsecutiveGames: null,
		maxConsecutiveEnabled: false,
		winnersTakePriority: false,
		autoRandomize: false,
		alwaysSplitConstraints: [],
		players: [],
		lastResult: "home",
		homePlayerIds: [],
		awayPlayerIds: [],
		...overrides,
	};
}

function allPlayerIds(result: { homePlayerIds: string[]; awayPlayerIds: string[] }): string[] {
	return [...result.homePlayerIds, ...result.awayPlayerIds];
}

describe("No waiters → nobody rotates", () => {
	it("1v1 no waiters → rotatedOut empty", () => {
		const h1 = makePlayer("h1", { queuePosition: 0 });
		const a1 = makePlayer("a1", { queuePosition: 1 });
		const result = computeNextLineup(
			base({ teamSize: 1, players: [h1, a1], homePlayerIds: ["h1"], awayPlayerIds: ["a1"] })
		);
		expect(result.rotatedOut).toHaveLength(0);
		expect(result.coinTossNeeded).toBeNull();
	});

	it("2v2 no waiters → rotatedOut empty", () => {
		const players = [
			makePlayer("h1", { queuePosition: 0 }),
			makePlayer("h2", { queuePosition: 1 }),
			makePlayer("a1", { queuePosition: 2 }),
			makePlayer("a2", { queuePosition: 3 }),
		];
		const result = computeNextLineup(
			base({ teamSize: 2, players, homePlayerIds: ["h1", "h2"], awayPlayerIds: ["a1", "a2"] })
		);
		expect(result.rotatedOut).toHaveLength(0);
	});
});

describe("Winner-stays: select by queuePosition ASC", () => {
	it("player with highest queuePosition is rotated out regardless of consecutiveGames", () => {
		// h1 has queuePosition=3 (highest) but low consecutiveGames=1
		// w1 has queuePosition=2, w2 has queuePosition=0
		// top 2 by pos: w2(0), a1(1) → h1(3) rotated out
		const h1 = makePlayer("h1", { queuePosition: 3, consecutiveGames: 1 });
		const a1 = makePlayer("a1", { queuePosition: 1, consecutiveGames: 1 });
		const w1 = waiter("w1", 0, 0);
		const w2 = waiter("w2", 2, 0);
		const result = computeNextLineup(
			base({ teamSize: 1, players: [h1, a1, w1, w2], homePlayerIds: ["h1"], awayPlayerIds: ["a1"] })
		);
		expect(result.rotatedOut).toEqual(["h1"]);
	});

	it("player with lowest queuePosition is selected even with high consecutiveGames", () => {
		// h1: queuePosition=0, consecutiveGames=5 — wins by position
		// a1: queuePosition=1, consecutiveGames=1
		// w1: queuePosition=2, consecutiveGames=0 — lower consecutive but higher position
		const h1 = makePlayer("h1", { queuePosition: 0, consecutiveGames: 5 });
		const a1 = makePlayer("a1", { queuePosition: 1, consecutiveGames: 1 });
		const w1 = waiter("w1", 2, 0);
		const result = computeNextLineup(
			base({ teamSize: 1, players: [h1, a1, w1], homePlayerIds: ["h1"], awayPlayerIds: ["a1"] })
		);
		expect(result.rotatedOut).toHaveLength(0);
		expect(allPlayerIds(result)).toContain("h1");
	});

	it("winnersTakePriority setting does NOT affect selection order", () => {
		// h1 is winner but has queuePosition=3 — should still be rotated out
		const h1 = makePlayer("h1", { queuePosition: 3, consecutiveGames: 1 });
		const a1 = makePlayer("a1", { queuePosition: 1, consecutiveGames: 1 });
		const w1 = waiter("w1", 0, 0);
		const w2 = waiter("w2", 2, 0);
		const result = computeNextLineup(
			base({
				teamSize: 1,
				winnersTakePriority: true,
				players: [h1, a1, w1, w2],
				homePlayerIds: ["h1"],
				awayPlayerIds: ["a1"],
			})
		);
		expect(result.rotatedOut).toEqual(["h1"]);
	});
});

describe("Round robin: select by consecutiveGames ASC then queuePosition", () => {
	it("playing players with higher consecutive rotate out", () => {
		const p1 = makePlayer("p1", { status: "playing", queuePosition: 0, consecutiveGames: 1 });
		const p2 = makePlayer("p2", { status: "playing", queuePosition: 1, consecutiveGames: 1 });
		const w1 = waiter("w1", 2, 0);
		const w2 = waiter("w2", 3, 0);
		const result = computeNextLineup(
			base({
				mode: "round-robin",
				teamSize: 1,
				players: [p1, p2, w1, w2],
				homePlayerIds: ["p1"],
				awayPlayerIds: ["p2"],
			})
		);
		expect(result.rotatedOut).toContain("p1");
		expect(result.rotatedOut).toContain("p2");
		expect(result.homePlayerIds).toEqual(["w1"]);
		expect(result.awayPlayerIds).toEqual(["w2"]);
	});
});

describe("Manual mode", () => {
	it("returns empty lineup", () => {
		const result = computeNextLineup(base({ mode: "manual" }));
		expect(result.homePlayerIds).toHaveLength(0);
		expect(result.awayPlayerIds).toHaveLength(0);
		expect(result.coinTossNeeded).toBeNull();
	});
});

describe("autoRandomize", () => {
	it("all selected players are assigned to teams", () => {
		const h1 = makePlayer("h1", { queuePosition: 0 });
		const a1 = makePlayer("a1", { queuePosition: 1 });
		const w1 = waiter("w1", 2);
		const w2 = waiter("w2", 3);
		const result = computeNextLineup(
			base({
				teamSize: 2,
				autoRandomize: true,
				players: [h1, a1, w1, w2],
				homePlayerIds: ["h1"],
				awayPlayerIds: ["a1"],
			})
		);
		expect(allPlayerIds(result)).toHaveLength(4);
		expect(result.homePlayerIds).toHaveLength(2);
		expect(result.awayPlayerIds).toHaveLength(2);
	});
});

describe("Always-split constraints", () => {
	it("constrained players end up on opposite teams", () => {
		const h1 = makePlayer("h1", { queuePosition: 0 });
		const h2 = makePlayer("h2", { queuePosition: 1 });
		const a1 = makePlayer("a1", { queuePosition: 2 });
		const a2 = makePlayer("a2", { queuePosition: 3 });
		const result = computeNextLineup(
			base({
				teamSize: 2,
				players: [h1, h2, a1, a2],
				homePlayerIds: ["h1", "h2"],
				awayPlayerIds: ["a1", "a2"],
				alwaysSplitConstraints: [["sp-h1", "sp-h2"]],
			})
		);
		const h1Home = result.homePlayerIds.includes("h1");
		const h2Home = result.homePlayerIds.includes("h2");
		expect(h1Home).not.toBe(h2Home);
	});
});

describe("Out players", () => {
	it("out players are excluded from selection", () => {
		const h1 = makePlayer("h1", { queuePosition: 0 });
		const a1 = makePlayer("a1", { queuePosition: 1 });
		const out1 = makePlayer("out1", { status: "out", queuePosition: 2 });
		const w1 = waiter("w1", 3);
		const result = computeNextLineup(
			base({
				teamSize: 1,
				players: [h1, a1, out1, w1],
				homePlayerIds: ["h1"],
				awayPlayerIds: ["a1"],
			})
		);
		expect(allPlayerIds(result)).not.toContain("out1");
	});
});

describe("Draw handling", () => {
	it("draw with equal consecutive sums triggers coin toss", () => {
		const h1 = makePlayer("h1", { queuePosition: 0, consecutiveGames: 1 });
		const h2 = makePlayer("h2", { queuePosition: 1, consecutiveGames: 1 });
		const a1 = makePlayer("a1", { queuePosition: 2, consecutiveGames: 1 });
		const a2 = makePlayer("a2", { queuePosition: 3, consecutiveGames: 1 });
		const result = computeNextLineup(
			base({
				teamSize: 2,
				players: [h1, h2, a1, a2],
				lastResult: "draw",
				homePlayerIds: ["h1", "h2"],
				awayPlayerIds: ["a1", "a2"],
			})
		);
		expect(result.coinTossNeeded?.conflictType).toBe("draw-tiebreak");
	});
});
```

- [ ] **Step 2: Run tests to confirm failures**

Run: `bun run test -- apps/worker/test/lib/session-rotation.spec.ts`
Expected: "select by queuePosition" tests fail (current code sorts by `consecutiveGames`)

- [ ] **Step 3: Replace winner-stays sort in `computeNextLineup`**

In `apps/worker/src/lib/session-rotation.ts`, replace the winner-stays selection path (from the `type SortKey = {` definition through the `findTiedPlayers` call) with:

```typescript
const sorted = [...allEligible].sort((a, b) => a.queuePosition - b.queuePosition);
const selected = sorted.slice(0, slotsNeeded).map((p) => p.id);
const selectedSet = new Set(selected);
const rotatedOut = [...playingIds].filter((id) => !selectedSet.has(id));
```

Then delete the `findTiedPlayers` function at the bottom of the file (it is no longer called).

The team assignment block (`if (autoRandomize) { ... }`) stays unchanged.

- [ ] **Step 4: Run tests**

Run: `bun run test -- apps/worker/test/lib/session-rotation.spec.ts`
Expected: all pass

- [ ] **Step 5: Typecheck + lint**

Run: `bun typecheck && bun oxc`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add apps/worker/src/lib/session-rotation.ts apps/worker/test/lib/session-rotation.spec.ts
git commit -m "fix(session): computeNextLineup winner-stays selects by queuePosition ASC only"
```

---

## Task 3: Fix `recordMatchResult` queue position assignment

**Files:**

- Modify: `apps/worker/src/repositories/session-repository.ts:637-748`
- Modify: `apps/worker/src/trpc/router/session-router.ts:373-382`

Issues in current implementation:

- `winnersTakePriority: false` — puts ALL playing players at back with no winner/loser distinction
- `winnersTakePriority: true` — assigns winners to absolute positions 0, 1, ... without shifting waiting players (collision)
- `maxConsecutiveEnabled` is not passed to `recordMatchResult` at all

Correct behaviour:

**`winnersTakePriority: false`:**

- Non-override winners appended at back sorted by `consecutiveGames ASC` then `queuePosition ASC`
- Non-override losers appended after winners, same sort
- Override players (exceeded maxConsecutiveGames) appended last, sorted by `consecutiveGames DESC`

**`winnersTakePriority: true`:**

- Shift all waiting players up by `winnerCount`
- Winners assigned positions `0..W-1`
- Non-override losers appended after shifted waiting players
- Override players appended after losers

- [ ] **Step 1: Add `maxConsecutiveEnabled` and `maxConsecutiveGames` to `recordMatchResult` signature**

```typescript
export const recordMatchResult = async ({
	db,
	sessionId,
	sessionMatchId,
	result,
	matchId,
	winnersTakePriority = false,
	maxConsecutiveEnabled = false,
	maxConsecutiveGames = null,
}: {
	db: DrizzleDB;
	sessionId: string;
	sessionMatchId: string;
	result: "home" | "away" | "draw";
	matchId: string;
	winnersTakePriority?: boolean;
	maxConsecutiveEnabled?: boolean;
	maxConsecutiveGames?: number | null;
}) => {
```

- [ ] **Step 2: Replace the queue position + consecutive games assignment block**

Remove everything from `const winnerIds = ...` through the final `await tx.update(sessionPlayer).set({...})` (lines ~694-737), replacing with:

```typescript
const winnerSeasonPlayerIds =
	result === "draw" ? [] : result === "home" ? homePlayerIds : awayPlayerIds;
const loserSeasonPlayerIds =
	result === "draw" ? allPlayingIds : result === "home" ? awayPlayerIds : homePlayerIds;

const winnerSessionPlayers = playingSessionPlayers.filter((p) =>
	winnerSeasonPlayerIds.includes(p.seasonPlayerId)
);
const loserSessionPlayers = playingSessionPlayers.filter((p) =>
	loserSeasonPlayerIds.includes(p.seasonPlayerId)
);

const isOverride = (p: (typeof playingSessionPlayers)[number]) =>
	maxConsecutiveEnabled &&
	maxConsecutiveGames !== null &&
	p.consecutiveGames >= maxConsecutiveGames;

const overridePlayers = playingSessionPlayers.filter(isOverride);
const overrideIds = new Set(overridePlayers.map((p) => p.id));

const sortByConsecutiveThenQueue = (
	a: (typeof playingSessionPlayers)[number],
	b: (typeof playingSessionPlayers)[number]
) =>
	a.consecutiveGames !== b.consecutiveGames
		? a.consecutiveGames - b.consecutiveGames
		: a.queuePosition - b.queuePosition;

const orderedWinners = winnerSessionPlayers
	.filter((p) => !overrideIds.has(p.id))
	.sort(sortByConsecutiveThenQueue);
const orderedLosers = loserSessionPlayers
	.filter((p) => !overrideIds.has(p.id))
	.sort(sortByConsecutiveThenQueue);
const orderedOverrides = overridePlayers.sort((a, b) =>
	b.consecutiveGames !== a.consecutiveGames
		? b.consecutiveGames - a.consecutiveGames
		: a.queuePosition - b.queuePosition
);

const maxWaiting = maxWaitingPos?.max ?? -1;
let queueAssignments: Array<{ id: string; pos: number }>;

if (winnersTakePriority) {
	const winnerCount = orderedWinners.length;
	if (winnerCount > 0) {
		await tx
			.update(sessionPlayer)
			.set({
				queuePosition: sql`${sessionPlayer.queuePosition} + ${winnerCount}`,
				updatedAt: now,
			})
			.where(and(eq(sessionPlayer.sessionId, sessionId), eq(sessionPlayer.status, "waiting")));
	}
	const baseForBottom = maxWaiting + winnerCount + 1;
	queueAssignments = [
		...orderedWinners.map((p, i) => ({ id: p.id, pos: i })),
		...[...orderedLosers, ...orderedOverrides].map((p, i) => ({
			id: p.id,
			pos: baseForBottom + i,
		})),
	];
} else {
	const base = maxWaiting + 1;
	queueAssignments = [...orderedWinners, ...orderedLosers, ...orderedOverrides].map((p, i) => ({
		id: p.id,
		pos: base + i,
	}));
}

const consecutiveCaseParts = playingSessionPlayerIds
	.map((id) => sql`WHEN ${sessionPlayer.id} = ${id} THEN ${sessionPlayer.consecutiveGames} + 1`)
	.reduce((acc, part) => sql`${acc} ${part}`);

const queuePosCaseParts = queueAssignments
	.map(({ id, pos }) => sql`WHEN ${sessionPlayer.id} = ${id} THEN ${pos}`)
	.reduce((acc, part) => sql`${acc} ${part}`);

await tx
	.update(sessionPlayer)
	.set({
		gamesPlayedThisSession: sql`${sessionPlayer.gamesPlayedThisSession} + 1`,
		consecutiveGames: sql`CASE ${consecutiveCaseParts} END`,
		queuePosition: sql`CASE ${queuePosCaseParts} END`,
		status: "waiting",
		updatedAt: now,
	})
	.where(inArray(sessionPlayer.id, playingSessionPlayerIds));
```

- [ ] **Step 3: Pass new params from the router**

In `apps/worker/src/trpc/router/session-router.ts`, update the `recordMatchResult` call (around line 373):

```typescript
await sessionRepository.recordMatchResult({
	db: ctx.db,
	sessionId: input.sessionId,
	sessionMatchId: input.sessionMatchId,
	result,
	matchId: createdMatch.id,
	winnersTakePriority: fullSession.winnersTakePriority,
	maxConsecutiveEnabled: fullSession.maxConsecutiveEnabled,
	maxConsecutiveGames: fullSession.maxConsecutiveGames,
});
```

- [ ] **Step 4: Typecheck + lint**

Run: `bun typecheck && bun oxc`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add apps/worker/src/repositories/session-repository.ts apps/worker/src/trpc/router/session-router.ts
git commit -m "fix(session): correct recordMatchResult queue position assignment for winner-stays"
```

---

## Task 4: Fix `recalcQueuePositions`

**Files:**

- Modify: `apps/worker/src/repositories/session-repository.ts:1115-1178`

Called on undo. Must replay winner/loser queue placement per match to reconstruct positions correctly.

- [ ] **Step 1: Update session fetch to include settings**

Replace the `db.select({ rotationMode: ... })` at line 1116 with:

```typescript
const [session] = await db
	.select({
		rotationMode: gameSession.rotationMode,
		winnersTakePriority: gameSession.winnersTakePriority,
		maxConsecutiveEnabled: gameSession.maxConsecutiveEnabled,
		maxConsecutiveGames: gameSession.maxConsecutiveGames,
	})
	.from(gameSession)
	.where(eq(gameSession.id, sessionId))
	.limit(1);
```

Also update the `completedMatches` select to include `result` (it was removed in an earlier commit — verify it is present; add it if not):

```typescript
.select({
	matchNumber: sessionMatch.matchNumber,
	homePlayerIds: sessionMatch.homePlayerIds,
	awayPlayerIds: sessionMatch.awayPlayerIds,
	result: sessionMatch.result,
})
```

- [ ] **Step 2: Replace the replay loop**

Replace the `for (const match of completedMatches)` loop with:

```typescript
const consecutiveGames = new Map<string, number>(allPlayers.map((p) => [p.seasonPlayerId, 0]));

for (const match of completedMatches) {
	const home = parseStringArray(match.homePlayerIds);
	const away = parseStringArray(match.awayPlayerIds);
	const allPlaying = new Set([...home, ...away]);
	const matchResult = match.result;

	const winnerSPIds = matchResult === "draw" ? [] : matchResult === "home" ? home : away;
	const loserSPIds =
		matchResult === "draw" ? [...allPlaying] : matchResult === "home" ? away : home;

	const cgFor = (spId: string) => consecutiveGames.get(spId) ?? 0;

	const isOverride = (spId: string) =>
		!!session.maxConsecutiveEnabled &&
		session.maxConsecutiveGames !== null &&
		cgFor(spId) >= session.maxConsecutiveGames;

	const sortByConsecutiveThenQueuePos = (a: string, b: string) => {
		if (cgFor(a) !== cgFor(b)) return cgFor(a) - cgFor(b);
		return queue.indexOf(a) - queue.indexOf(b);
	};

	const overrides = [...allPlaying].filter(isOverride);
	const overrideSet = new Set(overrides);

	const orderedWinners = winnerSPIds
		.filter((id) => !overrideSet.has(id))
		.sort(sortByConsecutiveThenQueuePos);
	const orderedLosers = loserSPIds
		.filter((id) => !overrideSet.has(id))
		.sort(sortByConsecutiveThenQueuePos);
	const orderedOverrides = overrides.sort((a, b) => {
		if (cgFor(a) !== cgFor(b)) return cgFor(b) - cgFor(a);
		return queue.indexOf(a) - queue.indexOf(b);
	});

	queue = queue.filter((id) => !allPlaying.has(id));

	if (session.winnersTakePriority && orderedWinners.length > 0) {
		queue = [...orderedWinners, ...queue, ...orderedLosers, ...orderedOverrides];
	} else {
		queue = [...queue, ...orderedWinners, ...orderedLosers, ...orderedOverrides];
	}

	for (const p of allPlayers) {
		if (allPlaying.has(p.seasonPlayerId)) {
			consecutiveGames.set(p.seasonPlayerId, cgFor(p.seasonPlayerId) + 1);
		} else {
			consecutiveGames.set(p.seasonPlayerId, 0);
		}
	}
}
```

- [ ] **Step 3: Typecheck + lint**

Run: `bun typecheck && bun oxc`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add apps/worker/src/repositories/session-repository.ts
git commit -m "fix(session): recalcQueuePositions replays winner/loser placement correctly"
```

---

## Task 5: Integration tests for queue position assignment

**Files:**

- Modify: `apps/worker/test/trpc/session-router.spec.ts`

Add a `describe("queue position assignment after result")` block. Append it before the last `});` closing the top-level `describe("session router")`.

- [ ] **Step 1: Write the integration tests**

```typescript
describe("queue position assignment after result", () => {
	it("consecutiveGames increments for all playing players regardless of winnersTakePriority", async () => {
		const { client, season, seasonPlayers } = await setupSeasonWithPlayers(4);
		const session = await client.session.create.mutate({
			seasonSlug: season.slug,
			rotationMode: "winner-stays",
			teamSize: 1,
			maxConsecutiveGames: null,
			winnersTakePriority: true,
			seasonPlayerIds: seasonPlayers.map((p) => p.id),
		});
		await client.session.startNextMatch.mutate({
			sessionId: session.id,
			homeSeasonPlayerIds: [seasonPlayers[0].id],
			awaySeasonPlayerIds: [seasonPlayers[1].id],
		});
		const withMatch = await client.session.getById.query({ sessionId: session.id });
		const match = withMatch.matches.find((m) => m.result === null)!;

		const result = await client.session.recordResult.mutate({
			sessionId: session.id,
			sessionMatchId: match.id,
			homeScore: 2,
			awayScore: 0,
		});

		const playing = result.players.filter((p) =>
			[...match.homePlayerIds, ...match.awayPlayerIds].includes(p.id)
		);
		for (const p of playing) {
			expect(p.consecutiveGames).toBe(1);
		}
	});

	it("winnersTakePriority: false — winner gets lower queuePosition than loser", async () => {
		const { client, season, seasonPlayers } = await setupSeasonWithPlayers(3);
		const session = await client.session.create.mutate({
			seasonSlug: season.slug,
			rotationMode: "winner-stays",
			teamSize: 1,
			maxConsecutiveGames: null,
			winnersTakePriority: false,
			seasonPlayerIds: seasonPlayers.map((p) => p.id),
		});
		await client.session.startNextMatch.mutate({
			sessionId: session.id,
			homeSeasonPlayerIds: [seasonPlayers[0].id],
			awaySeasonPlayerIds: [seasonPlayers[1].id],
		});
		const withMatch = await client.session.getById.query({ sessionId: session.id });
		const match = withMatch.matches.find((m) => m.result === null)!;

		const result = await client.session.recordResult.mutate({
			sessionId: session.id,
			sessionMatchId: match.id,
			homeScore: 2,
			awayScore: 0,
		});

		const winner = result.players.find((p) => p.seasonPlayerId === seasonPlayers[0].id)!;
		const loser = result.players.find((p) => p.seasonPlayerId === seasonPlayers[1].id)!;
		expect(winner.queuePosition).toBeLessThan(loser.queuePosition);
	});

	it("winnersTakePriority: true — winner gets lower queuePosition than all waiting players", async () => {
		const { client, season, seasonPlayers } = await setupSeasonWithPlayers(4);
		const session = await client.session.create.mutate({
			seasonSlug: season.slug,
			rotationMode: "winner-stays",
			teamSize: 1,
			maxConsecutiveGames: null,
			winnersTakePriority: true,
			seasonPlayerIds: seasonPlayers.map((p) => p.id),
		});
		await client.session.startNextMatch.mutate({
			sessionId: session.id,
			homeSeasonPlayerIds: [seasonPlayers[0].id],
			awaySeasonPlayerIds: [seasonPlayers[1].id],
		});
		const withMatch = await client.session.getById.query({ sessionId: session.id });
		const match = withMatch.matches.find((m) => m.result === null)!;

		const result = await client.session.recordResult.mutate({
			sessionId: session.id,
			sessionMatchId: match.id,
			homeScore: 2,
			awayScore: 0,
		});

		const winner = result.players.find((p) => p.seasonPlayerId === seasonPlayers[0].id)!;
		const waiters = result.players.filter(
			(p) => p.seasonPlayerId !== seasonPlayers[0].id && p.seasonPlayerId !== seasonPlayers[1].id
		);
		for (const w of waiters) {
			expect(winner.queuePosition).toBeLessThan(w.queuePosition);
		}
	});

	it("maxConsecutiveEnabled — player at/above limit gets highest queuePosition", async () => {
		const { client, season, seasonPlayers } = await setupSeasonWithPlayers(4);
		const session = await client.session.create.mutate({
			seasonSlug: season.slug,
			rotationMode: "winner-stays",
			teamSize: 1,
			maxConsecutiveGames: 1,
			winnersTakePriority: false,
			maxConsecutiveEnabled: true,
			seasonPlayerIds: seasonPlayers.map((p) => p.id),
		});

		// Game 1: p0 vs p1, p0 wins → p0 gets cg=1
		await client.session.startNextMatch.mutate({
			sessionId: session.id,
			homeSeasonPlayerIds: [seasonPlayers[0].id],
			awaySeasonPlayerIds: [seasonPlayers[1].id],
		});
		let s = await client.session.getById.query({ sessionId: session.id });
		let m = s.matches.find((x) => x.result === null)!;
		await client.session.recordResult.mutate({
			sessionId: session.id,
			sessionMatchId: m.id,
			homeScore: 1,
			awayScore: 0,
		});

		// Game 2: auto-proposed lineup runs; p0 has cg=1 >= maxConsecutiveGames=1 → override
		await client.session.startNextMatch.mutate({ sessionId: session.id });
		s = await client.session.getById.query({ sessionId: session.id });
		m = s.matches.find((x) => x.result === null)!;
		const result = await client.session.recordResult.mutate({
			sessionId: session.id,
			sessionMatchId: m.id,
			homeScore: 1,
			awayScore: 0,
		});

		const p0 = result.players.find((p) => p.seasonPlayerId === seasonPlayers[0].id)!;
		const others = result.players.filter((p) => p.seasonPlayerId !== seasonPlayers[0].id);
		for (const other of others) {
			expect(p0.queuePosition).toBeGreaterThan(other.queuePosition);
		}
	});
});
```

- [ ] **Step 2: Run full test suite**

Run: `bun run test`
Expected: all pass

- [ ] **Step 3: Commit**

```bash
git add apps/worker/test/trpc/session-router.spec.ts
git commit -m "test(session): add integration tests for queue position assignment after result"
```

---

## Task 6: Full verification

- [ ] **Step 1: Run full test suite**

Run: `bun run test`
Expected: all pass

- [ ] **Step 2: Typecheck + lint**

Run: `bun typecheck && bun oxc`
Expected: no errors
