# Sessions Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the sessions feature for code quality, type safety, separation of concerns, and extensibility for future round-robin mode.

**Architecture:** Strategy pattern with discriminated unions dispatched via switch statements. Shared service layer eliminates duplication between tRPC and device routers. Frontend splits into mode-specific components (winner-stays vs manual).

**Tech Stack:** Drizzle ORM, tRPC, Hono, React, TanStack Query, TanStack Router, Vitest + Cloudflare Workers

**Spec:** `docs/superpowers/specs/2026-04-10-sessions-refactor-design.md`

---

## Phase 1: Backend Foundation

### Task 1: Discriminated Union Types

Define the shared types that everything else builds on.

**Files:**

- Create: `apps/worker/src/services/session/strategies/types.ts`

- [ ] **Step 1: Create the types file**

```typescript
// apps/worker/src/services/session/strategies/types.ts

export type RotationMode = "winner-stays" | "manual";

export type WinnerStaysSettings = {
	mode: "winner-stays";
	maxConsecutiveGames: number | null;
	winnersTakePriority: boolean;
	autoRandomize: boolean;
	randomizerType: "fisher-yates" | "diversity";
	autoCoinToss: boolean;
	alwaysSplitConstraints: [string, string][];
};

export type ManualSettings = {
	mode: "manual";
};

export type ModeSettings = WinnerStaysSettings | ManualSettings;

export function exhaustiveCheck(value: never): never {
	throw new Error(`Unhandled mode: ${value}`);
}

export function parseModeSettings(json: string | null): ModeSettings | null {
	if (!json) return null;
	return JSON.parse(json) as ModeSettings;
}
```

- [ ] **Step 2: Verify types compile**

Run: `bun typecheck`

- [ ] **Step 3: Commit**

```bash
git add apps/worker/src/services/session/strategies/types.ts
git commit -m "Add session mode discriminated union types"
```

---

### Task 2: Schema Migration

Add `modeSettings` column, remove `"sequential"` from the enum.

**Files:**

- Modify: `apps/worker/src/db/schema/league-schema.ts` (lines 264-304)

- [ ] **Step 1: Update the schema**

In `apps/worker/src/db/schema/league-schema.ts`, modify the `gameSession` table:

1. Change `rotationMode` enum from `["winner-stays", "sequential", "manual"]` to `["winner-stays", "manual"]`
2. Add `modeSettings` column: `text("mode_settings")` (nullable, for old sessions)
3. Keep all existing flat columns — they become dead but SQLite has no DROP COLUMN cost

```typescript
// Change this line (around line 273):
rotationMode: text("rotation_mode", { enum: ["winner-stays", "manual"] })
  .notNull()
  .default("winner-stays"),

// Add after the existing columns, before endedAt:
modeSettings: text("mode_settings"),
```

- [ ] **Step 2: Generate and apply migration**

Run: `bun db:generate`
Run: `bun db:migrate`

Verify migration was created and applied cleanly.

- [ ] **Step 3: Run typecheck**

Run: `bun typecheck`

Fix any type errors caused by removing `"sequential"` from the enum. Search for `"sequential"` references in backend code — the `computeNextLineup` function in `session-rotation.ts` has a sequential branch (around line 226) that will now be unreachable. Don't fix `session-rotation.ts` — it gets deleted in Task 5.

For now, just ensure schema compiles. Backend code that references `"sequential"` will be addressed when we rewrite those files.

- [ ] **Step 4: Commit**

```bash
git add apps/worker/src/db/schema/league-schema.ts
git add apps/worker/drizzle/  # migration files
git commit -m "Add modeSettings column, remove sequential from rotationMode enum"
```

---

### Task 3: Split Session Repository

Split `apps/worker/src/repositories/session-repository.ts` (1,754 lines) into 4 focused files.

**Files:**

- Create: `apps/worker/src/repositories/session/session-repository.ts`
- Create: `apps/worker/src/repositories/session/session-match-repository.ts`
- Create: `apps/worker/src/repositories/session/session-queue-repository.ts`
- Create: `apps/worker/src/repositories/session/session-summary-repository.ts`
- Create: `apps/worker/src/repositories/session/index.ts`
- Modify: `apps/worker/src/repositories/index.ts`
- Delete: `apps/worker/src/repositories/session-repository.ts` (old monolith)

**Split mapping** (line numbers reference the original `session-repository.ts`):

| New File                        | Functions from Original                                                                                                                                                                                                         | Lines                                                                                         |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `session-repository.ts`         | `parseStringArray`, `parseProposedLineup`, `parseAlwaysSplit`, `createSession`, `getActiveSession`, `getActiveSessionFull`, `getSessionById`, `endSession`, `getSessionWithSeason`, `listEndedSessions`, `updateProposedLineup` | 21-43, 84-102, 103-215, 216-233, 234-309, 310-377, 1093-1121, 1383-1393, 1679-1701, 1702-1754 |
| `session-match-repository.ts`   | `startNextMatch`, `recordMatchResult`, `cancelCurrentMatch`, `deleteLastMatch`, `updateMatchScore`, `updateTeamSelection`, `createCoinToss`, `resolveCoinToss`                                                                  | 567-639, 640-820, 821-890, 891-1037, 1038-1063, 1064-1092, 1326-1358, 1359-1382               |
| `session-queue-repository.ts`   | `addPlayerToSession`, `removePlayerFromSession`, `handlePlayerRemovalFromMatch`, `recalcConsecutiveGames`, `recalcQueuePositions`                                                                                               | 378-446, 447-494, 495-566, 1123-1214, 1215-1324                                               |
| `session-summary-repository.ts` | `getSessionSummary`                                                                                                                                                                                                             | 1395-1678                                                                                     |

