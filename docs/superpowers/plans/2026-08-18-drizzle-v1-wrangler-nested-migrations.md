# Drizzle v1 + Wrangler Nested Migrations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade `drizzle-orm`/`drizzle-kit` to 1.0.0-rc.5 and switch D1 migrations to Wrangler's nested `migrations_pattern`, removing the `flatten-migrations.ts` script.

**Architecture:** Migrations move fully to the drizzle v1 nested folder layout (`migrations/<timestamp>_<name>/migration.sql`) which Wrangler ≥4.100 discovers via `migrations_pattern`. Existing `d1_migrations` tables (flat names) are remapped idempotently; the drizzle snapshot chain is repaired and rebaselined so `drizzle-kit generate` stays clean on rc.5. Vitest and the preview config are updated to consume nested migrations.

**Tech Stack:** Drizzle ORM/Kit 1.0.0-rc.5, Wrangler 4.124.0, D1, Vitest (vitest-pool-workers), GitHub Actions, Bun.

**Spec:** `docs/superpowers/specs/2026-08-18-drizzle-v1-wrangler-nested-migrations-design.md`

---

## Task 1: Bump drizzle + wrangler versions

**Files:**
- Modify: `package.json` (root catalog + dependency)
- Test: `bun install` resolves without errors

- [ ] **Step 1: Update root `package.json` versions**

In the root `package.json` `catalog` block, change:

```jsonc
"drizzle-kit": "1.0.0-beta.2-f9236e3",
"drizzle-orm": "1.0.0-beta.2-f9236e3",
```

to:

```jsonc
"drizzle-kit": "1.0.0-rc.5-ab785fc",
"drizzle-orm": "1.0.0-rc.5-169397b",
```

Also update `wrangler` in **both** the root `dependencies` (`"wrangler": "4.67.0"`) and the `catalog` (`"wrangler": "4.67.0"`) to `4.124.0`.

- [ ] **Step 2: Install and verify**

Run: `bun install`
Expected: resolves and installs ~7 packages with no peer warnings.

Run: `bunx --bun drizzle-kit --version` (from `apps/worker`)
Expected: prints `drizzle-orm: v1.0.0-rc.5`.

- [ ] **Step 3: Commit**

```bash
git add package.json bun.lock
git commit -m "chore: upgrade drizzle-orm/drizzle-kit to 1.0.0-rc.5 and wrangler to 4.124.0"
```

## Task 2: Restructure migration files to nested layout

**Files:**
- Delete: `apps/worker/migrations/0000_*.sql` … `apps/worker/migrations/0020_*.sql` (21 files)
- Create: `apps/worker/migrations/20260409000000_add_randomizer_type/migration.sql`
- Create: `apps/worker/migrations/20260410120000_rename_round_robin/migration.sql`
- Delete: `apps/worker/scripts/flatten-migrations.ts`
- Modify: `apps/worker/package.json` (remove `postdb:generate`)

- [ ] **Step 1: Delete the 21 flat migration files**

Run (from `apps/worker/migrations`):

```bash
rm -v [0-9][0-9][0-9][0-9]_*.sql
```

Expected: 21 files removed, nested `[0-9]*/` folders remain.

- [ ] **Step 2: Create nested folders for the two hand-written migrations**

Run (from `apps/worker/migrations`):

```bash
mkdir -p 20260409000000_add_randomizer_type 20260410120000_rename_round_robin
```

Create `20260409000000_add_randomizer_type/migration.sql` with:

```sql
ALTER TABLE `game_session` ADD `randomizer_type` text DEFAULT 'fisher-yates' NOT NULL;
```

Create `20260410120000_rename_round_robin/migration.sql` with:

```sql
-- Rename round-robin to sequential in rotation_mode enum
UPDATE `game_session` SET `rotation_mode` = 'sequential' WHERE `rotation_mode` = 'round-robin';
```

- [ ] **Step 3: Delete the flatten script**

```bash
rm apps/worker/scripts/flatten-migrations.ts
```

- [ ] **Step 4: Remove the `postdb:generate` hook**

In `apps/worker/package.json`, remove the line:

```jsonc
"postdb:generate": "bun run ./scripts/flatten-migrations.ts",
```

- [ ] **Step 5: Verify nested layout**

Run (from `apps/worker/migrations`): `ls -d [0-9]*/ | wc -l`
Expected: `21`

- [ ] **Step 6: Commit**

```bash
git add -A apps/worker/migrations apps/worker/scripts apps/worker/package.json
git commit -m "refactor: move migrations to nested folder layout, remove flatten script"
```

## Task 3: Repair snapshot chain and create baseline

**Files:**
- Modify: `apps/worker/migrations/20260212193233_wandering_squadron_sinister/snapshot.json`
- Modify: `apps/worker/migrations/20260528133813_illegal_cable/snapshot.json`
- Create: `apps/worker/migrations/<today>_squash_baseline/` (via drizzle-kit)

