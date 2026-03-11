# Session System Fixes Implementation Plan

> **Goal:** Fix three critical issues: (1) allow removing any player from sessions with proper recalculation, (2) fix max consecutive games displacement to always force out players who reach the limit, (3) place new players at the top of the waiting queue instead of the bottom.

**Architecture:**

- Modify `addPlayerToSession` to insert at position 0 instead of max+1
- Fix `computeNextLineup` to ensure ALL forced winners (players >= maxConsecutiveGames) are rotated out, not just N of them
- Extend `removePlayerFromSession` to handle playing players by ending their current match participation
- Update router to recalculate proposed lineup after player removal

**Tech Stack:** TypeScript, tRPC, Drizzle ORM, Vitest

---

## Issue 1: Allow Removing Any Player (Including Playing)

### Task 1.1: Update `removePlayerFromSession` Repository Function

**Files:**

- Modify: `apps/worker/src/repositories/session-repository.ts:324-368`

**Changes:**

- Remove the check that blocks removal of playing players
- When removing a playing player, update the current match to reflect their absence
- Set status to "out" regardless of current status
- Recalculate queue positions if player was waiting

**Implementation:**

```typescript
export const removePlayerFromSession = async ({
	db,
	sessionId,
	sessionPlayerId,
}: {
	db: DrizzleDB;
	sessionId: string;
	sessionPlayerId: string;
}) => {
	const [target] = await db
		.select()
		.from(sessionPlayer)
		.where(and(eq(sessionPlayer.id, sessionPlayerId), eq(sessionPlayer.sessionId, sessionId)))
		.limit(1);

	if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Session player not found" });

	// Don't allow removing already removed players
	if (target.status === "out") {
		throw new TRPCError({ code: "BAD_REQUEST", message: "Player already removed from session" });
	}

	await db
		.update(sessionPlayer)
		.set({ status: "out", updatedAt: new Date() })
		.where(eq(sessionPlayer.id, sessionPlayerId));

	// If player was waiting, shift queue positions
	if (target.status === "waiting") {
		await db
			.update(sessionPlayer)
			.set({
				queuePosition: sql`${sessionPlayer.queuePosition} - 1`,
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(sessionPlayer.sessionId, sessionId),
					eq(sessionPlayer.status, "waiting"),
					gt(sessionPlayer.queuePosition, target.queuePosition)
				)
			);
	}

	return target;
};
```

### Task 1.2: Add `endMatchForPlayer` Repository Function

**Files:**

- Create: `apps/worker/src/repositories/session-repository.ts` (add after removePlayerFromSession)

**Purpose:** When a playing player is removed, we need to handle the current match:

- Update sessionMatch to mark them as not playing
- Update queue positions to put removed player at end (they're out now)
- Handle case where match can't continue (too few players)

**Implementation:**

```typescript
export const handlePlayerRemovalFromMatch = async ({
	db,
	sessionId,
	sessionPlayerId,
}: {
	db: DrizzleDB;
	sessionId: string;
	sessionPlayerId: string;
}) => {
	return withTransaction(db, async (tx) => {
		// Find the current active match for this session
		const [activeMatch] = await tx
			.select()
			.from(sessionMatch)
			.where(and(eq(sessionMatch.sessionId, sessionId), eq(sessionMatch.result, null)))
			.limit(1);

		if (!activeMatch) {
			// No active match, nothing to do
			return null;
		}

		// Get the session player's seasonPlayerId to find in match arrays
		const [player] = await tx
			.select()
			.from(sessionPlayer)
			.where(eq(sessionPlayer.id, sessionPlayerId))
			.limit(1);

		if (!player) return null;

		const seasonPlayerId = player.seasonPlayerId;
		const homeIds = parseStringArray(activeMatch.homePlayerIds);
		const awayIds = parseStringArray(activeMatch.awayPlayerIds);

		// Check if player is in this match
		const inHome = homeIds.includes(seasonPlayerId);
		const inAway = awayIds.includes(seasonPlayerId);

		if (!inHome && !inAway) {
			// Player not in this match
			return null;
		}

		// Remove player from the match
		const newHomeIds = homeIds.filter((id) => id !== seasonPlayerId);
		const newAwayIds = awayIds.filter((id) => id !== seasonPlayerId);

		// If removing this player leaves a team with 0 players, we need to handle it
		const minPlayersPerTeam = 1; // Or get from session config

		if (newHomeIds.length === 0 || newAwayIds.length === 0) {
			// Can't continue match - cancel it
			await tx.delete(sessionMatch).where(eq(sessionMatch.id, activeMatch.id));

			// Reset all playing players to waiting
			await tx
				.update(sessionPlayer)
				.set({ status: "waiting", updatedAt: new Date() })
				.where(and(eq(sessionPlayer.sessionId, sessionId), eq(sessionPlayer.status, "playing")));

			return { matchCancelled: true };
		}

		// Update match with new lineups
		await tx
			.update(sessionMatch)
			.set({
				homePlayerIds: JSON.stringify(newHomeIds),
				awayPlayerIds: JSON.stringify(newAwayIds),
				updatedAt: new Date(),
			})
			.where(eq(sessionMatch.id, activeMatch.id));

		return { matchUpdated: true, newHomeIds, newAwayIds };
	});
};
```

### Task 1.3: Update Router to Handle Playing Player Removal

**Files:**

- Modify: `apps/worker/src/trpc/router/session-router.ts:195-211`

**Changes:**

- After removing player, check if they were playing
- If playing, call handlePlayerRemovalFromMatch
- Recalculate proposed lineup after removal
- Broadcast updated session state

**Implementation:**

```typescript
removePlayer: leagueMemberProcedure
  .input(z.object({ sessionId: z.string(), sessionPlayerId: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const sessionInfo = await getSessionForOrg(ctx.db, input.sessionId, ctx.organizationId);

    const removedPlayer = await sessionRepository.removePlayerFromSession({
      db: ctx.db,
      sessionId: input.sessionId,
      sessionPlayerId: input.sessionPlayerId,
    });

    // If player was playing, handle match adjustments
    if (removedPlayer.status === "playing") {
      await sessionRepository.handlePlayerRemovalFromMatch({
        db: ctx.db,
        sessionId: input.sessionId,
        sessionPlayerId: input.sessionPlayerId,
      });
    }

    // Recalculate proposed lineup if session is active
    const fullSession = await sessionRepository.getSessionById({
      db: ctx.db,
      sessionId: input.sessionId,
    });

    if (fullSession && fullSession.status === "active" && fullSession.matches.length > 0) {
      const lastMatch = fullSession.matches[fullSession.matches.length - 1];
      if (lastMatch && lastMatch.result) {
        // Last match has result, compute next lineup
        const proposedLineup = computeNextLineup({
          mode: fullSession.rotationMode,
          teamSize: fullSession.teamSize,
          maxConsecutiveGames: fullSession.maxConsecutiveGames,
          alwaysSplitConstraints: fullSession.alwaysSplitConstraints,
          players: fullSession.players,
          lastResult: lastMatch.result,
          homePlayerIds: lastMatch.homePlayerIds,
          awayPlayerIds: lastMatch.awayPlayerIds,
        });

        await sessionRepository.updateProposedLineup({
          db: ctx.db,
          sessionId: input.sessionId,
          proposedLineup,
        });
      }
    }

    await broadcastSeasonEvent(ctx.env, ctx.organizationId, sessionInfo.seasonSlug, {
      type: "session:update",
      data: { sessionId: input.sessionId, removedSessionPlayerId: input.sessionPlayerId },
      user: { id: ctx.authentication.user.id, name: ctx.authentication.user.name },
    });
  }),
```

---

## Issue 2: Fix Max Consecutive Games Displacement

### Task 2.1: Modify `computeNextLineup` to Always Force Out Maxed Players

**Files:**

- Modify: `apps/worker/src/lib/session-rotation.ts:206-328`

**Problem:** Current logic only displaces N players (where N = waiting queue size). If there are more forced winners than N, some players who've reached maxConsecutiveGames stay in.

**Solution:** Force out ALL players >= maxConsecutiveGames, then fill remaining slots from the waiting queue (if any left).

**Implementation Changes:**

In the `winner-stays` mode section (around line 206), change the displacement logic:

```typescript
// Lines 206-215 - Current logic
const forcedWinners =
	maxConsecutiveGames !== null
		? winnerStates.filter((p) => p.consecutiveGames >= maxConsecutiveGames)
		: [];

const remainingWinners = winnerStates.filter((p) => !forcedWinners.includes(p));
const displacementList = [...forcedWinners, ...loserStates, ...remainingWinners];

// Change to: Always include ALL forced winners in displaced set
const mustDisplace = new Set(forcedWinners.map((p) => p.id));

// Calculate how many additional players need to be displaced
const minPlayersNeeded = teamSize * 2;
const currentPlayers = winnerStates.length + loserStates.length;
const availableWaiters = waitingQueue.length;

// We need to displace enough players to make room for waiters
// But we MUST displace all forced winners regardless
const requiredDisplacements = Math.min(availableWaiters, currentPlayers - mustDisplace.size);

// Build displacement list: forced winners first, then losers by priority, then winners
const displacementCandidates = [...loserStates, ...remainingWinners].filter(
	(p) => !mustDisplace.has(p.id)
);

const additionalDisplacements = displacementCandidates.slice(0, requiredDisplacements);
const displaced = new Set([...mustDisplace, ...additionalDisplacements.map((p) => p.id)]);
```

Then update the team building logic to handle the case where we might not have enough players:

```typescript
// Lines 303-315 - Survivors and team building
const survivingLosers = loserStates.filter((p) => !displaced.has(p.id));
const survivingWinners = winnerStates.filter((p) => !displaced.has(p.id));

// Build teams
const winnerTeam = [...survivingWinners.map((p) => p.id)];
const opposingPool = [...waitingQueue.map((p) => p.id), ...survivingLosers.map((p) => p.id)];

// Promote from opposing pool to winner team if it's short
while (winnerTeam.length < teamSize && opposingPool.length > 0) {
	winnerTeam.push(opposingPool.shift()!); // Use shift to take from front (queue order)
}

// If we don't have enough for opposing team, just use what we have
const opposingTeam = opposingPool.slice(0, teamSize);

// Handle edge case: not enough total players
if (winnerTeam.length + opposingTeam.length < minPlayersNeeded) {
	// Return empty lineup - can't form complete teams
	return {
		homePlayerIds: [],
		awayPlayerIds: [],
		rotatedOut: [...displaced],
		coinTossNeeded: null,
	};
}
```

### Task 2.2: Update Coin Toss Logic for Forced Winners

**Files:**

- Modify: `apps/worker/src/lib/session-rotation.ts:217-298`

**Changes:** The coin toss logic needs to account for the fact that forced winners are always displaced. Remove the check for coin tosses among forced winners since they're all displaced anyway.

---

## Issue 3: New Players Go to Top of Queue

### Task 3.1: Modify `addPlayerToSession` to Insert at Position 0

**Files:**

- Modify: `apps/worker/src/repositories/session-repository.ts:276-322`

**Changes:**

- Instead of adding at max position + 1, add at position 0
- Shift all existing waiting players down by 1

**Implementation:**

```typescript
export const addPlayerToSession = async ({
	db,
	sessionId,
	seasonPlayerId,
}: {
	db: DrizzleDB;
	sessionId: string;
	seasonPlayerId: string;
}) => {
	const existing = await db
		.select()
		.from(sessionPlayer)
		.where(
			and(eq(sessionPlayer.sessionId, sessionId), eq(sessionPlayer.seasonPlayerId, seasonPlayerId))
		)
		.limit(1);

	if (existing.length > 0) {
		throw new TRPCError({ code: "CONFLICT", message: "Player already in session" });
	}

	// Shift all existing waiting players down by 1 to make room at position 0
	await db
		.update(sessionPlayer)
		.set({
			queuePosition: sql`${sessionPlayer.queuePosition} + 1`,
			updatedAt: new Date(),
		})
		.where(and(eq(sessionPlayer.sessionId, sessionId), eq(sessionPlayer.status, "waiting")));

	const now = new Date();

	const [newPlayer] = await db
		.insert(sessionPlayer)
		.values({
			id: newId("sessionPlayer"),
			sessionId,
			seasonPlayerId,
			status: "waiting",
			queuePosition: 0, // New player goes to the front of the queue
			gamesPlayedThisSession: 0,
			consecutiveGames: 0,
			joinedAt: now,
			createdAt: now,
			updatedAt: now,
		})
		.returning();

	return newPlayer;
};
```

---

## Testing

### Task 4.1: Write Tests for Max Consecutive Games Fix

**Files:**

- Create/Modify: `apps/worker/test/lib/session-rotation.spec.ts`

**Test Cases:**

1. **All forced winners displaced**: With maxConsecutiveGames=3, 5 total players (2v2), 2 players at 3+ consecutive games - both should be displaced even if only 1 waiter
2. **Priority ordering**: Forced winners > losers > winners in displacement priority
3. **Edge case - not enough players**: When displacing forced winners leaves < 4 players, return empty lineup

### Task 4.2: Write Tests for Player Removal

**Files:**

- Create/Modify: `apps/worker/test/trpc/session-router.spec.ts`

**Test Cases:**

1. **Remove waiting player**: Status changes to "out", queue positions updated
2. **Remove playing player**: Match updated, player status "out"
3. **Remove playing player when it cancels match**: Match deleted, all players reset to waiting
4. **Recalculation after removal**: Proposed lineup recomputed correctly

### Task 4.3: Write Tests for New Player Queue Position

**Files:**

- Create/Modify: `apps/worker/test/trpc/session-router.spec.ts`

**Test Cases:**

1. **New player at position 0**: When added to session with existing waiting players
2. **Queue shifts correctly**: Existing waiting players all increase position by 1
3. **Integration with rotation**: New player gets priority in next lineup calculation

---

## Verification Steps

After implementing all changes:

1. **Run tests**: `bun run test`
2. **Type check**: `bun typecheck`
3. **Lint**: `bun oxc`
4. **Manual verification**:
   - Create session with maxConsecutiveGames=3
   - Play until one player has 3 consecutive wins
   - Verify they're forced out next game even with limited waiters
   - Add new player mid-session, verify they go to top of queue
   - Remove a playing player, verify match handles it correctly

---

## Migration Notes

No database migrations needed. These are logic changes only.

## Frontend Considerations

The frontend should:

1. Show "Remove" option for all players (not just waiting)
2. Confirm before removing playing players
3. Handle the case where proposed lineup becomes empty (not enough players)
4. Show newly added players at top of waiting queue visually
