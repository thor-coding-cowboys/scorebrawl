# Agent Instructions

## Package Manager

**bun** only. Never use npm/yarn/pnpm.

- Never run `bun test` always `bun run test`
- Never run `bun deploy`

## Project Structure

- `apps/web` - Frontend (TanStack Router)
- `apps/worker` - Cloudflare Worker (Hono + tRPC)
- `apps/worker/src/test` - Backend tests

## Dependencies

Use **catalog** only for dependencies shared by **2+** workspace packages. Define shared versions in root `package.json` catalog and reference them with `"catalog:"`. Declare dependencies used by a single package inline in that package's `package.json` — keep paired deps (e.g. `react`/`react-dom`, `tailwindcss`/`@tailwindcss/vite`, `drizzle-orm`/`drizzle-kit`) either both in the catalog or both inline together so their versions stay aligned.

## tRPC Procedures

- `publicProcedure` - Public access
- `protectedProcedure` - Auth guaranteed (`ctx.authentication.user`)
- `activeOrgProcedure` - Auth + org guaranteed (`ctx.authentication.user`, `organizationId`)

**No redundant auth checks** - when using `protectedProcedure` or `activeOrgProcedure`, user is guaranteed. Access directly:

```typescript
const userId = ctx.authentication.user.id;
```

### Query Performance

**Never N+1 queries** - Cloudflare Workers have strict CPU limits. Querying inside loops causes `Worker exceeded CPU time limit` errors.
// BAD - N queries
const items = await db.select().from(x).where(...);
await Promise.all(items.map(i => db.select().from(y).where(...)));

// GOOD - 1 query with join
const data = await db.select({...}).from(x).leftJoin(y, ...);
Always use joins/subqueries. Fetch related data in single round-trip.

## Public API

Single worker serves two hosts, split by `enforceHostScope` (`apps/worker/src/public-api/host-scope.ts`), driven by `PROD_URL` / `PROD_PUBLIC_API_URL` vars:

- `https://api.scorebrawl.com/v1` - personal resources (`/me`, `/leagues`), personal keys (`sbp_`, config `personal`, act as the user; scopes `profile:read`, `league:read`; created via tRPC `personalApiKey`, no UI)
- `https://api.scorebrawl.com/leagues/v1/sessions/...` - league resources (league taken from the key; `/leagues/v1/:leagueId/sessions/...` also accepted and must match the key), league keys (`sbk_`, owner-only, UI at `/leagues/:slug/api-keys`; scopes `session:start|stop`, `match:start|log|score|cancel|lineup`)
- `scorebrawl.com` rejects those paths (404); `api.scorebrawl.com` rejects everything else
- Previews: vars unset, both surfaces on same `*.workers.dev` domain
- `/api/*` (tRPC, better-auth, OAuth, MCP, `/api/v1` OAuth REST) stays on `scorebrawl.com`
- Public API: REST on Hono, no tRPC. API keys only (`requireApiKeyScope` / `requirePersonalApiKeyScope`, `apps/worker/src/routes/api-key-auth.ts`). Key type is a key property (better-auth api-key `configId`); a key of one type is rejected on the other surface. Scopes `{resource: [action]}` enforced server-side
- New public prefix: add to `PUBLIC_API_PREFIXES` and `run_worker_first` in `wrangler.jsonc`

## Hono Route Validation

Always validate headers, payload (body), and search params in Hono routes using **@hono/zod-validator**:

```typescript
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

const schema = z.object({
	name: z.string(),
	age: z.number(),
});

app.post("/author", zValidator("json", schema), async (c) => {
	const data = c.req.valid("json"); // Type-safe validated data
	// ...
});
```

Validator targets: `"json"` (body), `"query"` (search params), `"header"`, `"param"` (route params).

## UI Development

shadcn + Tailwind for all interfaces. Use **Hugeicons** for icons.

## File Organization

Uses TanStack Router file-based routing with co-located feature files.

### Route Files