- [ ] **Step 1: Create the directory and index**

```typescript
// apps/worker/src/repositories/session/index.ts
export * from "./session-repository";
export * from "./session-match-repository";
export * from "./session-queue-repository";
export * from "./session-summary-repository";
```

- [ ] **Step 2: Create `session-repository.ts` (core CRUD)**

Move the following from original:

- `parseStringArray` (line 21)
- `parseProposedLineup` (line 43)
- `parseAlwaysSplit` (line 84)
- `createSession` (line 103) — **update to accept and persist `modeSettings` JSON**
- `getActiveSession` (line 216)
- `getActiveSessionFull` (line 234) — **deduplicate with `getSessionById`** by extracting a shared `fetchSessionWithRelations(whereClause)` helper
- `getSessionById` (line 310) — **use shared helper**
- `updateProposedLineup` (line 1093)
- `endSession` (line 1383)
- `getSessionWithSeason` (line 1679)
- `listEndedSessions` (line 1702)

Key changes:

- `createSession`: add `modeSettings` param, serialize to JSON, write to new column
- `getActiveSessionFull` and `getSessionById`: extract shared query logic into one function, pass different where clause
- Export `parseStringArray`, `parseProposedLineup`, `parseAlwaysSplit`, `parseModeSettings` for other repos to use

- [ ] **Step 3: Create `session-match-repository.ts`**

Move from original:

- `startNextMatch` (line 567)
- `recordMatchResult` (line 640)
- `cancelCurrentMatch` (line 821)
- `deleteLastMatch` (line 891) — **consolidate N+1 lookup queries** (lines 977-1017): multiple separate lookups for previous match player IDs should be combined into fewer queries with joins
- `updateMatchScore` (line 1038)
- `updateTeamSelection` (line 1064)
- `createCoinToss` (line 1326)
- `resolveCoinToss` (line 1359)

Import shared parse functions from `./session-repository`.

- [ ] **Step 4: Create `session-queue-repository.ts`**

Move from original:

- `addPlayerToSession` (line 378)
- `removePlayerFromSession` (line 447)
- `handlePlayerRemovalFromMatch` (line 495)
- `recalcConsecutiveGames` (line 1123)
- `recalcQueuePositions` (line 1215) — **fix N+1 query**: replace per-player UPDATE loop (lines 1314-1323) with batch UPDATE using SQL CASE expression

N+1 fix for `recalcQueuePositions`:

```typescript
// BEFORE (N+1 — one UPDATE per player):
for (let i = 0; i < queue.length; i++) {
  await db.update(sessionPlayer)
    .set({ queuePosition: i, consecutiveGames: ... })
    .where(eq(sessionPlayer.id, queue[i].id));
}

// AFTER (single batch UPDATE):
if (queue.length > 0) {
  await db.update(sessionPlayer)
    .set({
      queuePosition: sql`CASE ${sql.join(
        queue.map((p, i) => sql`WHEN ${sessionPlayer.id} = ${p.id} THEN ${i}`),
        sql` `
      )} END`,
      consecutiveGames: sql`CASE ${sql.join(
        queue.map((p) => sql`WHEN ${sessionPlayer.id} = ${p.id} THEN ${p.consecutiveGames}`),
        sql` `
      )} END`,
    })
    .where(inArray(sessionPlayer.id, queue.map(p => p.id)));
}
```

- [ ] **Step 5: Create `session-summary-repository.ts`**

Move from original:

- `getSessionSummary` (line 1395)

Import shared parse functions from `./session-repository`.

- [ ] **Step 6: Update `repositories/index.ts`**

Change the session export to point to the new directory:

```typescript
// Change:
export * as sessionRepository from "./session-repository";
// To:
export * as sessionRepository from "./session/index";
```

- [ ] **Step 7: Delete old monolith**

Delete `apps/worker/src/repositories/session-repository.ts`.

- [ ] **Step 8: Update all imports**

Search for all imports from `./session-repository` or `../repositories/session-repository` and update to the new paths. The barrel re-export in `repositories/index.ts` should handle most cases, but direct imports need updating.

Key files to check:

- `apps/worker/src/trpc/router/session-router.ts`
- `apps/worker/src/routes/device-router.ts`
- Any test files referencing session repository

- [ ] **Step 9: Verify**

Run: `bun typecheck`
Run: `bun oxc`

Fix any import errors.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "Split session repository into domain-focused modules"
```

---

### Task 4: Strategy Files

Extract rotation logic into pure strategy functions.

**Files:**

- Create: `apps/worker/src/services/session/strategies/winner-stays.ts`
- Create: `apps/worker/src/services/session/strategies/manual.ts`
- Reference: `apps/worker/src/lib/session-rotation.ts` (source of logic to move)

- [ ] **Step 1: Create `winner-stays.ts`**

Move all rotation logic from `session-rotation.ts` into this file. Key functions:

- `computeNextLineup` (line 203 of original) — keep the winner-stays branch only, remove the mode switch and sequential/manual branches
- `enforceAlwaysSplit` (line 115 of original)
- `fisherYatesShuffle` (line 47 of original) — move to a shared util, import here
- `diversityShuffle` (line 78 of original) — move to a shared util, import here

The function signature changes — it no longer takes `mode` as a parameter. It always does winner-stays rotation. Accept `WinnerStaysSettings` instead of generic `RotationInput`:

```typescript
// apps/worker/src/services/session/strategies/winner-stays.ts
import type { WinnerStaysSettings } from "./types";

