# Scaffold `packages/core` + `packages/client` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create `packages/core` and `packages/client` as TypeScript-source workspace packages and prove they resolve from worker, web, and mobile.

**Architecture:** Two private, no-build packages whose `main`/`exports` point at `./src/index.ts` (the `packages/util` pattern). Internal imports are extensionless and tsconfig uses `moduleResolution: "bundler"`, because Metro does not map NodeNext-style `.js` specifiers onto `.ts` (verified in the spec). Consumers get `workspace:*` dependency edges; the worker deliberately gets no `client` edge.

**Tech Stack:** Bun workspaces, Turbo, TypeScript (`tsc` for these packages), Vitest, Vite, Wrangler/esbuild, Expo/Metro.

**Spec:** `docs/superpowers/specs/2026-10-13-shared-core-client-packages-design.md`

## Global Constraints

- Package manager is **bun** only. Never npm/yarn/pnpm.
- Workspace dependency versions use `catalog:`.
- `packages/core`: framework-agnostic — no React, DOM, Node, or worker globals.
- `packages/client`: React-only — never imported by `apps/worker`.
- No package may import from `apps/*`.
- Internal relative imports inside `core`/`client` are **extensionless** (no `.js`).
- `packages/util` is not modified in this plan.
- Package scripts mirror `packages/util`: `typecheck` = `tsc --noEmit`, `test` = `vitest run`.
- Route files use directory structure, never dot notation. (Not applicable here, listed for the executor's awareness.)

## Review Focus

- **A core file using a Node/worker global** (`process`, `Buffer`, `crypto`, `console` beyond ES2023) must be a typecheck error: `types: []` plus no DOM/Node lib must reject it. Task 1 pins this.
- **A worker import of `@coding-cowboys/scorebrawl-client`** must fail typecheck and the wrangler build. Task 4 pins this.
- **A `.js` relative specifier creeping into `core`/`client` source** must fail the mobile bundle. Task 4's mobile proof pins this (it is the failure reproduced in the spec).
- **`catalog:` in `peerDependencies` being unsupported by bun** would break install. Tasks 2 and 3 pin this via `bun install`.
- **A consumer resolving a subpath not declared in `exports`** — there are none yet; the `exports` maps must include `"."` so bare imports resolve. Tasks 1–3 pin this.

---

### Task 1: `packages/core`

**Files:**
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/src/index.ts`
- Create: `packages/core/src/index.spec.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: package `@coding-cowboys/scorebrawl-core` with named export `corePackageName: string`. Later tasks import it from `apps/*`.

- [ ] **Step 1: Create `packages/core/package.json`**

```json
{
	"name": "@coding-cowboys/scorebrawl-core",
	"version": "0.0.0",
	"private": true,
	"type": "module",
	"main": "./src/index.ts",
	"exports": {
		".": "./src/index.ts"
	},
	"scripts": {
		"typecheck": "tsc --noEmit",
		"test": "vitest run"
	},
	"devDependencies": {
		"typescript": "catalog:",
		"vitest": "catalog:"
	}
}
```

- [ ] **Step 2: Create `packages/core/tsconfig.json`**

`moduleResolution: "bundler"` (not NodeNext) and `types: []` with no DOM lib are the whole point: they make Node/worker/DOM globals a typecheck error.

```json
{
	"compilerOptions": {
		"target": "ES2022",
		"lib": ["ES2023"],
		"module": "ESNext",
		"skipLibCheck": true,
		"moduleResolution": "bundler",
		"isolatedModules": true,
		"moduleDetection": "force",
		"noEmit": true,
		"strict": true,
		"noUnusedLocals": true,
		"noUnusedParameters": true,
		"noFallthroughCasesInSwitch": true,
		"noUncheckedSideEffectImports": true,
		"types": []
	},
	"include": ["src"]
}
```

- [ ] **Step 3: Install so the workspace and its toolchain bins are linked**

Run: `bun install`
Expected: succeeds, no errors.

- [ ] **Step 4: Write the failing test**

```ts
// packages/core/src/index.spec.ts
import { describe, expect, it } from "vitest";
import { corePackageName } from "./index";

describe("core", () => {
	it("exposes its package name", () => {
		expect(corePackageName).toBe("@coding-cowboys/scorebrawl-core");
	});
});
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `bun --cwd packages/core test`
Expected: FAIL — cannot resolve `./index`.

- [ ] **Step 6: Implement `packages/core/src/index.ts`**

```ts
export const corePackageName = "@coding-cowboys/scorebrawl-core";
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `bun --cwd packages/core test`
Expected: PASS, 1 test.

- [ ] **Step 8: Verify the framework-agnostic guardrail**

Temporarily add `export const _probe = process.exit;` to `packages/core/src/index.ts`, then run `bun --cwd packages/core typecheck`.
Expected: FAIL with `Cannot find name 'process'`. Revert the line and re-run; expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add packages/core
git commit -m "feat(core): scaffold @coding-cowboys/scorebrawl-core (#696)"
```

---

### Task 2: `packages/client`

**Files:**
- Create: `packages/client/package.json`
- Create: `packages/client/tsconfig.json`
- Create: `packages/client/src/index.ts`
- Create: `packages/client/src/index.spec.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: package `@coding-cowboys/scorebrawl-client` with named exports `clientPackageName: string` and `ScorebrawlClientContext` (a React `Context<string | null>`). Peer deps: `react`, `@tanstack/react-query`, `@trpc/client`. Later tasks import `clientPackageName` from `apps/web` and `apps/mobile`.

- [ ] **Step 1: Create `packages/client/package.json`**

```json
{
	"name": "@coding-cowboys/scorebrawl-client",
	"version": "0.0.0",
	"private": true,
	"type": "module",
	"main": "./src/index.ts",
	"exports": {
		".": "./src/index.ts"
	},
	"scripts": {
		"typecheck": "tsc --noEmit",
		"test": "vitest run"
	},
	"peerDependencies": {
		"@tanstack/react-query": "catalog:",
		"@trpc/client": "catalog:",
		"react": "catalog:"
	},
	"devDependencies": {
		"@tanstack/react-query": "catalog:",
		"@trpc/client": "catalog:",
		"@types/react": "catalog:",
		"react": "catalog:",
		"typescript": "catalog:",
		"vitest": "catalog:"
	}
}
```

- [ ] **Step 2: Run `bun install`**

Run: `bun install`
Expected: succeeds. If bun rejects `catalog:` in `peerDependencies`, replace the three peer entries with the resolved catalog values `"@tanstack/react-query": "^5.90.12"`, `"@trpc/client": "^11.8.0"`, `"react": "19.2.3"` and re-run.

- [ ] **Step 3: Create `packages/client/tsconfig.json`**

Same as core plus `jsx` and DOM lib (for `@types/react`):

```json
{
	"compilerOptions": {
		"target": "ES2022",
		"lib": ["ES2023", "DOM"],
		"module": "ESNext",
		"skipLibCheck": true,
		"moduleResolution": "bundler",
		"isolatedModules": true,
		"moduleDetection": "force",
		"jsx": "react-jsx",
		"noEmit": true,
		"strict": true,
		"noUnusedLocals": true,
		"noUnusedParameters": true,
		"noFallthroughCasesInSwitch": true,
		"noUncheckedSideEffectImports": true,
		"types": []
	},
	"include": ["src"]
}
```

- [ ] **Step 4: Write the failing test**

```ts
// packages/client/src/index.spec.ts
import { describe, expect, it } from "vitest";
import { clientPackageName } from "./index";

describe("client", () => {
	it("exposes its package name", () => {
		expect(clientPackageName).toBe("@coding-cowboys/scorebrawl-client");
	});
});
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `bun --cwd packages/client test`
Expected: FAIL — cannot resolve `./index`.

- [ ] **Step 6: Implement `packages/client/src/index.ts`**

`createContext` is a runtime `react` import, so this also proves the peer resolves.

```ts
import { createContext } from "react";

export const clientPackageName = "@coding-cowboys/scorebrawl-client";

export const ScorebrawlClientContext = createContext<string | null>(null);
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `bun --cwd packages/client test`
Expected: PASS, 1 test.

- [ ] **Step 8: Typecheck the package**

Run: `bun --cwd packages/client typecheck`
Expected: PASS (also proves `react` and `@types/react` resolve under `types: []`).

- [ ] **Step 9: Commit**

```bash
git add packages/client
git commit -m "feat(client): scaffold @coding-cowboys/scorebrawl-client (#696)"
```

---

### Task 3: Wire consumer dependencies

**Files:**
- Modify: `apps/worker/package.json` (add `@coding-cowboys/scorebrawl-core` to `dependencies`)
- Modify: `apps/web/package.json` (add `@coding-cowboys/scorebrawl-core` and `@coding-cowboys/scorebrawl-client` to `dependencies`)
- Modify: `apps/mobile/package.json` (add `@coding-cowboys/scorebrawl-core` and `@coding-cowboys/scorebrawl-client` to `dependencies`)

**Interfaces:**
- Consumes: the two packages from Tasks 1 and 2.
- Produces: resolvable `node_modules/@coding-cowboys/scorebrawl-core` and `.../scorebrawl-client` from each consumer. Worker must NOT gain a `client` edge.

- [ ] **Step 1: Add `core` to the worker**

In `apps/worker/package.json` `dependencies`, insert before the existing `"@coding-cowboys/scorebrawl-util"` line:

```json
		"@coding-cowboys/scorebrawl-core": "workspace:*",
```

Do not add `@coding-cowboys/scorebrawl-client`.

- [ ] **Step 2: Add both packages to web**

In `apps/web/package.json` `dependencies`, insert before the existing `"@coding-cowboys/scorebrawl-worker"` line:

```json
		"@coding-cowboys/scorebrawl-client": "workspace:*",
		"@coding-cowboys/scorebrawl-core": "workspace:*",
```

- [ ] **Step 3: Add both packages to mobile**

In `apps/mobile/package.json` `dependencies`, insert before the existing `"@coding-cowboys/scorebrawl-worker"` line:

```json
		"@coding-cowboys/scorebrawl-client": "workspace:*",
		"@coding-cowboys/scorebrawl-core": "workspace:*",
```

- [ ] **Step 4: Install and verify the edges**

Run: `bun install`
Expected: succeeds. Then verify the worker has no client edge:

Run: `grep -c "scorebrawl-client" apps/worker/package.json`
Expected: `0`

- [ ] **Step 5: Typecheck the whole monorepo**

Run: `bun typecheck`
Expected: PASS for every package including the two new ones.

- [ ] **Step 6: Commit**

```bash
git add apps/worker/package.json apps/web/package.json apps/mobile/package.json bun.lock
git commit -m "chore: wire core/client workspace deps into consumers (#696)"
```

---

### Task 4: Prove resolution in all three toolchains + guardrail

**Files:**
- Create/modify/delete (temporary): `apps/worker/src/__probe-core.ts`
- Create/modify/delete (temporary): `apps/web/src/main.tsx`
- Create/modify/delete (temporary): `apps/mobile/src/lib/__probe-metro.ts`
- Modify (temporary): `apps/mobile/src/app/_layout.tsx`

**Interfaces:**
- Consumes: `corePackageName` from core, `clientPackageName` from client.
- Produces: captured evidence; all temporary edits removed.

- [ ] **Step 1: Worker resolves `core` (typecheck + bundler)**

Create `apps/worker/src/__probe-core.ts`:

```ts
import { corePackageName } from "@coding-cowboys/scorebrawl-core";
export const probeCore = corePackageName;
```

Run: `bun --cwd apps/worker typecheck`
Expected: PASS.

Run: `bun --cwd apps/worker wrangler-typecheck`
Expected: PASS (esbuild resolves the TS-source package).

- [ ] **Step 2: Worker guardrail — importing `client` fails**

Replace the file body with:

```ts
import { clientPackageName } from "@coding-cowboys/scorebrawl-client";
export const probeClient = clientPackageName;
```

Run: `bun --cwd apps/worker typecheck`
Expected: FAIL with `Cannot find module '@coding-cowboys/scorebrawl-client'` (or equivalent unresolved-module error).

Capture that output as the guardrail evidence, then delete `apps/worker/src/__probe-core.ts`.

- [ ] **Step 3: Web resolves `core` + `client` through Vite**

Append to `apps/web/src/main.tsx`:

```ts
import { corePackageName } from "@coding-cowboys/scorebrawl-core";
import { clientPackageName } from "@coding-cowboys/scorebrawl-client";
if (import.meta.env.DEV) console.log(corePackageName, clientPackageName);
```

Run: `bun --cwd apps/web build`
Expected: PASS (`tsc -b` then `vite build`).

- [ ] **Step 4: Mobile resolves `core` + `client` through Metro**

Create `apps/mobile/src/lib/__probe-metro.ts`:

```ts
import { clientPackageName } from "@coding-cowboys/scorebrawl-client";
import { corePackageName } from "@coding-cowboys/scorebrawl-core";

export const probeMetro = `${corePackageName}:${clientPackageName}`;
```

In `apps/mobile/src/app/_layout.tsx`, add after the existing `@/lib/trpc` import:

```ts
import { probeMetro } from "@/lib/__probe-metro";

if (__DEV__) console.log("metro-probe", probeMetro);
```

Run: `bun --cwd apps/mobile exec expo export --platform ios --output-dir "$TMPDIR/metro-probe-out"`
Expected: PASS (`Exported:` line printed, no `Unable to resolve module` error).

- [ ] **Step 5: Remove all temporary edits**

Revert `apps/web/src/main.tsx` and `apps/mobile/src/app/_layout.tsx` to their committed state; delete `apps/mobile/src/lib/__probe-metro.ts` and the temp output dir.

Run: `git status --short`
Expected: no probe files, no diffs from Steps 3–4 (only the files intentionally changed in Tasks 1–3, if not yet committed).

- [ ] **Step 6: Full verification**

Run: `bun check && bun run test`
Expected: typecheck, lint, format all pass; tests pass (including the new specs and the existing worker suite).

Run: `bun oxc` if `format` reported differences, then re-run `bun check`.

- [ ] **Step 7: Commit any remaining cleanup**

```bash
git add -A
git commit -m "test(core,client): verify worker/web/mobile resolution and worker guardrail (#696)"
```

---

## Self-Review

- **Spec coverage:** core package (Task 1), client package with peers (Task 2), workspace/catalog/turbo wiring (Task 3), consumer dep edges (Task 3), guardrail (Task 4), toolchain proof incl. Metro (Task 4), `bun typecheck`/`test`/`oxc` (Task 4). Root `tsconfig.json` reference decision is documented in the spec as "leave as-is"; no task changes it.
- **Type consistency:** `corePackageName` and `clientPackageName` are the only cross-task symbols; both defined in Tasks 1–2 and imported verbatim in Task 4.
- **Placeholder scan:** the `corePackageName`/`clientPackageName` constants are the spec's required "trivial export"; no `TBD`/`TODO`.
- **Review Focus:** each of the five lines has a pinning step (Task 1 Step 8, Task 2 Step 2, Task 3 Steps 4–5, Task 4 Steps 2/4).
