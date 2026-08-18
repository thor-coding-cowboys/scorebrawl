# Drizzle v1 + Wrangler Nested Migrations Design

Date: 2026-08-18

## Goal

Upgrade `drizzle-orm` / `drizzle-kit` to the latest 1.0.0 RC and adopt Wrangler's nested
`migrations_pattern` support for D1, eliminating the custom `flatten-migrations.ts` script.

## Current state

- `drizzle-orm` / `drizzle-kit` at `1.0.0-beta.2-f9236e3` (already produces drizzle v1
  nested folder layout: `migrations/<timestamp>_<name>/{migration.sql,snapshot.json}`).
- `apps/worker/scripts/flatten-migrations.ts` copies each nested `migration.sql` into a
  top-level `NNNN_<timestamp>_<name>.sql` file so Wrangler (pre-4.100) can apply them.
  Hooked via `postdb:generate` in `apps/worker/package.json`.
- 21 flat migrations exist (`0000_*.sql` … `0020_*.sql`). 19 duplicate nested folders;
  `0015_20260409000000_add_randomizer_type` and `0016_20260410120000_rename_round_robin`
  are hand-written flat-only migrations (no nested folder, no drizzle snapshot).
- `wrangler` at `4.67.0`; `migrations_pattern` shipped in Wrangler 4.100.
- `d1_migrations` tables (local + prod) record flat names, e.g.
  `0000_20260206084212_salty_nehzno.sql`.
- Consumers of the migrations dir: `apps/worker/vitest.config.ts` (`readD1Migrations`,
  reads only top-level `.sql`), `.github/scripts/preview/prepare-wrangler-config.ts`
  (sets `migrations_dir`), `.github/workflows/ci.yml` (`db:migrate:prod` on main).

## Approach

**A — Full nested migration + idempotent `d1_migrations` remap.** The only viable option.

Rejected alternatives:
- **B — mixed pattern `migrations/**/*.sql`**: flat files duplicate nested folders, so a
  fresh DB would apply every migration twice (duplicate table/column errors).
- **C — keep flatten script**: doesn't meet the goal.

## Design

### 1. Dependency upgrades (root catalog + lockfile)

- `drizzle-orm` → `1.0.0-rc.5-169397b`
- `drizzle-kit` → `1.0.0-rc.5-ab785fc`
- `wrangler` → `4.124.0`

### 2. Migration files (`apps/worker/migrations/`)

- Delete flat `0000_*.sql` … `0020_*.sql` (21 files).
- Create nested folders for the two hand-written migrations:
  - `20260409000000_add_randomizer_type/migration.sql`
  - `20260410120000_rename_round_robin/migration.sql`
  (SQL copied verbatim; no `snapshot.json` — they are manual migrations outside the
  drizzle snapshot chain, matching today's behavior.)
- Delete `apps/worker/scripts/flatten-migrations.ts` and the `postdb:generate` hook.

### 3. Snapshot chain repair + baseline

Validated during implementation research — required for `drizzle-kit` rc.5's
commutativity checks and snapshot diffing to work:

- **Repair 2 broken `prevIds` links** so the snapshot chain is linear. Historical
  migration renames/splits left 3 divergent heads:
  - `20260212193233_wandering_squadron_sinister` → set `prevIds` to the `id` of
    `20260210224556_illegal_switch`
  - `20260528133813_illegal_cable` → set `prevIds` to the `id` of
    `20260415152938_fantastic_iron_man`
- **Create a baseline** with `drizzle-kit generate --custom --name squash_baseline`
  (run from `apps/worker`). It produces an empty `migration.sql` + a fresh rc.5
  `snapshot.json` of the full current schema. This becomes the new chain head so future
  `drizzle-kit generate` runs are clean ("No schema changes") instead of rebuilding every
  table (beta.2-era snapshots render boolean defaults / FK names / FK casing differently
  than rc.5). Wrangler applies the empty SQL harmlessly.

### 4. Wrangler config (`apps/worker/wrangler.jsonc`)

Add to the D1 binding:

```jsonc
"migrations_dir": "migrations",
"migrations_pattern": "migrations/*/migration.sql"
```

Wrangler records each applied migration name relative to `migrations_dir`, i.e.
`<timestamp>_<name>/migration.sql`.

### 5. `d1_migrations` remap (idempotent)

Old flat names always contain no `/`; new nested names always contain `/`, so:

```sql
UPDATE d1_migrations
SET name = replace(substr(name, instr(name,'_')+1), '.sql', '/migration.sql')
WHERE name NOT LIKE '%/%';
```

- **Local**: run inside `db:migrate` (via `predb:migrate`) guarded by
  `CREATE TABLE IF NOT EXISTS d1_migrations (...)` so fresh DBs are unaffected. Keeps
  existing local dev data intact.
- **Prod**: new step in `.github/workflows/ci.yml` before the existing
  `Apply database migrations` step, same `if: github.ref == 'refs/heads/main'` guard and
  Cloudflare credentials. First main run remaps then applies no-op; subsequent runs no-op.

### 6. Consumers

- `apps/worker/vitest.config.ts`: replace `readD1Migrations` with a local custom reader
  that walks `migrations/*/migration.sql`, sorts chronologically by folder timestamp, and
  returns the same `{ name, queries }` shape used by `applyD1Migrations`.
- `.github/scripts/preview/prepare-wrangler-config.ts`: additionally set
  `migrations_pattern` to match the overridden `migrations_dir`
  (`./apps/worker/migrations/*/migration.sql`) so the pattern/migrations_dir prefix
  invariant holds for the preview config.

### 7. Verification

- Snapshot chain is linear (single head) after repair; `drizzle-kit generate` reports
  "No schema changes, nothing to migrate" after the baseline is created.
- `bun db:clean`-free local check: run `predb:migrate` remap against an existing local DB,
  then `wrangler d1 migrations apply --local` reports only the baseline as pending (empty
  SQL), then "No migrations to apply".
- Fresh-DB check: `bun db:reset` applies all 21 migrations + baseline via the nested pattern.
- `bun check && bun run test` (vitest uses the custom nested migration reader).
- Preview config generation still validates.

## Risks / notes

- Validated: `drizzle-kit` rc.5 tolerates the two snapshot-less folders (0015/0016) and
  `generate --custom` produces a clean baseline with no diff afterward.
- The baseline snapshot models the current TS schema (fresh FK names). Existing DBs carry
  legacy FK names from earlier migrations; drizzle self-reconciles this on any future table
  rebuild, so it is benign.
- `wrangler d1 execute` used by the CI remap resolves the database from the worker config
  (`scorebrawl` binding), same as the existing migrate step.
