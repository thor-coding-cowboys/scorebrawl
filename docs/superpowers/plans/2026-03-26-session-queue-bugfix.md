# Session Queue Bug Fix - Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans to implement.

**Goal:** Fix two bugs in session queue management: (1) winner-stays-hard mode incorrectly moves winners to back of queue, (2) undoing a match doesn't recalculate queue positions.

**Architecture:**

- Modify `recordMatchResult()` to preserve winner state in winner-stays modes
- Add `recalcQueuePositions()` function that recomputes queue from match history (similar to existing `recalcConsecutiveGames()`)
- Call `recalcQueuePositions()` in `deleteLastMatch()` after undo

**Tech Stack:** Drizzle ORM, SQLite, TypeScript

---

## Task 1: Fix `recordMatchResult()` for winner-stays-hard

**Files:**

- Modify: `apps/worker/src/repositories/session-repository.ts:631-718`
- Modify: `apps/worker/src/trpc/router/session-router.ts` (caller - may need session info passed)

- [ ] **Step 1: Read the current `recordMatchResult` function completely**

```bash
read apps/worker/src/repositories/session-repository.ts:631-718
```

- [ ] **Step 2: Modify `recordMatchResult` to accept `rotationMode` and handle winner-stays-hard**

The key insight: for winner-stays-hard, winners should NOT get their queuePosition updated and should keep `status: "playing"`. Only losers should move to end of queue with `status: "waiting"`.

```typescript
// In recordMatchResult, add rotationMode parameter and result
export const recordMatchResult = async ({
	db,
	sessionId,
	sessionMatchId,
	result,
	matchId,
	rotationMode, // NEW - need to pass this
}: {
	db: DrizzleDB;
	sessionId: string;
	sessionMatchId: string;
	result: "home" | "away" | "draw";
	matchId: string;
	rotationMode?: "standard" | "winner-stays" | "winner-stays-hard" | "round-robin";
}) => {
	// ... existing match result update code ...

	// Determine winner/loser IDs based on result
	let winnerIds: string[];
	let loserIds: string[];

	if (result === "draw") {
		// In draw, no one is winner/loser for rotation purposes
		winnerIds = [];
		loserIds = allPlayingIds;
	} else {
		const winnerPlayerIds = result === "home" ? homePlayerIds : awayPlayerIds;
		const loserPlayerIds = result === "home" ? awayPlayerIds : homePlayerIds;
		winnerIds = playingSessionPlayers
			.filter((p) => winnerPlayerIds.includes(p.seasonPlayerId))
			.map((p) => p.id);
		loserIds = playingSessionPlayers
			.filter((p) => loserPlayerIds.includes(p.seasonPlayerId))
			.map((p) => p.id);
	}

	const now = new Date();

	// For winner-stays-hard: winners keep position and status, losers rotate
	if (rotationMode === "winner-stays-hard") {
		// Losers: update queue position to end, set status to waiting
		if (loserIds.length > 0) {
			const loserCaseParts = loserIds
				.map((id, i) => sql`WHEN ${sessionPlayer.id} = ${id} THEN ${baseQueuePos + i}`)
				.reduce((acc, part) => sql`${acc} ${part}`);

			await tx
				.update(sessionPlayer)
				.set({
					gamesPlayedThisSession: sql`${sessionPlayer.gamesPlayedThisSession} + 1`,
					consecutiveGames: sql`CASE ${consecutiveCaseParts} END`,
					queuePosition: sql`CASE ${loserCaseParts} END`,
					status: "waiting",
					updatedAt: now,
				})
				.where(inArray(sessionPlayer.id, loserIds));
		}

		// Winners: increment consecutiveGames, keep queuePosition and status
		if (winnerIds.length > 0) {
			const winnerConsecutiveParts = winnerIds
				.map(
					(id) => sql`WHEN ${sessionPlayer.id} = ${id} THEN ${sessionPlayer.consecutiveGames} + 1`
				)
				.reduce((acc, part) => sql`${acc} ${part}`);

			await tx
				.update(sessionPlayer)
				.set({
					gamesPlayedThisSession: sql`${sessionPlayer.gamesPlayedThisSession} + 1`,
					consecutiveGames: sql`CASE ${winnerConsecutiveParts} END`,
					updatedAt: now,
				})
				.where(inArray(sessionPlayer.id, winnerIds));
		}
	} else {
		// Standard behavior: all players go to end of queue
		// ... existing code ...
	}
};
```

- [ ] **Step 3: Update the caller in session-router.ts to pass rotationMode**

Find where `recordMatchResult` is called and add `rotationMode` parameter.

```bash
grep -n "recordMatchResult" apps/worker/src/trpc/router/session-router.ts
```

- [ ] **Step 4: Verify the change compiles**

```bash
cd apps/worker && bun oxc && bun typecheck
```

---

## Task 2: Add `recalcQueuePositions()` function

**Files:**

- Modify: `apps/worker/src/repositories/session-repository.ts`

