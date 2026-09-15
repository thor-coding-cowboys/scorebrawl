# SSE Removal Implementation Plan

**Goal:** Remove only the most aggressive session SSE events (`session:score-update`, `session:team-selection-update`, `session:proposed-lineup-update`) that fire frequently during gameplay to reduce system load.

**Architecture:** Keep most SSE infrastructure intact. Remove only the high-frequency real-time score and selection updates. Frontend continues using SSE for session lifecycle and standings.

**Tech Stack:** Hono, tRPC, Cloudflare Durable Objects, TanStack Query

---

## Overview

Current SSE broadcasts 11 event types. After this change, 8 remain:

- ✅ `match:insert` - When a game is recorded
- ✅ `match:delete` - When a recorded game is deleted
- ✅ `session:start` - Session started
- ✅ `session:end` - Session ended
- ✅ `session:update` - Player joins, match state changes
- ✅ `standings:update` - Player standings changed
- ✅ `streak` - Winning streak notifications
- ✅ `connected` - Connection confirmation
- ✅ `session:score-update` - REMOVED (live score changes)
- ✅ `session:team-selection-update` - REMOVED
- ✅ `session:proposed-lineup-update` - REMOVED

---

## Task 1: Update SSE Durable Object Type Definition ✅ COMPLETED

**Files:**

- Modify: `apps/worker/src/durable-objects/season-sse.ts:3-10`

**Step 1: Remove 3 event types from interface**

```typescript
// BEFORE
export interface SeasonSSEEvent {
	type: "match:insert" | "match:delete" | "standings:update" | "streak";
	data: unknown;
	user?: { id: string; name: string };
}

// AFTER - Remove only score-update, team-selection, proposed-lineup
export interface SeasonSSEEvent {
	type:
		| "match:insert"
		| "match:delete"
		| "standings:update"
		| "streak"
		| "session:start"
		| "session:end"
		| "session:update"
		| "connected";
	data: unknown;
	user?: { id: string; name: string };
}
```

---

## Task 2: Remove SSE Broadcasts from Session Router ✅ COMPLETED

**Files:**

- Modify: `apps/worker/src/trpc/router/session-router.ts`

### Step 2.1: Remove `session:score-update` broadcast (Lines 719-728)

Remove ONLY this broadcast:

```typescript
await broadcastSeasonEvent(ctx.env, ctx.organization.slug, sessionInfo.seasonSlug, {
	type: "session:score-update",
	data: { sessionId, sessionMatchId, homeScore, awayScore },
	user: { id, name },
});
```

### Step 2.2: Remove `session:team-selection-update` broadcast (Lines 753-762)

Remove ONLY this broadcast:

```typescript
await broadcastSeasonEvent(ctx.env, ctx.organization.slug, sessionInfo.seasonSlug, {
	type: "session:team-selection-update",
	data: { sessionId, teamSelection },
	user: { id, name },
});
```

### Step 2.3: Remove `session:proposed-lineup-update` broadcast (Lines 795-802)

Remove ONLY this broadcast:

```typescript
await broadcastSeasonEvent(ctx.env, ctx.organization.slug, sessionInfo.seasonSlug, {
	type: "session:proposed-lineup-update",
	data: { sessionId, proposedLineup },
	user: { id, name },
});
```

### Step 2.4: KEEP all other broadcasts

DO NOT REMOVE:

- `session:start` (Lines 78-82)
- `session:update` (Lines 166-170, 186-190, 242-246)
- `session:end` (Lines 610-614)
- `match:insert` (Lines 441-450)
- `match:delete` (Lines 657-661, 684-694)

---

## Task 3: Remove SSE Broadcasts from Device Router ✅ COMPLETED

**Files:**

- Modify: `apps/worker/src/routes/device-router.ts`

### Step 3.1: Remove `session:score-update` from device endpoint (Lines 739-748)

Remove:

```typescript
await broadcastSeasonEvent(c.env, leagueData.slug, activeSeason.slug, {
	type: "session:score-update",
	data: { sessionId, sessionMatchId, homeScore, awayScore },
	user: { id, name },
});
```

### Step 3.2: Remove `session:proposed-lineup-update` from shuffle lineup (Lines 805-816)

Remove:

