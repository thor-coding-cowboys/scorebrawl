# Sessions Feature Refactor

## Goal

Refactor the sessions feature for code quality, type safety, separation of concerns, and extensibility. Prepare architecture for future round-robin mode without implementing it.

## Key Decisions

- **Architecture**: Strategy pattern + service layer with discriminated unions (no interfaces)
- **Dispatch**: Switch on `rotationMode` discriminated union, exhaustive checking
- **Sequential mode**: Remove entirely
- **Schema**: Mode-specific settings in JSON `modeSettings` column, discriminated union at app layer
- **Testing**: Integration tests through tRPC client, no unit/black-box testing
- **Migrations**: All through `bun db:generate`, never hand-edit

## Current Problems

1. **~500 lines duplicated** between tRPC router and device router (record-result, resolve-coin-toss)
2. **Device router bugs**: missing `maxConsecutiveEnabled`, `winnersTakePriority`, `matchHistory` in `computeNextLineup` calls
3. **981-line monolithic** live session page (11 mutations, 6+ state vars, 4 refs)
4. **1,754-line repository** doing everything in one file
5. **Dead code**: unused co-located `player-selection-drawer.tsx`
6. **Type safety holes**: `AnyTRPC = any`, `as Promise<...>` casts everywhere
7. **N+1 queries**: `recalcQueuePositions` and `deleteLastMatch`
8. **Naming inconsistency**: backend "sequential" vs frontend types "round-robin"
9. **No behavioral differentiation** in live UI between session types
10. **Zero test coverage**
11. **Duplicate `fisherYatesShuffle`** in repository and rotation files
12. **`removePlayer` lineup recomputation** misplaced in tRPC router, missing from device router
13. **Double query invalidation** from SSE hook + session page

## Backend Architecture

### File Structure

```
apps/worker/src/
  services/
    session/
      session-service.ts            # Orchestrator — both routers call this
      strategies/
        types.ts                    # Discriminated union types, RotationMode
        winner-stays.ts             # Winner-stays rotation logic (pure functions)
        manual.ts                   # Manual no-op rotation (pure functions)

  repositories/
    session/
      session-repository.ts         # Core CRUD (create, get, end, list)
      session-match-repository.ts   # Match lifecycle (start, record, cancel, undo)
      session-queue-repository.ts   # Player queue (add, remove, reorder, recalc)
      session-summary-repository.ts # Summary/stats aggregation
      index.ts                      # Re-exports
```

### Discriminated Union Types

```typescript
type WinnerStaysSettings = {
  mode: "winner-stays"
  maxConsecutiveGames: number | null  // null = disabled
  winnersTakePriority: boolean
  autoRandomize: boolean
  randomizerType: "fisher-yates" | "diversity"
  autoCoinToss: boolean
  alwaysSplitConstraints: [string, string][]
}

type ManualSettings = {
  mode: "manual"
}

type ModeSettings = WinnerStaysSettings | ManualSettings
```

### Strategy Dispatch (no interfaces)

```typescript
function computeNextLineup(session: GameSession, ...args) {
  const settings = session.modeSettings
  switch (settings.mode) {
    case "winner-stays":
      return winnerStaysRotation(settings, ...args) // TypeScript narrows to WinnerStaysSettings
    case "manual":
      return null
    default:
      exhaustiveCheck(settings.mode)
  }
}
```

Each strategy file exports pure functions. The service calls them via switch on `modeSettings.mode` — TypeScript narrows the type automatically, no casting needed. The `rotationMode` column stays in the DB for query filtering without JSON parsing, but app code always switches on `modeSettings.mode`.

### Service Layer

Exported as individual functions, not a namespace object.

```typescript
export function createSession(db, input): Promise<GameSession>
export function recordResult(db, input): Promise<RecordResultOutput>
export function startNextMatch(db, sessionId): Promise<SessionMatch>
export function resolveCoinToss(db, input): Promise<ResolveCoinTossOutput>
export function addPlayer(db, sessionId, seasonPlayerId): Promise<void>
export function removePlayer(db, sessionId, seasonPlayerId): Promise<RemovePlayerOutput>
export function cancelMatch(db, sessionId): Promise<void>
export function deleteLastMatch(db, sessionId): Promise<void>
export function endSession(db, sessionId): Promise<void>
```

**Moves into service:**
- `recordResult` orchestration (~260 lines currently duplicated): record -> compute lineup -> handle coin toss -> persist
- `removePlayer` lineup recomputation (currently in tRPC router only)
- `resolveCoinToss` -> recompute lineup flow
- Match creation via `matchRepository.create`

**Stays in routers:**
- Input validation (zod / zValidator)
- Auth/authorization
- SSE broadcast
- Response formatting (`formatSessionState` for device)
- `waitUntil` for background tasks (streak checks, achievement queue messages — service returns the data, router wraps in `waitUntil`)

### Router After Refactor

```typescript
// ~15 lines per procedure instead of ~260
recordResult: leagueMemberProcedure
  .input(recordResultSchema)
  .mutation(async ({ ctx, input }) => {
    const result = await recordResult(ctx.db, { ... })
    broadcastSessionUpdate(ctx, input.sessionId)
    ctx.executionCtx.waitUntil(checkStreaks(ctx, result))
    return result
  })
```

