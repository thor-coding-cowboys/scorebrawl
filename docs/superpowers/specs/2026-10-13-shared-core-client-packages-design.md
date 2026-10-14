# Scaffold `packages/core` + `packages/client` and wire workspaces

Issue: [#696](https://github.com/thor-coding-cowboys/scorebrawl/issues/696) (sub-issue of
[#695](https://github.com/thor-coding-cowboys/scorebrawl/issues/695))

Date: 2026-10-13

## Goal

Create the two shared packages and prove they resolve from all three consumers. No logic
migration — that is sub-issues 697–701. This issue only establishes the packages, the
workspace wiring, and the toolchain proof.

- `packages/core` (`@coding-cowboys/scorebrawl-core`) — framework-agnostic pure TypeScript.
  Consumed by worker + web + mobile.
- `packages/client` (`@coding-cowboys/scorebrawl-client`) — React client infrastructure.
  Consumed by web + mobile only. Must never be imported by the worker.

## Key risk: Metro / Expo consuming TypeScript source

### Question

Can Metro (Expo SDK 57) consume a workspace package whose `main`/`exports` point at TS source
(no build step), the way Vite and Wrangler already do?

### Probe

Run against the existing `packages/util` (already TS-source, not yet consumed by mobile) so no
new code was created for the test:

1. Add a temporary runtime import of `@coding-cowboys/scorebrawl-util` and
   `@coding-cowboys/scorebrawl-util/id-util` to a mobile module.
2. `bunx expo export --platform ios`.

Result: the bundle **failed**:

```
Unable to resolve module ./id-util/index.js from packages/util/src/index.ts
```

Metro resolved the bare specifier and the `exports` subpath, read the TS source, but could not
map a NodeNext-style `.js` relative specifier (`./id-util/index.js`) onto the real
`./id-util/index.ts`.

3. Change `packages/util/src/index.ts` relative specifiers to extensionless
   (`./id-util/index`) and re-run.

Result: **`expo export --platform ios` bundled successfully** (2.4k modules, no warnings), with
both the package root and the `exports` subpath imported at runtime.

Supporting facts from the installed toolchain: Metro 56 defaults `unstable_enablePackageExports`
to `true`, and `@expo/metro-config`'s `getWatchFolders` automatically adds every workspace
package directory to the watch set — so **no `metro.config.js` is required**.

### Decision

Ship **TypeScript source with no build step**, and inside `core`/`client` use **extensionless
relative imports** with `moduleResolution: "bundler"`.

- Vite and Wrangler/esbuild already resolve extensionless TS source and TS with `.js` specifiers.
- Metro requires extensionless; extensionless is also valid for bundler-mode TS and for esbuild.
- No `metro.config.js` and no per-platform entry needed.

Rejected alternatives:

- **Ship build output** — adds a build step and turbo `build` wiring, and works against the
  epic's stated no-build package pattern.
- **Metro resolver shim** (rewrite `.js` → `.ts`) — global config surface, fragile, and only
  needed to preserve a specifier style the new packages do not have to adopt.

`:warning:` `packages/util` keeps its NodeNext `.js` specifiers and stays mobile-unused in this
issue. If a later sub-issue needs `util` from mobile, it must adopt the same extensionless
convention.

## `packages/core`

- Name `@coding-cowboys/scorebrawl-core`, `private`, `type: module`.
- `main` and `exports."."` → `./src/index.ts` (same pattern as `packages/util`).
- Scripts: `typecheck` (`tsc --noEmit`), `test` (`vitest run`) — consistent with `packages/util`.
- Dependencies: none yet. devDependencies: `typescript`, `vitest` (both `catalog:`).
- `vitest.config.ts` with `environment: "node"` (without a local vitest config, vitest picks up
  the stale repo-root `vite.config.ts` and fails on its Cloudflare plugin).
- `tsconfig.json`: `moduleResolution: "bundler"`, `strict`, `noEmit`, `lib: ["ES2023"]`,
  `types: []`, `exclude: ["**/*.spec.ts"]` — `types: []` plus the absence of a DOM lib make
  Node/worker/DOM globals a typecheck error, enforcing "framework-agnostic". The spec exclusion
  is required for that to hold: a spec file's `vitest` import pulls `@types/node` into the
  program and leaks Node globals into production source.
- `src/index.ts` holds one trivial export so consumers can prove resolution; a co-located
  `src/index.spec.ts` proves the vitest wiring. Both are replaced by sub-issue 697.

## `packages/client`

- Name `@coding-cowboys/scorebrawl-client`, `private`, `type: module`.
- `main` and `exports."."` → `./src/index.ts`.
- `peerDependencies`: `react`, `@tanstack/react-query`, `@trpc/client`.
- devDependencies: the same three (so the package typechecks standalone) plus `@types/react`,
  `typescript`, `vitest`.
- Scripts: `typecheck` (`tsc --noEmit`), `test` (`vitest run`).
- `vitest.config.ts` with `environment: "node"` (same reason as core).
- `tsconfig.json`: as core (including `exclude: ["**/*.spec.ts"]`), plus `jsx: "react-jsx"` and
  `lib: ["ES2023", "DOM"]` (DOM included for `@types/react` compatibility; it does not permit
  DOM runtime code on mobile).
- `src/index.ts` has one trivial export that imports `react` at runtime, proving the peer resolves;
  a co-located `src/index.spec.ts` covers the vitest wiring.

## Workspace wiring

- Root `workspaces` is already `["apps/*", "packages/*"]`, so both packages are covered — no
  change.
- Root `catalog` needs no new entries: `react`, `@tanstack/react-query`, `@trpc/client`,
  `@types/react`, `typescript`, `vitest` are all present.
- No `turbo.json` change: the generic `typecheck` and `test` tasks apply to every workspace
  package automatically. Neither package defines `build`.
- Root `tsconfig.json` references stay as-is. It currently lists only `apps/web` and
  `apps/worker`; `packages/util` is not referenced either. Package discovery for
  `bun typecheck` runs through turbo, which walks workspace `package.json` scripts — that is the
  pipeline that picks these up.
- Dependency edges:
  - `@coding-cowboys/scorebrawl-core` added to `apps/worker`, `apps/web`, `apps/mobile`
    (`workspace:*`).
  - `@coding-cowboys/scorebrawl-client` added to `apps/web`, `apps/mobile` **only**.

## Guardrail: worker must not import `packages/client`

The natural "no dependency edge" approach is **not sufficient** and was rejected after testing:
bun hoists every workspace package to the repo-root `node_modules/@coding-cowboys/*`, so
`import "@coding-cowboys/scorebrawl-client"` resolves from `apps/worker` regardless of the
dependency edge. A probe importing it passed both `tsgo --noEmit` and
`wrangler deploy --dry-run` (exit 0 each).

Enforcement is therefore an oxlint `no-restricted-imports` override scoped to
`apps/worker/**` in `.oxlintrc.json`, which runs in `bun lint` / `bun check`:

```json
{
	"files": ["apps/worker/**/*.ts", "apps/worker/**/*.tsx"],
	"rules": {
		"no-restricted-imports": [
			"error",
			{
				"paths": [{ "name": "@coding-cowboys/scorebrawl-client", "message": "..." }],
				"patterns": ["@coding-cowboys/scorebrawl-client/*"]
			}
		]
	}
}
```

`apps/worker/package.json` still omits the dependency (so intent is visible and tooling that
does not hoist would also fail).

## Verification / acceptance

- `bun typecheck` passes across the monorepo.
- `bun run test` passes (including the new specs); existing worker session tests stay green.
- `bun oxc` clean.
- Importability proof in each intended consumer, using **temporary** imports whose evidence is
  captured and then removed (the real imports arrive in sub-issues 697–701):
  - **worker** (`tsgo --noEmit` + wrangler dry-run): import from `core` → passes; add an import
    from `client` → the oxlint `no-restricted-imports` rule fails (`bun lint`), demonstrating the
    guardrail.
  - **web** (`bun run build` → `vite build`): import from `core` and `client` → passes.
  - **mobile** (`bunx expo export --platform ios`): runtime import from `core` and `client` →
    bundles.
- No placeholder imports are left in the apps.

## Out of scope

- Any logic migration (sub-issues 697–701).
- Changing `packages/util`'s specifier style.
- Shared UI, routing, auth plumbing.