```typescript
await broadcastSeasonEvent(c.env, leagueData.slug, activeSeason.slug, {
	type: "session:proposed-lineup-update",
	data: { sessionId, proposedLineup },
	user: { id, name },
});
```

### Step 3.3: KEEP all other broadcasts

DO NOT REMOVE:

- `session:update` broadcasts
- `match:insert` broadcasts
- Any other event types

---

## Task 4: Update Frontend SSE Hook ✅ COMPLETED

**Files:**

- Modify: `apps/web/src/hooks/use-season-sse.ts`

### Step 4.1: Remove 3 event types from union (Lines 74-93)

Remove from `SeasonSSEEvent` type:

- `session:score-update`
- `session:team-selection-update`
- `session:proposed-lineup-update`

### Step 4.2: Remove 3 case handlers from event handler (Lines 95-150+)

Remove case handlers for:

- `session:score-update`
- `session:team-selection-update`
- `session:proposed-lineup-update`

### Step 4.3: KEEP all other handlers

DO NOT REMOVE handlers for:

- `match:insert`
- `match:delete`
- `session:start`
- `session:update`
- `session:end`
- `standings:update`
- `streak`
- `connected`

---

## Task 5: Update Frontend Event Types ✅ COMPLETED

**Files:**

- Modify: `apps/web/src/lib/event-types.ts`

### Step 5.1: Remove 3 event detail interfaces

Remove:

- `ScoreUpdateDetail`
- `TeamSelectionUpdateDetail`
- `ProposedLineupUpdateDetail`

### Step 5.2: KEEP all other interfaces

DO NOT REMOVE:

- `SessionEventDetail`
- `StreakEventDetail`
- `MatchInsertEventDetail`
- `MatchDeleteEventDetail`

---

## Task 6: KEEP Route Component Event Listeners ✅ COMPLETED

**Files:**

- No changes: `apps/web/src/routes/_authenticated/_sidebar/leagues/$slug/seasons/$seasonSlug/route.tsx`

The session-event listener should remain as we're still broadcasting `session:start`, `session:end`, and `session:update`.

---

## Task 7: Run Verification Commands ✅ COMPLETED

**Step 7.1: Run linting**

```bash
bun oxc
```

Expected: No errors

**Step 7.2: Run type checking**

```bash
bun typecheck
```

Expected: No TypeScript errors

**Step 7.3: Run tests**

```bash
bun run test
```

Expected: All tests pass (or at least no new failures from these changes)

---

## Summary of Changes

### Files Modified:

**Backend:**

1. `apps/worker/src/durable-objects/season-sse.ts` - Remove 3 event types from interface ✅ COMPLETED
2. `apps/worker/src/trpc/router/session-router.ts` - Remove 3 SSE broadcasts ✅ COMPLETED
3. `apps/worker/src/routes/device-router.ts` - Remove 2 SSE broadcasts ✅ COMPLETED

**Frontend:** 4. `apps/web/src/hooks/use-season-sse.ts` - Remove 3 event types from union and handlers ✅ COMPLETED 5. `apps/web/src/lib/event-types.ts` - Remove 3 event detail interfaces ✅ COMPLETED

### Event Types Removed:

- `session:score-update` - Live score changes (frequent during gameplay) ✅ REMOVED
- `session:team-selection-update` - Team selection changes ✅ REMOVED
- `session:proposed-lineup-update` - Lineup shuffle updates ✅ REMOVED

### Event Types Kept:

- `match:insert` - Game recording ✅ KEPT
- `match:delete` - Game deletion ✅ KEPT
- `session:start` - Session started ✅ KEPT
- `session:end` - Session ended ✅ KEPT
- `session:update` - Player joins, match state changes ✅ KEPT
- `standings:update` - Player standings changed ✅ KEPT
- `streak` - Winning streak notifications ✅ KEPT
- `connected` - Connection confirmation ✅ KEPT

### Impact:

- Reduced SSE broadcast volume by removing high-frequency score updates ✅ ACHIEVED
- Frontend still receives real-time updates for session lifecycle ✅ MAINTAINED
- Session state changes still broadcast (player joins, match start/end) ✅ MAINTAINED
- Game recordings and streaks still real-time ✅ MAINTAINED