Device router becomes identical service call + `formatSessionState` for response shape.

### N+1 Fixes

- `recalcQueuePositions`: batch UPDATE with SQL CASE instead of per-player loop
- `deleteLastMatch`: consolidate lookup queries with joins

## Schema Migration

**Add:** `modeSettings TEXT` column on `game_session`

**Remove from enum:** `"sequential"` from `rotationMode`

**Backfill:** No transition code. Existing sessions on old flat columns can be ended via the UI. The page should not crash on old data (guard with null checks). New sessions use `modeSettings` exclusively. No cleanup debt.

**Dead columns:** `maxConsecutiveGames`, `maxConsecutiveEnabled`, `winnersTakePriority`, `autoRandomize`, `autoCoinToss`, `randomizerType`, `alwaysSplitConstraints` — left in place (SQLite has no DROP COLUMN cost), new code ignores them

**All migrations via `bun db:generate`**, never hand-edited.

## Frontend Architecture

### Route Structure

```
routes/session/$sessionId/
  index.tsx                       # Thin shell — loads session, switches on mode
  -components/
    session-types.ts              # Shared types (cleaned up)
    session-utils.ts              # Shared utilities (deduplicated)

    winner-stays/
      winner-stays-session.tsx    # Full winner-stays experience
      queue-panel.tsx             # Queue list + player ordering
      rotation-controls.tsx       # Shuffle, even, rotation buttons
      coin-toss-dialog.tsx        # Coin toss (winner-stays only)

    manual/
      manual-session.tsx          # Stripped-down manual experience
      team-picker.tsx             # Manual team selection UI

    shared/
      score-stepper.tsx           # Score tracking (both modes)
      team-roster-card.tsx        # Team display (both modes)
      match-actions.tsx           # Start/record/cancel (both modes)
      session-dashboard.tsx       # Stats cards (both modes)
      session-standings.tsx       # Standings tab (both modes)
      add-player-dialog.tsx       # Add player mid-session (both modes)
```

### Mode Switch in Page

```typescript
function SessionPage() {
  const session = useSessionQuery(sessionId)

  if (!session.modeSettings) {
    return <LegacySessionFallback session={session} />
  }

  switch (session.modeSettings.mode) {
    case "winner-stays":
      return <WinnerStaysSession session={session} />
    case "manual":
      return <ManualSession session={session} />
    default:
      exhaustiveCheck(session.modeSettings.mode)
  }
}
```

### Extracted Hooks

- `useSessionMutations(sessionId)` — all 11 mutations in one hook
- `useScoreSync(sessionId)` — debounced score syncing
- `useSessionSSE(sessionId)` — SSE event handling, single invalidation path

### UI Differences Per Mode

**Winner-stays:** Queue panel, auto-proposed lineups, rotation controls (shuffle/even/rotation), coin toss dialog, always-split display, streak indicators, consecutive game tracking

**Manual:** Team picker (drag or select players to home/away), score tracking, match recording. No queue, no rotation, no coin toss, no always-split.

### Cleanup

- Delete dead `player-selection-drawer.tsx` from co-located components
- Remove all `AnyTRPC = any` casts, use proper tRPC client typing
- Remove all `as Promise<...>` casts (consequence of fixing AnyTRPC)
- Use tRPC-generated query keys everywhere, remove manual `["session", sessionId]`
- Fix double query invalidation (single path through SSE hook)
- Split `score-stepper.tsx` (currently exports 4 unrelated components)
- Update `StartSessionDialog` to use `ModeSettings` discriminated union
- Remove unused `onOpenChange` prop from `CoinTossDialog`
- Purge all `"round-robin"` / `"sequential"` references from frontend

## Files Deleted

- `apps/worker/src/lib/session-rotation.ts` — absorbed into `strategies/winner-stays.ts`
- `apps/web/src/routes/session/$sessionId/-components/player-selection-drawer.tsx` — dead code

## Files Significantly Rewritten

- `session-repository.ts` → split into 4 repository files
- `session-router.ts` → thin wrapper calling service
- `device-router.ts` → session endpoints become thin wrappers calling service
- `session/$sessionId/index.tsx` → thin shell with mode switch
- `start-session-dialog.tsx` → uses `ModeSettings` union for settings form

## Testing

Integration tests through tRPC client with real D1 database. Pattern: `createTRPCTestClient({ sessionToken })`.

**Test flows:**
1. Create winner-stays session -> start match -> record result -> verify next lineup
2. Create winner-stays session -> record draw -> verify coin toss created -> resolve -> verify lineup
3. Create manual session -> start match -> record result -> verify no auto-rotation
4. Add player mid-session -> verify queue position
5. Remove player from proposed lineup -> verify replacement
6. Delete last match -> verify state rollback
7. Max consecutive games -> verify player rotated out
8. Always-split constraints -> verify enforced after result

Each test exercises full stack: router -> service -> repository -> D1 -> response.

## Round-Robin Readiness

Architecture supports future round-robin without structural changes:
- Add `RoundRobinSettings` to `ModeSettings` union
- Add `"round-robin"` to `rotationMode` enum
- Add `strategies/round-robin.ts` with fixture generation logic
- Add `round-robin/` directory in frontend components
- Compiler shows every switch that needs a new case