export interface WinnerStaysRotationInput {
	settings: WinnerStaysSettings;
	players: SessionPlayerState[];
	teamSize: number;
	lastMatchResult: "home" | "away" | "draw" | null;
	lastMatchHome: string[];
	lastMatchAway: string[];
	matchHistory: MatchHistoryEntry[];
	resolvedCoinTossWinnerIds: string[] | null;
}

export interface SessionPlayerState {
	id: string;
	seasonPlayerId: string;
	status: "waiting" | "playing" | "out";
	queuePosition: number;
	consecutiveGames: number;
}

export interface MatchHistoryEntry {
	homePlayerIds: string[];
	awayPlayerIds: string[];
}

export interface WinnerStaysLineup {
	homePlayerIds: string[];
	awayPlayerIds: string[];
	rotatedOut: string[];
	coinTossNeeded: CoinTossNeeded | null;
}

export interface CoinTossNeeded {
	conflictType: "loser-rotation" | "max-consecutive-exceeded" | "draw-tiebreak";
	candidates: string[];
}

export function computeWinnerStaysLineup(input: WinnerStaysRotationInput): WinnerStaysLineup {
	// Move logic from session-rotation.ts lines 245-363
	// Uses input.settings.maxConsecutiveGames instead of separate params
	// Uses input.settings.winnersTakePriority, etc.
}

export function enforceAlwaysSplit(
	homeIds: string[],
	awayIds: string[],
	constraints: [string, string][],
	players: SessionPlayerState[]
): { homeIds: string[]; awayIds: string[] } {
	// Move from session-rotation.ts lines 115-163
}
```

Also move the helper functions (`getWinnerLoserIds`, etc.) as private functions in this file.

Fix the `diversityShuffle` function: remove the unused `_getWeight` parameter, the function already builds its own weight lookup from `pairWeights`.

- [ ] **Step 2: Create shared shuffle util**

Create or add to an existing util file to consolidate the duplicate `fisherYatesShuffle`:

```typescript
// apps/worker/src/lib/shuffle.ts
export function fisherYatesShuffle<T>(arr: T[]): T[] {
	const shuffled = [...arr];
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}
	return shuffled;
}

export function diversityShuffle<T>(
	items: T[],
	pairWeights: Map<string, number>,
	getId: (item: T) => string
): T[] {
	// Move from session-rotation.ts lines 78-113
}
```

- [ ] **Step 3: Create `manual.ts`**

```typescript
// apps/worker/src/services/session/strategies/manual.ts
// Manual mode has no automatic rotation — this is intentionally minimal.

export function computeManualLineup(): null {
	return null;
}
```

- [ ] **Step 4: Verify**

Run: `bun typecheck`

- [ ] **Step 5: Commit**

```bash
git add apps/worker/src/services/session/strategies/ apps/worker/src/lib/shuffle.ts
git commit -m "Add session strategy files for winner-stays and manual modes"
```

---

### Task 5: Session Service Layer

Create the service that both routers will call.

**Files:**

- Create: `apps/worker/src/services/session/session-service.ts`
- Create: `apps/worker/src/services/session/index.ts`
- Reference: `apps/worker/src/trpc/router/session-router.ts` (source of orchestration logic)

- [ ] **Step 1: Create service barrel**

```typescript
// apps/worker/src/services/session/index.ts
export * from "./session-service";
export * from "./strategies/types";
```

- [ ] **Step 2: Create `session-service.ts`**

Extract orchestration from `session-router.ts`. The biggest function is `recordResult` (lines 327-587 of session-router). The service takes a Drizzle `db` instance and returns data — it does NOT handle SSE, auth, or `waitUntil`.

Key functions to implement:

```typescript
// apps/worker/src/services/session/session-service.ts
import type { ModeSettings, WinnerStaysSettings } from "./strategies/types";
import { exhaustiveCheck, parseModeSettings } from "./strategies/types";
import { computeWinnerStaysLineup, enforceAlwaysSplit } from "./strategies/winner-stays";
import { computeManualLineup } from "./strategies/manual";
import * as sessionRepo from "../../repositories/session";
import * as matchRepository from "../../repositories/match-repository";
import type { DrizzleD1Database } from "drizzle-orm/d1";

// --- Types ---

export interface CreateSessionInput {
	seasonId: string;
	createdBy: string;
	teamSize: number;
	rotationMode: "winner-stays" | "manual";
	modeSettings: ModeSettings;
	playerSeasonIds: string[];
}

export interface RecordResultInput {
	sessionId: string;
	sessionMatchId: string;
	result: "home" | "away" | "draw";
	homeScore: number;
	awayScore: number;
	seasonId: string;
	leagueId: string;
}