- [ ] **Step 1: Read `recalcConsecutiveGames()` for reference pattern (lines 992-1082)**

- [ ] **Step 2: Add `recalcQueuePositions()` function after `recalcConsecutiveGames()`**

The algorithm:

1. Get all completed matches in order (matchNumber ASC)
2. Get all players with their initial queue positions (from joinedAt order)
3. For each match, determine who played and who won
4. Based on rotation mode, compute resulting queue positions
5. After processing all matches, batch update queue positions

```typescript
async function recalcQueuePositions(db: DrizzleDB | TransactionClient, sessionId: string) {
	// Get session rotation mode
	const [session] = await db
		.select({ rotationMode: gameSession.rotationMode })
		.from(gameSession)
		.where(eq(gameSession.id, sessionId))
		.limit(1);

	if (!session) return;

	// Get all completed matches in order
	const completedMatches = await db
		.select({
			matchNumber: sessionMatch.matchNumber,
			homePlayerIds: sessionMatch.homePlayerIds,
			awayPlayerIds: sessionMatch.awayPlayerIds,
			result: sessionMatch.result,
		})
		.from(sessionMatch)
		.where(and(eq(sessionMatch.sessionId, sessionId), isNotNull(sessionMatch.result)))
		.orderBy(asc(sessionMatch.matchNumber));

	if (completedMatches.length === 0) return;

	// Get all players ordered by joinedAt (initial queue order)
	const allPlayers = await db
		.select({
			id: sessionPlayer.id,
			seasonPlayerId: sessionPlayer.seasonPlayerId,
			queuePosition: sessionPlayer.queuePosition,
			joinedAt: sessionPlayer.joinedAt,
		})
		.from(sessionPlayer)
		.where(eq(sessionPlayer.sessionId, sessionId))
		.orderBy(asc(sessionPlayer.joinedAt));

	if (allPlayers.length === 0) return;

	// Initialize queue with players in joinedAt order
	const queue: string[] = allPlayers.map((p) => p.seasonPlayerId);
	const playerMap = new Map(allPlayers.map((p) => [p.seasonPlayerId, p.id]));

	// Process each match to compute final queue state
	for (const match of completedMatches) {
		const home = parseStringArray(match.homePlayerIds);
		const away = parseStringArray(match.awayPlayerIds);
		const allPlaying = [...home, ...away];
		const result = match.result;

		if (session.rotationMode === "winner-stays-hard") {
			// Winners stay at front (keep their positions relative to each other)
			// Losers go to back
			const winners = result === "draw" ? [] : result === "home" ? home : away;
			const losers = result === "draw" ? allPlaying : result === "home" ? away : home;

			// Remove losers from queue, add to end
			for (const loser of losers) {
				const idx = queue.indexOf(loser);
				if (idx !== -1) queue.splice(idx, 1);
				queue.push(loser);
			}
		} else {
			// Standard rotation: all playing go to back
			for (const playerId of allPlaying) {
				const idx = queue.indexOf(playerId);
				if (idx !== -1) queue.splice(idx, 1);
				queue.push(playerId);
			}
		}
	}

	// Batch update queue positions
	const updates = new Map<number, string[]>();
	queue.forEach((seasonPlayerId, index) => {
		const playerId = playerMap.get(seasonPlayerId);
		if (playerId) {
			const existing = updates.get(index);
			if (existing) {
				existing.push(playerId);
			} else {
				updates.set(index, [playerId]);
			}
		}
	});

	const now = new Date();
	for (const [position, ids] of updates) {
		await db
			.update(sessionPlayer)
			.set({ queuePosition: position, updatedAt: now })
			.where(inArray(sessionPlayer.id, ids));
	}
}
```

- [ ] **Step 3: Call `recalcQueuePositions()` in `deleteLastMatch()` after `recalcConsecutiveGames()`**

Add line 846 after `await recalcConsecutiveGames(tx, sessionId);`:

```typescript
await recalcQueuePositions(tx, sessionId);
```

- [ ] **Step 4: Verify the change compiles**

```bash
cd apps/worker && bun oxc && bun typecheck
```

---

## Task 3: Test the changes

**Files:**

- Test: `apps/worker/src/test/trpc/` (existing test patterns)

- [ ] **Step 1: Check existing session tests for patterns**

```bash
ls apps/worker/src/test/trpc/
```

- [ ] **Step 2: Create or extend test for winner-stays-hard queue behavior**

Reference `apps/worker/src/test/setup/` for helpers.

- [ ] **Step 3: Run tests**

```bash
cd apps/worker && bun run test
```

---

## Unresolved Questions

1. Does `rotationMode` need to be passed to `recordMatchResult()` or can we fetch it inside the function from the session?
2. For winner-stays (non-hard), should we also preserve winner queue positions?
3. Should we also handle `maxConsecutiveGames` in `recordMatchResult` for winner-stays-hard - i.e., if a winner is at the limit, they should rotate out even if they won?
