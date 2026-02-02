# Extract tRPC Package Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract tRPC routers and middleware from `@scorebrawl/database` into a new `@scorebrawl/trpc` package.

**Architecture:** Create layered architecture where database package handles data access and the new trpc package handles API layer concerns (routing, middleware, auth). The trpc package will depend on database.

**Tech Stack:** tRPC, TypeScript, Vitest, Bun workspace

---

## Task 1: Create New Package Structure

**Files:**
- Create: `packages/trpc/package.json`
- Create: `packages/trpc/tsconfig.json`
- Create: `packages/trpc/vitest.config.ts`
- Create: `packages/trpc/src/index.ts`

**Step 1: Create package directory**

```bash
mkdir -p packages/trpc/src
```

**Step 2: Create package.json**

Create `packages/trpc/package.json`:

```json
{
  "name": "@scorebrawl/trpc",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./types": "./src/types.ts",
    "./routers/*": "./src/routers/*.ts"
  },
  "dependencies": {
    "@scorebrawl/database": "workspace:*",
    "@scorebrawl/utils": "workspace:*",
    "@trpc/server": "next",
    "better-auth": "^1.1.6",
    "superjson": "^2.2.1",
    "zod": "^3.24.2"
  },
  "devDependencies": {
    "@scorebrawl/typescript-config": "workspace:*",
    "@types/bun": "latest",
    "typescript": "5.5.4",
    "vitest": "^3.0.5"
  },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

**Step 3: Create tsconfig.json**

Create `packages/trpc/tsconfig.json`:

```json
{
  "extends": "@scorebrawl/typescript-config/base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 4: Create vitest.config.ts**

Create `packages/trpc/vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    testTimeout: 30000,
  },
});
```

**Step 5: Create placeholder index.ts**

Create `packages/trpc/src/index.ts`:

```typescript
// Exports will be added after moving files
export {};
```

**Step 6: Install dependencies**

```bash
cd packages/trpc
bun install
cd ../..
```

Expected: Dependencies installed successfully

**Step 7: Commit**

```bash
git add packages/trpc
git commit -m "feat: create @scorebrawl/trpc package structure"
```

---

## Task 2: Move Core tRPC Files

**Files:**
- Move: `packages/database/src/trpc/trpc.ts` → `packages/trpc/src/trpc.ts`
- Move: `packages/database/src/trpc/root.ts` → `packages/trpc/src/root.ts`
- Move: `packages/database/src/trpc/types.ts` → `packages/trpc/src/types.ts`
- Modify: `packages/trpc/src/trpc.ts` (update imports)
- Modify: `packages/trpc/src/root.ts` (update imports)

**Step 1: Copy trpc.ts and update imports**

Copy file:
```bash
cp packages/database/src/trpc/trpc.ts packages/trpc/src/trpc.ts
```

Update imports in `packages/trpc/src/trpc.ts`:

```typescript
// Change line 1-2 from:
import { ScoreBrawlError } from "../errors";
import { findBySlugWithUserRole } from "../repositories/league-repository";

// To:
import { ScoreBrawlError } from "@scorebrawl/database";
import { findBySlugWithUserRole } from "@scorebrawl/database/repositories/league-repository";
```

Also update line 3:
```typescript
// Change:
import { findSeasonAndLeagueBySlug } from "../repositories/season-repository";

// To:
import { findSeasonAndLeagueBySlug } from "@scorebrawl/database/repositories/season-repository";
```

**Step 2: Copy types.ts**

```bash
cp packages/database/src/trpc/types.ts packages/trpc/src/types.ts
```

**Step 3: Copy root.ts and update imports**

Copy file:
```bash
cp packages/database/src/trpc/root.ts packages/trpc/src/root.ts
```

Read the file to see its structure, then update all router imports from relative paths like `./routers/season-router` to `./routers/season-router`.

**Step 4: Verify TypeScript compiles**

```bash
cd packages/trpc
bun run tsc --noEmit
cd ../..
```

Expected: No compilation errors (may have errors about missing router files - that's expected)

**Step 5: Commit**

```bash
git add packages/trpc/src/trpc.ts packages/trpc/src/root.ts packages/trpc/src/types.ts
git commit -m "feat: move core tRPC files to new package"
```

---

## Task 3: Move Router Files (Part 1 of 2)

**Files:**
- Move: `packages/database/src/trpc/routers/season-router.ts` → `packages/trpc/src/routers/season-router.ts`
- Move: `packages/database/src/trpc/routers/league-router.ts` → `packages/trpc/src/routers/league-router.ts`
- Move: `packages/database/src/trpc/routers/match-router.ts` → `packages/trpc/src/routers/match-router.ts`
- Move: `packages/database/src/trpc/routers/user-router.ts` → `packages/trpc/src/routers/user-router.ts`
- Move: `packages/database/src/trpc/routers/league-player-router.ts` → `packages/trpc/src/routers/league-player-router.ts`
- Move: `packages/database/src/trpc/routers/league-team-router.ts` → `packages/trpc/src/routers/league-team-router.ts`

**Step 1: Create routers directory**

```bash
mkdir -p packages/trpc/src/routers
```

**Step 2: Move and update season-router.ts**

```bash
cp packages/database/src/trpc/routers/season-router.ts packages/trpc/src/routers/season-router.ts
```

Update imports (lines 3-14, 17-21):

```typescript
// Change repository imports from:
import { getLeaguePlayers } from "../../repositories/player-repository";
import {
  create,
  findActive,
  findFixtures,
  getAll,
  getBySlug,
  getCountInfo,
  update,
  updateClosedStatus,
} from "../../repositories/season-repository";

// To:
import { getLeaguePlayers } from "@scorebrawl/database/repositories/player-repository";
import {
  create,
  findActive,
  findFixtures,
  getAll,
  getBySlug,
  getCountInfo,
  update,
  updateClosedStatus,
} from "@scorebrawl/database/repositories/season-repository";

// Change DTO/model imports from:
import { SeasonCreateDTOSchema, SeasonEditDTOSchema } from "../../dto";
import { SeasonCreateSchema, SeasonEditSchema } from "../../model";

// To:
import { SeasonCreateDTOSchema, SeasonEditDTOSchema } from "@scorebrawl/database/dto";
import { SeasonCreateSchema, SeasonEditSchema } from "@scorebrawl/database/model";
```

**Step 3: Move and update remaining routers**

For each router file (league-router.ts, match-router.ts, user-router.ts, league-player-router.ts, league-team-router.ts):

```bash
cp packages/database/src/trpc/routers/[router-name].ts packages/trpc/src/routers/[router-name].ts
```

Then update all imports following the same pattern:
- `../../repositories/*` → `@scorebrawl/database/repositories/*`
- `../../dto` → `@scorebrawl/database/dto`
- `../../model` → `@scorebrawl/database/model`
- `../trpc` → `../trpc`

**Step 4: Verify TypeScript compiles**

```bash
cd packages/trpc
bun run tsc --noEmit
cd ../..
```

Expected: No compilation errors

**Step 5: Commit**

```bash
git add packages/trpc/src/routers/
git commit -m "feat: move router files (part 1) to new package"
```

---

## Task 4: Move Router Files (Part 2 of 2)

**Files:**
- Move: `packages/database/src/trpc/routers/season-player-router.ts` → `packages/trpc/src/routers/season-player-router.ts`
- Move: `packages/database/src/trpc/routers/season-team-router.ts` → `packages/trpc/src/routers/season-team-router.ts`
- Move: `packages/database/src/trpc/routers/member-router.ts` → `packages/trpc/src/routers/member-router.ts`
- Move: `packages/database/src/trpc/routers/invite-router.ts` → `packages/trpc/src/routers/invite-router.ts`
- Move: `packages/database/src/trpc/routers/avatar-router.ts` → `packages/trpc/src/routers/avatar-router.ts`
- Move: `packages/database/src/trpc/routers/achievement-router.ts` → `packages/trpc/src/routers/achievement-router.ts`

**Step 1: Move and update remaining routers**

For each router file:

```bash
cp packages/database/src/trpc/routers/[router-name].ts packages/trpc/src/routers/[router-name].ts
```

Update imports:
- `../../repositories/*` → `@scorebrawl/database/repositories/*`
- `../../dto` → `@scorebrawl/database/dto`
- `../../model` → `@scorebrawl/database/model`
- `../../schema` → `@scorebrawl/database/schema`
- `../trpc` → `../trpc`

**Step 2: Verify TypeScript compiles**

```bash
cd packages/trpc
bun run tsc --noEmit
cd ../..
```

Expected: No compilation errors

**Step 3: Commit**

```bash
git add packages/trpc/src/routers/
git commit -m "feat: move router files (part 2) to new package"
```

---

## Task 5: Move Test Files

**Files:**
- Move: `packages/database/src/trpc/__tests__/*.test.ts` → `packages/trpc/src/routers/__tests__/*.spec.ts`
- Create: `packages/trpc/test/` (if needed for test utilities)

**Step 1: Create test directory**

```bash
mkdir -p packages/trpc/src/routers/__tests__
```

**Step 2: Move and rename test files**

```bash
cp packages/database/src/trpc/__tests__/season-router.test.ts packages/trpc/src/routers/__tests__/season-router.spec.ts
cp packages/database/src/trpc/__tests__/league-router.test.ts packages/trpc/src/routers/__tests__/league-router.spec.ts
cp packages/database/src/trpc/__tests__/match-router.test.ts packages/trpc/src/routers/__tests__/match-router.spec.ts
cp packages/database/src/trpc/__tests__/user-router.test.ts packages/trpc/src/routers/__tests__/user-router.spec.ts
```

**Step 3: Update test imports**

For each test file, update imports:
- Repository imports: `../../../repositories/*` → `@scorebrawl/database/repositories/*`
- Test utilities: May need to reference database test utils or copy them
- Router imports: `../season-router` → `../season-router` (stays relative)

**Step 4: Check if test utilities are needed**

```bash
grep -r "test-utils\|preload\|infra" packages/database/src/trpc/__tests__/
```

If test utilities are imported, check `packages/database/test/` and decide whether to:
- Import from `@scorebrawl/database` test directory
- Copy utilities to `packages/trpc/test/`

**Step 5: Run tests**

```bash
cd packages/trpc
bun test
cd ../..
```

Expected: Tests pass (or fail with clear errors about missing setup)

**Step 6: Commit**

```bash
git add packages/trpc/src/routers/__tests__/
git commit -m "feat: move and rename test files to new package"
```

---

## Task 6: Update Package Index Exports

**Files:**
- Modify: `packages/trpc/src/index.ts`

**Step 1: Update index.ts with exports**

Replace content of `packages/trpc/src/index.ts`:

```typescript
export { appRouter, createCaller } from "./root";
export type { AppRouter } from "./root";
export {
  createTRPCRouter,
  createCallerFactory,
  protectedProcedure,
  leagueProcedure,
  seasonProcedure,
  leagueEditorProcedure,
  editorRoles,
  type TRPCContext,
} from "./trpc";
```

**Step 2: Verify exports are correct**

```bash
cd packages/trpc
bun run tsc --noEmit
cd ../..
```

Expected: No errors

**Step 3: Commit**

```bash
git add packages/trpc/src/index.ts
git commit -m "feat: add exports to trpc package index"
```

---

## Task 7: Update Database Package

**Files:**
- Modify: `packages/database/package.json`
- Delete: `packages/database/src/trpc/` (entire directory)

**Step 1: Update database package.json**

Remove these lines from `packages/database/package.json` exports section:
```json
"./trpc": "./src/trpc/index.ts",
"./trpc/types": "./src/trpc/types.ts"
```

Remove these dependencies:
```json
"@trpc/server": "next",
"superjson": "^2.2.1"
```

Keep `better-auth` and `zod` (still used by database).

**Step 2: Remove old trpc directory**

```bash
rm -rf packages/database/src/trpc
```

**Step 3: Run database tests**

```bash
cd packages/database
bun test
cd ../..
```

Expected: All tests pass

**Step 4: Commit**

```bash
git add packages/database/package.json
git add -u packages/database/src/trpc/
git commit -m "refactor: remove trpc code from database package"
```

---

## Task 8: Update Application Imports

**Files:**
- Modify: `apps/backend/src/trpc.ts`
- Modify: `apps/frontend/src/lib/trpc.ts`

**Step 1: Update backend imports**

In `apps/backend/src/trpc.ts`, change line 1:

```typescript
// From:
import { appRouter, type TRPCContext } from "@scorebrawl/database/trpc";

// To:
import { appRouter, type TRPCContext } from "@scorebrawl/trpc";
```

**Step 2: Update frontend imports**

In `apps/frontend/src/lib/trpc.ts`, change line 4:

```typescript
// From:
import type { AppRouter } from "@scorebrawl/database/trpc/types";

// To:
import type { AppRouter } from "@scorebrawl/trpc/types";
```

**Step 3: Install dependencies in apps**

```bash
cd apps/backend
bun install
cd ../frontend
bun install
cd ../..
```

Expected: Dependencies resolve correctly

**Step 4: Verify TypeScript in backend**

```bash
cd apps/backend
bun run tsc --noEmit
cd ../..
```

Expected: No compilation errors

**Step 5: Verify TypeScript in frontend**

```bash
cd apps/frontend
bun run tsc --noEmit
cd ../..
```

Expected: No compilation errors

**Step 6: Commit**

```bash
git add apps/backend/src/trpc.ts apps/frontend/src/lib/trpc.ts
git commit -m "refactor: update app imports to use new trpc package"
```

---

## Task 9: Full Integration Test

**Files:**
- Test all packages and apps

**Step 1: Install all dependencies**

```bash
bun install
```

Expected: All dependencies install successfully

**Step 2: Run all tests**

```bash
bun test
```

Expected: All tests pass

**Step 3: Build all packages**

```bash
bun run build
```

Expected: All packages build successfully

**Step 4: Start backend server**

```bash
bun run dev:new
```

Expected: Backend starts without errors, frontend starts and can connect to tRPC

**Step 5: Manual verification**

Open browser, verify:
- Frontend loads
- tRPC requests work
- No console errors

**Step 6: Stop servers and commit verification**

```bash
# Stop servers with Ctrl+C
git add .
git status
```

Expected: Working tree clean (all changes committed)

---

## Final Verification Checklist

- [ ] `packages/trpc` package created with correct structure
- [ ] All tRPC files moved with updated imports
- [ ] All tests moved and passing
- [ ] Database package cleaned up
- [ ] App imports updated
- [ ] TypeScript compiles in all packages
- [ ] All tests pass
- [ ] Backend serves tRPC endpoints
- [ ] Frontend can make tRPC requests
- [ ] No circular dependencies
- [ ] All changes committed