- [ ] **Step 1: Repair the two broken `prevIds` links**

Run from repo root (or `apps/worker/migrations`):

```bash
cd apps/worker/migrations && python3 - <<'EOF'
import json

def read(d):
    return json.load(open(f'{d}/snapshot.json'))

def write(d, s):
    json.dump(s, open(f'{d}/snapshot.json', 'w'), indent=2)

illegal_switch_id = read('20260210224556_illegal_switch')['id']          # 8f663df1-b962-42f2-bd1e-19f21862eef9
fantastic_id      = read('20260415152938_fantastic_iron_man')['id']      # 83e35dc7-755e-4749-bf4b-a8d2be179893

ws = read('20260212193233_wandering_squadron_sinister')
ws['prevIds'] = [illegal_switch_id]
write('20260212193233_wandering_squadron_sinister', ws)

ic = read('20260528133813_illegal_cable')
ic['prevIds'] = [fantastic_id]
write('20260528133813_illegal_cable', ic)

print('repaired')
EOF
```

- [ ] **Step 2: Verify the chain is linear (single head)**

Run (from `apps/worker/migrations`):

```bash
python3 - <<'EOF'
import json, os
ids = {}
for d in sorted(os.listdir('.')):
    p = f'{d}/snapshot.json'
    if os.path.isdir(d) and os.path.exists(p):
        ids[d] = json.load(open(p))['id']
referenced = set()
for d in ids:
    prev = json.load(open(f'{d}/snapshot.json'))['prevIds']
    referenced.update(prev)
heads = [d for d, i in ids.items() if i not in referenced]
print('heads:', heads)  # expect exactly one: 20260810222911_lethal_virginia_dare
EOF
```

Expected: exactly one head, `20260810222911_lethal_virginia_dare`.

- [ ] **Step 3: Create the baseline migration**

Run (from `apps/worker`):

```bash
bunx --bun drizzle-kit generate --custom --name squash_baseline
```

Expected: output `Prepared empty file for your custom SQL migration!` and creates `migrations/<today>_squash_baseline/migration.sql` (a comment line) + `snapshot.json` with 27 tables.

- [ ] **Step 4: Verify `generate` is now clean**

Run (from `apps/worker`):

```bash
bunx --bun drizzle-kit generate --config drizzle.config.ts
```

Expected: `No schema changes, nothing to migrate 😴` (no new folder).

If it instead produces a migration, STOP — the baseline did not take; re-check Step 2 (must be a single head before the baseline exists).

- [ ] **Step 5: Commit**

```bash
git add apps/worker/migrations
git commit -m "fix: repair snapshot chain and add squash baseline for drizzle v1"
```

## Task 4: Configure Wrangler nested migrations

**Files:**
- Modify: `apps/worker/wrangler.jsonc`

- [ ] **Step 1: Add `migrations_dir` and `migrations_pattern` to the D1 binding**

In `apps/worker/wrangler.jsonc`, inside `d1_databases[0]`, add:

```jsonc
{
	"binding": "DB",
	"database_name": "scorebrawl",
	"database_id": "4c9222b6-1e0e-4b4a-bd7f-bf3214c1b365",
	"migrations_dir": "migrations",
	"migrations_pattern": "migrations/*/migration.sql"
}
```

- [ ] **Step 2: Verify wrangler parses config**

Run (from `apps/worker`): `bunx wrangler d1 migrations list scorebrawl --local`
Expected: lists the nested migrations (`<folder>/migration.sql`), no config error.

- [ ] **Step 3: Commit**

```bash
git add apps/worker/wrangler.jsonc
git commit -m "chore: configure wrangler d1 nested migrations pattern"
```

## Task 5: Local `d1_migrations` remap

**Files:**
- Modify: `apps/worker/package.json`

- [ ] **Step 1: Add `predb:migrate` script**

In `apps/worker/package.json`, immediately before the existing `db:migrate` entry, add:

```jsonc
"predb:migrate": "wrangler d1 execute scorebrawl --local --persist-to ../../.db/local --command \"CREATE TABLE IF NOT EXISTS d1_migrations(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL); UPDATE d1_migrations SET name = replace(substr(name, instr(name,'_')+1), '.sql', '/migration.sql') WHERE name NOT LIKE '%/%';\"",
```

- [ ] **Step 2: Verify remap is idempotent against an existing local DB**

Run: `bun run db:migrate` (from repo root).
Expected: the `predb:migrate` execute succeeds, then `wrangler d1 migrations apply` reports only the baseline migration pending, then `✅ No migrations to apply`.

Run `bun run db:migrate` again. Expected: `✅ No migrations to apply!` (remap no-ops, names unchanged).