Files in `apps/web/src/routes/` are automatically registered as routes unless excluded.

### Non-Route Files

Prefix directories/files with `-` to exclude them from route generation while keeping them co-located.

### Path Aliases

Explicit aliases in `tsconfig.json` and `vite.config.ts`:

- `@/components/*` → `apps/web/src/routes/-components/*`
- `@/lib/*` → `apps/web/src/lib/*`
- `@/hooks/*` → `apps/web/src/hooks/*`

Use `@/components/` for shared UI. Use relative imports (`./-components/...`) for co-located feature components.

### Shared Code Location

- UI components: `apps/web/src/routes/-components/` (`@/components`)
- Hooks: `apps/web/src/hooks/` (`@/hooks`)
- Utilities/API: `apps/web/src/lib/` (`@/lib`)

## Testing

Create integration tests for new tRPC routes. Reference `apps/worker/src/test/trpc/`.
Pattern: `createTRPCTestClient({ sessionToken })` with helpers from `apps/worker/src/test/setup/`. Uses Vitest + Cloudflare framework. Migrations auto-apply.

## Database

Use Drizzle. Schema: `apps/worker/src/db/schema/`

Migration workflow:

1. `bun db:generate` - Create + auto-flatten
2. `bun db:migrate` - Apply locally (D1 with `--persist-to ./.db/local`)
3. Verify with `bun db:studio` or tests
4. `bun db:migrate:prod` - Production

Other: `bun db:studio` (inspect), `bun db:reset` (clean + reapply)

## Post-Change Commands

After making a change to TypeScript files always run `bun oxc` and `bun typecheck`

When asked for full verification: `bun check && bun run test`

## React Router

Run `bun dev` after creating new routes for TanStack Router code generation.
**Route file structure**: Use directory structure, never dot notation. `leagues/index.tsx` and `leagues/create.tsx`, NOT `leagues.tsx` and `leagues.create.tsx`.

## State Management

Prefer **TanStack Query** (`useQuery`, `useMutation`) over `useEffect` for:

- Data fetching and caching
- Server state management
- API mutations

Use `useEffect` only for client-side only side effects (DOM manipulation, subscriptions, etc.).

## Authentication

Use **better-auth**. Prefer better-auth React client in frontend, see `apps/web/src/lib/auth-client.ts`
Reference: https://www.better-auth.com/llms.txt

## UI Verification

Use **agent-browser** skill for UI verification. App uses **portless** — always runs on `https://scorebrawl.localhost:1355`. Use this URL when testing with browser agent. Log in as `seed@example.com` to verify changes.

## Code Quality

- No redundant comments
- No `@ts-expect-error` or `@ts-ignore`
- Well-typed code throughout
- Oxc (oxlint + oxfmt) for lint/format

## Lint & Format Scripts

- `bun fmt` / `bun fmt:check` - format (write) / verify formatting (oxfmt)
- `bun lint` / `bun lint:check` - lint + auto-fix (write) / verify (oxlint)
- `bun oxc` - lint + format, auto-fixing (run after editing)
- `bun check` - typecheck + `lint:check` + `fmt:check`

## Git Hooks

Native git `pre-commit` hook (no husky). Runs `fmt:check` and `lint:check` on **staged files only**; any failure blocks the commit.

- Script: `scripts/git-hooks/pre-commit.ts`
- Installer: `scripts/git-hooks/install.ts`, wired to the root `prepare` script (runs on `bun install`); reinstall with `bun scripts/git-hooks/install.ts`
- Installed to `.git/hooks/pre-commit` (symlink); does not use `core.hooksPath`
- Fix failures with `bun fmt` / `bun lint`; bypass with `git commit --no-verify`

## Deployment

- Production: `bun run deploy`
- Preview: Auto-deploy on PRs
- Monitor: `bunx wrangler tail`

Cloudflare D1 binding in `wrangler.jsonc`.

## Communication

Extreme concision. Sacrifice grammar for brevity.