export interface RecordResultOutput {
	match: { id: string }; // The created match record
	proposedLineup /* ... */: null;
	coinToss: { id: string } | null;
	// Data the router needs for streak checks
	streakData: {
		matchId: string;
		seasonId: string;
		leagueId: string;
		homePlayerIds: string[];
		awayPlayerIds: string[];
		result: "home" | "away" | "draw";
	};
}

// --- Functions ---

export async function createSession(db: DrizzleD1Database, input: CreateSessionInput) {
	// Calls sessionRepo.createSession with modeSettings serialized
}

export async function recordResult(
	db: DrizzleD1Database,
	input: RecordResultInput
): Promise<RecordResultOutput> {
	// 1. Get session with modeSettings
	// 2. Create match record via matchRepository.create
	// 3. Call sessionRepo.recordMatchResult
	// 4. Switch on modeSettings.mode:
	//    case "winner-stays": call computeWinnerStaysLineup with settings
	//    case "manual": call computeManualLineup (returns null)
	// 5. If coin toss needed:
	//    - If settings.autoCoinToss: auto-resolve, recompute lineup
	//    - Else: create pending coin toss
	// 6. Persist proposed lineup
	// 7. Return result + streakData for router to use with waitUntil
}

export async function startNextMatch(db: DrizzleD1Database, sessionId: string) {
	// Calls sessionRepo.startNextMatch
}

export async function resolveCoinToss(
	db: DrizzleD1Database,
	input: {
		sessionId: string;
		coinTossId: string;
		winnerIds: string[];
	}
) {
	// 1. Resolve coin toss in DB
	// 2. Recompute lineup with resolved winner IDs
	// 3. Persist proposed lineup
}

export async function addPlayer(db: DrizzleD1Database, sessionId: string, seasonPlayerId: string) {
	// Calls sessionQueueRepo.addPlayerToSession
}

export async function removePlayer(
	db: DrizzleD1Database,
	sessionId: string,
	seasonPlayerId: string
) {
	// 1. Remove player from queue
	// 2. If player was in proposed lineup, recompute
	//    (This logic currently lives in session-router.ts lines 243-275 — move it here)
	// 3. Handle removal from active match if needed
}

export async function cancelMatch(db: DrizzleD1Database, sessionId: string) {
	// Calls sessionMatchRepo.cancelCurrentMatch
}

export async function deleteLastMatch(db: DrizzleD1Database, sessionId: string) {
	// Calls sessionMatchRepo.deleteLastMatch
	// Calls recalcQueuePositions + recalcConsecutiveGames
}

export async function endSession(db: DrizzleD1Database, sessionId: string) {
	// Calls sessionRepo.endSession
}

export async function updateMatchScore(
	db: DrizzleD1Database,
	input: {
		sessionId: string;
		sessionMatchId: string;
		homeScore: number;
		awayScore: number;
	}
) {
	// Calls sessionMatchRepo.updateMatchScore
}

export async function updateTeamSelection(
	db: DrizzleD1Database,
	input: {
		sessionId: string;
		sessionMatchId: string;
		selectedHomePlayerIds: string[];
		selectedAwayPlayerIds: string[];
	}
) {
	// Calls sessionMatchRepo.updateTeamSelection
}

export async function updateProposedLineup(
	db: DrizzleD1Database,
	input: {
		sessionId: string;
		proposedLineup: string;
	}
) {
	// Calls sessionRepo.updateProposedLineup
}
```

The critical part is `recordResult` — port the orchestration from `session-router.ts` lines 327-587, using the tRPC version as the source of truth (it correctly passes all settings to `computeNextLineup`, unlike the device router).

- [ ] **Step 3: Verify**

Run: `bun typecheck`

- [ ] **Step 4: Commit**

```bash
git add apps/worker/src/services/session/
git commit -m "Add session service layer for shared orchestration"
```

---

### Task 6: Simplify tRPC Router

Rewrite `session-router.ts` to be a thin wrapper calling service functions.

**Files:**

- Modify: `apps/worker/src/trpc/router/session-router.ts`

- [ ] **Step 1: Rewrite the router**

Replace the current 864-line router. Each procedure becomes ~10-20 lines:

1. Input validation (already handled by zod `.input()`)
2. Call service function
3. SSE broadcast
4. `waitUntil` for background tasks if needed
5. Return result

Key changes:

- `create`: call `sessionService.createSession()`, pass `modeSettings` from input
- `recordResult` (currently 260 lines): call `sessionService.recordResult()`, broadcast SSE, `waitUntil` for streak checks
- `removePlayer` (lines 207-296): call `sessionService.removePlayer()` — the lineup recomputation logic moves to the service
- `resolveCoinToss` (lines 589-680): call `sessionService.resolveCoinToss()`
- All other procedures: thin wrappers around service calls

Update the `create` input schema to accept `modeSettings` as a JSON object instead of individual flat fields:

```typescript
create: leagueMemberProcedure
  .input(z.object({
    seasonId: z.string(),
    teamSize: z.number().int().min(1).max(6),
    rotationMode: z.enum(["winner-stays", "manual"]),
    modeSettings: z.union([
      z.object({
        mode: z.literal("winner-stays"),
        maxConsecutiveGames: z.number().int().min(1).nullable(),
        winnersTakePriority: z.boolean(),
        autoRandomize: z.boolean(),
        randomizerType: z.enum(["fisher-yates", "diversity"]),
        autoCoinToss: z.boolean(),
        alwaysSplitConstraints: z.array(z.tuple([z.string(), z.string()])),
      }),
      z.object({
        mode: z.literal("manual"),
      }),
    ]),
    playerSeasonIds: z.array(z.string()),
  }))
  .mutation(async ({ ctx, input }) => {
    const session = await createSession(ctx.db, {
      ...input,
      createdBy: ctx.authentication.user.id,
    });
    broadcastSessionEvent(ctx, session.seasonId, "session:start", { session });
    return session;
  }),