- [ ] **Step 3: Verify fresh-DB path**

Run: `bun run db:reset` (this cleans local then re-applies).
Expected: all 21 migrations + baseline applied via the nested pattern; second `bun run db:migrate` reports `✅ No migrations to apply!`.

- [ ] **Step 4: Commit**

```bash
git add apps/worker/package.json
git commit -m "chore: remap local d1_migrations to nested names before apply"
```

## Task 6: Vitest custom nested migration reader

**Files:**
- Modify: `apps/worker/vitest.config.ts`

- [ ] **Step 1: Replace `readD1Migrations` with a nested reader**

`apps/worker/vitest.config.ts` already imports `fs` (line 1) and `path` (line 2). Change
the third import from:

```ts
import { defineWorkersConfig, readD1Migrations } from "@cloudflare/vitest-pool-workers/config";
```

to:

```ts
import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";
import { unstable_splitSqlQuery } from "wrangler";
```

Replace:

```ts
const migrationsPath = path.join(__dirname, "./migrations");
const migrations = await readD1Migrations(migrationsPath);
```

with:

```ts
const migrationsPath = path.join(__dirname, "./migrations");

function readNestedD1Migrations(dir: string) {
	const names = fs
		.readdirSync(dir, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.sort((a, b) => Number(a.split("_")[0]) - Number(b.split("_")[0]));
	return names
		.filter((name) => fs.existsSync(path.join(dir, name, "migration.sql")))
		.map((name) => ({
			name: `${name}/migration.sql`,
			queries: unstable_splitSqlQuery(
				fs.readFileSync(path.join(dir, name, "migration.sql"), "utf8"),
			),
		}));
}

const migrations = readNestedD1Migrations(migrationsPath);
```

- [ ] **Step 2: Run the worker tests**

Run (from repo root): `bun run test`
Expected: worker test suite passes (migrations auto-apply via nested reader).

- [ ] **Step 3: Lint + typecheck**

Run: `bun oxc` then `bun typecheck`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/worker/vitest.config.ts
git commit -m "test: read nested drizzle migrations in vitest setup"
```

## Task 7: Preview config nested migrations

**Files:**
- Modify: `.github/scripts/preview/prepare-wrangler-config.ts`

- [ ] **Step 1: Set matching `migrations_pattern`**

In `.github/scripts/preview/prepare-wrangler-config.ts`, after line 35
(`config.d1_databases[0].migrations_dir = "./apps/worker/migrations";`), add:

```ts
config.d1_databases[0].migrations_pattern = "./apps/worker/migrations/*/migration.sql";
```

- [ ] **Step 2: Verify the script typechecks**

Run: `bun oxc .github/scripts/preview/prepare-wrangler-config.ts`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add .github/scripts/preview/prepare-wrangler-config.ts
git commit -m "chore: set migrations_pattern in preview wrangler config"
```

## Task 8: CI prod `d1_migrations` remap

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Add a remap step before the apply step**

In `.github/workflows/ci.yml`, immediately before the existing `🗄️ Apply database migrations` step, add:

```yaml
      - name: 🔁 Remap d1 migration names to nested layout
        if: github.ref == 'refs/heads/main'
        run: wrangler d1 execute scorebrawl --remote --command "CREATE TABLE IF NOT EXISTS d1_migrations(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL); UPDATE d1_migrations SET name = replace(substr(name, instr(name,'_')+1), '.sql', '/migration.sql') WHERE name NOT LIKE '%/%';"
        working-directory: apps/worker
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: remap prod d1_migrations to nested names before apply"
```

## Task 9: Final verification

- [ ] **Step 1: Full local verification**

From repo root run:
- `bun run db:migrate` → `✅ No migrations to apply!`
- `bun run db:reset` → all migrations apply, then `bun run db:migrate` → no-op
- `bun check` (typecheck + lint + format)
- `bun run test`

- [ ] **Step 2: Confirm no stray test artifacts**

Run: `git status`
Expected: only intended files changed; no `*.sqlite`, no `.dkg-test`, no `migrations/2026*_public_miracleman` or `jazzy_microchip` folders.

- [ ] **Step 3: Commit any remaining changes**

```bash
git add -A && git commit -m "chore: finalize drizzle v1 nested migrations migration"
```

---

## Notes for the implementer

- Never run `bun test`; always `bun run test`.
- `bun oxc` and `bun typecheck` are required after any TypeScript change.
- The prod `d1_migrations` remap ships inside this same change set (Task 8) so the first
  `main` CI run remaps before `db:migrate:prod` runs — it must land in the same PR.
- Wrangler's `migrations_pattern` requires it to start with `${migrations_dir}/` (Task 4,
  Task 7).
- If Task 3 Step 4 produces a migration instead of "No schema changes", the chain repair
  (Step 1/2) failed — fix before proceeding.
