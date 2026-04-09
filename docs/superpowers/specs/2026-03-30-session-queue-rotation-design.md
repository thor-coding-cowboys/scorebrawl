# Session Rotation: Queue-as-Source-of-Truth

**Date:** 2026-03-30
**Updated:** 2026-04-08
**Status:** Approved (revised)

## Problem

Current session rotation logic is mode-centric — winner-stays and winner-stays-hard are separate modes with different code paths. Settings like `maxConsecutiveGames` are bolted on inconsistently. The queue is a secondary construct rather than the single source of truth for match selection.

## Core Principle

Every game ends with **all players returning to queue**. Queue positions are **reassigned** after each game according to mode rules. The next match is formed by selecting the top `teamSize * 2` players sorted by `queuePosition ASC`.

`queuePosition` is the **only** sort key used when selecting the next lineup. All complex priority logic (winner/loser placement, consecutive games, maxConsecutive) is expressed by assigning the correct `queuePosition` values in `recordMatchResult`, not in `computeNextLineup`.

## Mode Behaviors

### Manual Mode

No automatic reordering. Players remain in queue at their current positions. Teams are selected manually.

### Round Robin Mode

After each game, all playing players move to the bottom of the queue (in their original queue order relative to each other). No win/loss distinction. `computeNextLineup` selects top `teamSize * 2` by `queuePosition ASC`.

### Winner Stays Mode

`computeNextLineup` selects top `teamSize * 2` by `queuePosition ASC`. No sorting by `consecutiveGames` or win/loss in the selection step — that is purely handled by how positions are assigned after each game.

**Settings:**

| Setting                 | Type    | Description                                                                     |
| ----------------------- | ------- | ------------------------------------------------------------------------------- |
| `teamSize`              | number  | Players per team                                                                |
| `winnersTakePriority`   | boolean | `true` = winners jump to front of queue; `false` = winners above losers at back |
| `maxConsecutiveEnabled` | boolean | Whether to apply consecutive games override                                     |
| `maxConsecutiveGames`   | number  | Games threshold — exceeding sends player to absolute bottom                     |

---

## Queue Position Assignment After a Game

After a game completes, **all playing players** are assigned new queue positions. Waiting players keep their positions.

### Step 1: Identify maxConsecutive overrides (if enabled)

If `maxConsecutiveEnabled` is true, find all playing players whose `consecutiveGames` (before increment) **>=** `maxConsecutiveGames`. These players are **override-players** and go to the absolute bottom of the queue regardless of winner/loser status.

Tie-breaking among override-players:

1. More consecutive games → further down
2. Equal consecutive games → coin toss needed

### Step 2: Assign positions for non-override players

The remaining playing players (non-override) are split into winners and losers.

**`winnersTakePriority: false` (prioritize queue):**

- Waiting players keep their positions unchanged
- Non-override playing players go to the bottom
- Among them: winners above losers
- Tie-breaking within each group (winners vs winners, losers vs losers):
  1. More consecutive games → further down
  2. Equal consecutive games → coin toss needed

**`winnersTakePriority: true` (prioritize winners):**

- Winners jump to the **top** of the entire queue (shift all waiting players down to make room)
- Non-override losers go to the bottom (after all waiting players)
- Tie-breaking:
  1. More consecutive games → further down (within winners group or losers group)
  2. Equal consecutive games → coin toss needed

### Step 3: Override-players go to absolute bottom

Override-players are appended after all non-override bottom-of-queue players.

### `consecutiveGames` increment

**Always increments by 1 for all playing players**, regardless of winner/loser status or any settings. The consecutive games count reflects actual games played.

---

## Coin Toss Resolution

Coin tosses occur when players are tied on ALL tiebreakers for a queue boundary decision:

- Within winner group: equal consecutive games at boundary
- Within loser group: equal consecutive games at boundary
- Within override group: equal consecutive games at boundary

A resolved coin toss (`resolvedCoinTossWinnerIds`) is passed back into `recordMatchResult` to break the tie.

---

## Queue Selection

Always take the top `teamSize * 2` players sorted by `queuePosition ASC`. Players with `status: "out"` are excluded.

---

## Data Model

### Session Settings (GameSession)

```typescript
rotationMode: "manual" | "round-robin" | "winner-stays";
teamSize: number;
winnersTakePriority: boolean; // winner-stays only
maxConsecutiveEnabled: boolean;
maxConsecutiveGames: number | null;
```

### Player State (SessionPlayer)

```typescript
queuePosition: number; // determines next-game selection order
consecutiveGames: number; // games played since last time out (always increments)
```

---

## computeNextLineup Responsibilities

`computeNextLineup` is a **pure selection function**. It does NOT perform complex priority sorting. It:

1. Filters out `status: "out"` players
2. Sorts remaining by `queuePosition ASC`
3. Takes top `teamSize * 2`
4. Assigns to home/away (respecting `autoRandomize` and `alwaysSplitConstraints`)
5. Returns `rotatedOut` = playing players not in the top N

The only exception is `round-robin` mode where it may sort by `consecutiveGames ASC` then `queuePosition` as a convenience (equivalent outcome if queue positions are managed correctly).

---

## Implementation Notes

- Undo a match should restore queue positions to pre-match state (`recalcQueuePositions`)
- `recalcQueuePositions` must replay winner/loser logic for each completed match to reconstruct queue positions from scratch
- When `winnersTakePriority: true`, winners are inserted at position 0 and all waiting players are shifted (+N positions)
- Coin toss is required **before** `recordMatchResult` completes — if a coin toss is needed, the match result is staged and awaits coin toss resolution