```

- [ ] **Step 2: Update query procedures**

`getActive`, `getById`, `getSummary`, `listEnded` — these can stay as direct repository calls (no orchestration needed). But update imports to use new repository paths.

- [ ] **Step 3: Verify**

Run: `bun typecheck`
Run: `bun oxc`

- [ ] **Step 4: Run existing tests**

Run: `bun run test`

Fix any failures — the existing `session-router.spec.ts` and `session-score-sync.spec.ts` tests should still pass since external behavior is unchanged.

- [ ] **Step 5: Commit**

```bash
git add apps/worker/src/trpc/router/session-router.ts
git commit -m "Simplify session tRPC router to use service layer"
```

---

### Task 7: Simplify Device Router

Update session endpoints in `device-router.ts` to call the same service functions.

**Files:**

- Modify: `apps/worker/src/routes/device-router.ts` (session endpoints: lines 220-760)

- [ ] **Step 1: Rewrite session endpoints**

For each session endpoint, replace the inline logic with a service call:

- `GET /session/active` (line 220): keep `getActiveSessionFull` + `formatSessionState` (formatting is device-specific)
- `POST /session/start-match` (line 239): call `sessionService.startNextMatch()`
- `POST /session/record-result` (line 292): call `sessionService.recordResult()` — this fixes the bug where device router didn't pass `maxConsecutiveEnabled`, `winnersTakePriority`, `matchHistory`
- `POST /session/resolve-coin-toss` (line 538): call `sessionService.resolveCoinToss()`
- `POST /session/update-score` (line 651): call `sessionService.updateMatchScore()`
- `POST /session/shuffle-lineup` (line 706): keep as-is (device-specific feature)

Each endpoint keeps its Hono validation (`zValidator`), auth, and `formatSessionState` response formatting. Only the orchestration logic is replaced.

- [ ] **Step 2: Verify**

Run: `bun typecheck`
Run: `bun run test` (specifically `device-session.spec.ts`)

- [ ] **Step 3: Commit**

```bash
git add apps/worker/src/routes/device-router.ts
git commit -m "Simplify device router session endpoints to use service layer"
```

---

### Task 8: Delete Old Files + Backend Cleanup

Remove files that have been fully replaced.

**Files:**

- Delete: `apps/worker/src/lib/session-rotation.ts`
- Modify: any remaining imports

- [ ] **Step 1: Delete `session-rotation.ts`**

All its logic has moved to `strategies/winner-stays.ts` and `lib/shuffle.ts`.

- [ ] **Step 2: Update remaining imports**

Search for any imports from `session-rotation` and update to new paths:

- `apps/worker/src/test/lib/session-rotation.spec.ts` — update to import from `strategies/winner-stays.ts` and adapt test names/imports. Or delete if tests are now covered by integration tests.

- [ ] **Step 3: Verify**

Run: `bun typecheck`
Run: `bun oxc`
Run: `bun run test`

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Remove old session-rotation.ts, update imports"
```

---

## Phase 2: Integration Tests

### Task 9: Session Integration Tests

Write/update integration tests through tRPC client.

**Files:**

- Modify: `apps/worker/src/test/trpc/session-router.spec.ts`
- Reference: `apps/worker/src/test/setup/season-context-util.ts` (for test helpers)
- Reference: `apps/worker/src/test/trpc/trpc-test-client.ts` (for client setup)

- [ ] **Step 1: Read existing test patterns**

Read `session-router.spec.ts`, `trpc-test-client.ts`, and `season-context-util.ts` to understand the existing test setup and helper patterns. Understand how `createTRPCTestClient` works and how season/player context is set up.

- [ ] **Step 2: Update existing tests**

Update existing tests to use new `modeSettings` input format for `session.create`. Remove any tests that reference `"sequential"` mode.

- [ ] **Step 3: Add winner-stays flow tests**

```typescript
describe("winner-stays session flow", () => {
	it("creates session, starts match, records result, verifies next lineup", async () => {
		// 1. Create session with winner-stays settings
		// 2. Start match
		// 3. Record result (home wins)
		// 4. Verify: winners stay, losers rotate out, proposed lineup correct
	});

	it("handles draw with coin toss", async () => {
		// 1. Create session
		// 2. Start match, record draw
		// 3. Verify coin toss created
		// 4. Resolve coin toss
		// 5. Verify lineup after resolution
	});

	it("enforces max consecutive games", async () => {
		// 1. Create session with maxConsecutiveGames: 2
		// 2. Play 2 matches where same team wins
		// 3. Verify winners rotated out after 2 consecutive
	});

	it("enforces always-split constraints", async () => {
		// 1. Create session with alwaysSplitConstraints
		// 2. Start match, record result
		// 3. Verify constrained players never on same team
	});
});
```

- [ ] **Step 4: Add manual mode tests**

