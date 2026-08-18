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

### 3. Wrangler config (`apps/worker/wrangler.jsonc`)

Add to the D1 binding:

```jsonc
"migrations_dir": "migrations",
"migrations_pattern": "migrations/*/migration.sql"
```

Wrangler records each applied migration name relative to `migrations_dir`, i.e.
`<timestamp>_<name>/migration.sql`.

### 4. `d1_migrations` remap (idempotent)

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

### 5. Consumers

- `apps/worker/vitest.config.ts`: replace `readD1Migrations` with a local custom reader
  that walks `migrations/*/migration.sql`, sorts chronologically by folder timestamp, and
  returns the same `{ name, queries }` shape used by `applyD1Migrations`.
- `.github/scripts/preview/prepare-wrangler-config.ts`: additionally set
  `migrations_pattern` to match the overridden `migrations_dir`
  (`./apps/worker/migrations/*/migration.sql`) so the pattern/migrations_dir prefix
  invariant holds for the preview config.

### 6. Verification

- `bun db:clean`-free local check: run `predb:migrate` remap against an existing local DB,
  then `wrangler d1 migrations apply --local` reports "No migrations to apply".
- Fresh-DB check: `bun db:reset` applies all 21 migrations via the nested pattern.
- `bun run --cwd apps/worker db:generate` (or `drizzle-kit generate`) succeeds with the
  two snapshot-less folders present (does not need to produce a migration).
- `bun check && bun run test` (vitest uses the custom nested migration reader).
- Preview config generation still validates.

## Risks / notes

- If `drizzle-kit generate` errors on snapshot-less folders, fallback is to either name
  them to sort last or generate minimal snapshots; verify empirically first.
- `wrangler d1 execute` used by the CI remap resolves the database from the worker config
  (`scorebrawl` binding), same as the existing migrate step.