```typescript
describe("manual session flow", () => {
	it("creates session, starts match, records result, no auto-rotation", async () => {
		// 1. Create session with manual settings
		// 2. Start match
		// 3. Record result
		// 4. Verify: no proposed lineup returned (null)
	});
});
```

- [ ] **Step 5: Add player management tests**

```typescript
describe("player management", () => {
	it("adds player mid-session, updates queue", async () => {});
	it("removes player from proposed lineup, recomputes", async () => {});
});
```

- [ ] **Step 6: Add undo test**

```typescript
describe("match undo", () => {
	it("deletes last match, reverts queue state", async () => {
		// 1. Create session, play 2 matches
		// 2. Delete last match
		// 3. Verify queue positions match state after first match
	});
});
```

- [ ] **Step 7: Run all tests**

Run: `bun run test`

All tests should pass.

- [ ] **Step 8: Commit**

```bash
git add apps/worker/src/test/
git commit -m "Update session integration tests for refactored service layer"
```

---

## Phase 3: Frontend

### Task 10: Frontend Types + Hooks

Clean up types, extract hooks, fix type safety.

**Files:**

- Modify: `apps/web/src/routes/_authenticated/_sidebar/leagues/$slug/seasons/$seasonSlug/session/$sessionId/-components/session-types.ts`
- Modify: `apps/web/src/lib/trpc.ts`
- Modify: `apps/web/src/lib/utils.ts`
- Create: `apps/web/src/hooks/use-session-mutations.ts`
- Create: `apps/web/src/hooks/use-score-sync.ts`
- Create: `apps/web/src/hooks/use-session-sse.ts`
- Modify: `apps/web/src/hooks/use-season-sse.ts`

- [ ] **Step 1: Fix `session-types.ts`**

Update `GameSession` type:

- Change `rotationMode` to `"winner-stays" | "manual"` (remove `"round-robin"`)
- Add `modeSettings: ModeSettings | null` field
- Remove flat setting fields (`winnersTakePriority`, `maxConsecutiveEnabled`, `autoRandomize`, `autoCoinToss`, `alwaysSplitConstraints`, `maxConsecutiveGames`) — these now come from `modeSettings`

Import `ModeSettings` from the shared types (or redefine on frontend if the worker types aren't directly importable — check existing import patterns).

- [ ] **Step 2: Fix `utils.ts`**

Update `rotationLabel`:

- Remove `"round-robin"` and `"winner-stays-hard"` mappings
- Keep `"winner-stays"` → `"Winner Stays"` and `"manual"` → `"Manual"`

- [ ] **Step 3: Fix tRPC type safety**

Investigate whether `AnyTRPC = any` (line 30 of `trpc.ts`) can be removed. The root cause is likely a type inference issue with Cloudflare Worker's tRPC setup. If it can't be fully removed, at minimum create a properly typed helper for session queries instead of casting everywhere:

```typescript
// If AnyTRPC must stay for other routes, at least type the session client:
import type { TRPCRouter } from "worker";
type SessionRouter = TRPCRouter["session"];
```

If `AnyTRPC` can be removed entirely, do so and fix all resulting type errors. Remove all `as Promise<...>` casts that were needed because of `AnyTRPC`.

- [ ] **Step 4: Create `use-session-mutations.ts`**

Extract all 11 mutations from the session page into a single hook:

```typescript
// apps/web/src/hooks/use-session-mutations.ts
export function useSessionMutations(sessionId: string) {
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  const invalidateSession = () => {
    queryClient.invalidateQueries({ queryKey: trpc.session.getById.queryKey({ sessionId }) });
  };

  const startNextMatch = useMutation({ ... });
  const recordResult = useMutation({ ... });
  const cancelMatch = useMutation({ ... });
  const deleteLastMatch = useMutation({ ... });
  const addPlayer = useMutation({ ... });
  const removePlayer = useMutation({ ... });
  const updateTeamSelection = useMutation({ ... });
  const updateProposedLineup = useMutation({ ... });
  const endSession = useMutation({ ... });

  return {
    startNextMatch,
    recordResult,
    cancelMatch,
    deleteLastMatch,
    addPlayer,
    removePlayer,
    updateTeamSelection,
    updateProposedLineup,
    endSession,
  };
}
```

Use proper tRPC-generated query keys (not manual `["session", sessionId]`).

- [ ] **Step 5: Create `use-score-sync.ts`**

Extract the debounced score sync from session page (lines 108-109, 137-145, 240-270):

```typescript
// apps/web/src/hooks/use-score-sync.ts
export function useScoreSync(sessionId: string, currentMatch: SessionMatch | null) {
	const [homeScore, setHomeScore] = useState(0);
	const [awayScore, setAwayScore] = useState(0);
	const { updateMatchScore } = useSessionMutations(sessionId);

	// Sync from server when match changes
	useEffect(() => {
		setHomeScore(currentMatch?.homeSessionScore ?? 0);
		setAwayScore(currentMatch?.awaySessionScore ?? 0);
	}, [currentMatch?.id]);

	// Debounced sync to server
	// ... (move debounce logic from session page)

	return { homeScore, awayScore, setHomeScore, setAwayScore };
}
```

- [ ] **Step 6: Create `use-session-sse.ts`**

Extract session-specific SSE event handling from the session page (lines 74-104):

```typescript
// apps/web/src/hooks/use-session-sse.ts
export function useSessionSSE(sessionId: string, onEnd: () => void) {
	// Listen for session-event CustomEvents
	// Handle session:end -> call onEnd
	// Handle session:update -> invalidate session query
	// Single invalidation path (remove duplicate from use-season-sse.ts)
}
```

- [ ] **Step 7: Fix double query invalidation**

In `use-season-sse.ts` (lines 153-158), it invalidates both `t.session.getById.queryKey` and manual `["session", sessionId]`. Since we're switching to tRPC-generated keys everywhere, remove the manual key invalidation.

- [ ] **Step 8: Verify**

Run: `bun typecheck`
Run: `bun oxc`

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "Clean up frontend session types, extract hooks, fix type safety"
```

---

### Task 11: Shared Frontend Components

Split `score-stepper.tsx` and organize shared components.

**Files:**

- Create: `apps/web/src/routes/_authenticated/_sidebar/leagues/$slug/seasons/$seasonSlug/session/$sessionId/-components/shared/score-stepper.tsx`
- Create: `.../-components/shared/team-roster-card.tsx`
- Create: `.../-components/shared/match-actions.tsx`
- Create: `.../-components/shared/session-dashboard.tsx`
- Create: `.../-components/shared/session-standings.tsx`
- Create: `.../-components/shared/add-player-dialog.tsx`
- Modify: `.../-components/index.ts` (barrel)

- [ ] **Step 1: Create `shared/` directory**

Move and split existing components:

- `score-stepper.tsx` → `shared/score-stepper.tsx` (only `ScoreStepper` component)
- Extract `TeamRosterCard` from `score-stepper.tsx` → `shared/team-roster-card.tsx`
- `session-dashboard-cards.tsx` → `shared/session-dashboard.tsx`
- `session-standings.tsx` → `shared/session-standings.tsx`
- `add-player-dialog.tsx` → `shared/add-player-dialog.tsx`

- [ ] **Step 2: Create `shared/match-actions.tsx`**

Extract the match action buttons (Start Match, Record Result, Cancel Match) from the monolithic page into a reusable component. Both winner-stays and manual modes use these.

```typescript
export function MatchActions({
	currentMatch,
	onStartMatch,
	onRecordResult,
	onCancelMatch,
	isStarting,
	isRecording,
	isCanceling,
}: MatchActionsProps) {
	// Start match button (when no current match)
	// Record result buttons (home/away/draw) (when match active)
	// Cancel match button
}
```

- [ ] **Step 3: Update barrel export**

Update `.../-components/index.ts` to export from new paths.

- [ ] **Step 4: Verify**

Run: `bun typecheck`

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Split session shared components into individual files"
```

---

### Task 12: Winner-Stays Session Page

Create the winner-stays-specific session experience.

**Files:**

- Create: `.../-components/winner-stays/winner-stays-session.tsx`
- Create: `.../-components/winner-stays/queue-panel.tsx`
- Create: `.../-components/winner-stays/rotation-controls.tsx`
- Move: `.../-components/coin-toss-dialog.tsx` → `.../-components/winner-stays/coin-toss-dialog.tsx`
- Move: `.../-components/coin-toss-dialog.css` → `.../-components/winner-stays/coin-toss-dialog.css`

- [ ] **Step 1: Create `queue-panel.tsx`**

Move `QueueList` and `PlayerQueueRow` from old `score-stepper.tsx`:

```typescript
export function QueuePanel({
	session,
	onRemovePlayer,
	onRejoinPlayer,
	isRemoving,
	isRejoining,
}: QueuePanelProps) {
	// Queue list showing waiting/playing/out players
	// Always-split pairs display
	// Add player button
}
```

- [ ] **Step 2: Create `rotation-controls.tsx`**

Extract shuffle/even/rotation buttons from the session page:

```typescript
export function RotationControls({
	teamAssignment,
	session,
	onShuffle,
	onShuffleSelected,
	onEven,
	onRotation,
	isShuffling,
}: RotationControlsProps) {
	// Shuffle, Shuffle Selected, Even, Rotation buttons
}
```

- [ ] **Step 3: Move coin toss to winner-stays directory**

Move `coin-toss-dialog.tsx` and `coin-toss-dialog.css` into `winner-stays/`. Remove the unused `onOpenChange` prop.

- [ ] **Step 4: Create `winner-stays-session.tsx`**

This is the main winner-stays experience. It uses:

- Shared: `ScoreStepper`, `TeamRosterCard`, `MatchActions`, `SessionDashboard`, `SessionStandings`, `AddPlayerDialog`
- Winner-stays only: `QueuePanel`, `RotationControls`, `CoinTossDialog`
- Hooks: `useSessionMutations`, `useScoreSync`, `useSessionSSE`

Port the relevant state and logic from the old monolith's winner-stays code paths. The team assignment derivation logic (old lines 147-229) lives here.

```typescript
export function WinnerStaysSession({ session }: { session: GameSession }) {
  const mutations = useSessionMutations(session.id);
  const currentMatch = session.matches.find(m => m.result === null);
  const scoreSync = useScoreSync(session.id, currentMatch);

  // Team assignment state + derivation (from proposed lineup / active match)
  // Coin toss state
  // Queue management

  return (
    // Two-column layout:
    // Left: Match card (scores + teams + rotation controls + match actions)
    // Right: Queue panel + Standings
  );
}
```

- [ ] **Step 5: Verify**

Run: `bun typecheck`

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Create winner-stays session page with queue and rotation UI"
```

---

### Task 13: Manual Session Page

Create the simplified manual session experience.

**Files:**

- Create: `.../-components/manual/manual-session.tsx`
- Create: `.../-components/manual/team-picker.tsx`

- [ ] **Step 1: Create `team-picker.tsx`**

A simpler team selection UI — no queue, no rotation. Just pick players for home/away:

```typescript
export function TeamPicker({ players, teamAssignment, onAssignPlayer, teamSize }: TeamPickerProps) {
	// Simple drag/click to assign players to home or away
	// No shuffle/even/rotation buttons
}
```

- [ ] **Step 2: Create `manual-session.tsx`**

Stripped-down experience. No queue, no rotation, no coin toss, no always-split.

```typescript
export function ManualSession({ session }: { session: GameSession }) {
  const mutations = useSessionMutations(session.id);
  const currentMatch = session.matches.find(m => m.result === null);
  const scoreSync = useScoreSync(session.id, currentMatch);

  return (
    // Simpler layout:
    // Team picker + score tracking + match actions + standings
    // No queue panel, no rotation controls
  );
}
```

- [ ] **Step 3: Verify**

Run: `bun typecheck`

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Create manual session page with simplified team selection"
```

---

### Task 14: Update Session Page Shell + Start Dialog

Wire up the mode switch and update session creation.

**Files:**

- Modify: `.../$sessionId/index.tsx` (rewrite to thin shell)
- Modify: `.../-components/session/start-session-dialog.tsx`
- Modify: `.../-components/index.ts` (barrel)

- [ ] **Step 1: Rewrite session page as thin shell**

Replace the 981-line monolith with a mode switch:

```typescript
function SessionLivePage() {
  const { sessionId } = Route.useParams();
  const session = useSessionQuery(sessionId);
  const navigate = useNavigate();

  useSessionSSE(sessionId, () => {
    navigate({ to: "../../" });
    toast.info("Session ended");
  });

  if (!session) return <LoadingState />;

  const settings = session.modeSettings;
  if (!settings) {
    // Old session without modeSettings — show end session button, don't crash
    return <LegacySessionFallback session={session} />;
  }

  switch (settings.mode) {
    case "winner-stays":
      return <WinnerStaysSession session={session} />;
    case "manual":
      return <ManualSession session={session} />;
    default:
      exhaustiveCheck(settings.mode);
  }
}
```

- [ ] **Step 2: Update `StartSessionDialog`**

1. Change `RotationMode` type to `"winner-stays" | "manual"` (remove `"sequential"`)
2. Replace flat settings state with `ModeSettings` discriminated union in the reducer
3. Update the `create` mutation call to send `modeSettings` instead of flat fields
4. Remove sequential UI option from the rotation mode selector
5. Conditionally show winner-stays settings only when `rotationMode === "winner-stays"`

- [ ] **Step 3: Update barrel exports**

Remove dead exports from `.../-components/index.ts`:

- Remove `PlayerSelectionDrawer` export (line 4 — dead code)
- Update paths for moved components

- [ ] **Step 4: Verify**

Run: `bun typecheck`
Run: `bun oxc`
Run: `bun dev` (to trigger TanStack Router code generation for any route changes)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Rewrite session page as mode switch, update start dialog for modeSettings"
```

---

### Task 15: Dead Code Cleanup + Final Polish

Remove all remaining dead code and fix remaining issues.

**Files:**

- Delete: `.../$sessionId/-components/player-selection-drawer.tsx` (dead code, never imported)
- Delete: old `.../$sessionId/-components/score-stepper.tsx` (replaced by split files)
- Delete: old `.../$sessionId/-components/session-dashboard-cards.tsx` (moved to shared/)
- Delete: old `.../$sessionId/-components/session-standings.tsx` (moved to shared/)
- Delete: old `.../$sessionId/-components/add-player-dialog.tsx` (moved to shared/)
- Modify: `apps/web/src/lib/event-types.ts` — clean up if needed
- Modify: `apps/web/src/hooks/use-season-sse.ts` — remove manual query key invalidation

- [ ] **Step 1: Delete dead files**

Remove files listed above.

- [ ] **Step 2: Search for remaining `"sequential"` and `"round-robin"` references**

Run a project-wide search and remove/update any remaining references.

- [ ] **Step 3: Search for remaining `AnyTRPC` usage in session code**

Ensure all session-related code uses properly typed tRPC client.

- [ ] **Step 4: Final verification**

Run: `bun typecheck`
Run: `bun oxc`
Run: `bun run test`
Run: `bun check` (if available)

All must pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Remove dead code, clean up sequential/round-robin references"
```

---

## Summary

| Phase                     | Tasks | Description                                                                           |
| ------------------------- | ----- | ------------------------------------------------------------------------------------- |
| **1: Backend Foundation** | 1-8   | Types, schema, repo split, strategies, service, router simplification, cleanup        |
| **2: Integration Tests**  | 9     | Test flows through tRPC client                                                        |
| **3: Frontend**           | 10-15 | Types, hooks, shared components, mode-specific pages, start dialog, dead code cleanup |

**Total: 15 tasks.** Each task is a self-contained commit. The codebase should be working after each task.
