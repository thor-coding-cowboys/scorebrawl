# Agent Instructions

## Package Manager

**bun** only. Never use npm/yarn/pnpm.

- Never run `bun test` always `bun run test`
- Never run `bun deploy` always `bun run deploy`

## Project Structure

- `src/web` - Frontend (TanStack Router)
- `src/worker` - Cloudflare Worker (Hono + tRPC)
- `src/test` - Backend tests

## Dependencies

Always use **catalog** for workspace dependencies. Define versions in root `package.json` catalog, reference with `"catalog:"` in workspace packages.

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

```typescript
// BAD - N queries
const items = await db.select().from(x).where(...);
await Promise.all(items.map(i => db.select().from(y).where(...)));

// GOOD - 1 query with join
const data = await db.select({...}).from(x).leftJoin(y, ...);
```

Always use joins/subqueries. Fetch related data in single round-trip.

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

## Testing

Create integration tests for new tRPC routes. Reference `src/test/trpc/`.

Pattern: `createTRPCTestClient({ sessionToken })` with helpers from `src/test/setup/`. Uses Vitest + Cloudflare framework. Migrations auto-apply.

## Database

Use Drizzle. Schema: `src/worker/db/schema/`

Migration workflow:

1. `bun db:generate` - Create + auto-flatten
2. `bun db:migrate` - Apply locally (D1 with `--persist-to ./.db/local`)
3. Verify with `bun db:studio` or tests
4. `bun db:migrate:prod` - Production

Other: `bun db:studio` (inspect), `bun db:reset` (clean + reapply)

## Post-Change Commands

```bash
bun oxc
bun typecheck
```

Full verification: `bun check && bun test`

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

Use **agent-browser** skill for UI verification.

## Code Quality

- No redundant comments
- No `@ts-expect-error` or `@ts-ignore`
- Well-typed code throughout
- Oxc (oxlint + oxfmt) for lint/format

## Deployment

- Production: `bun run deploy`
- Preview: Auto-deploy on PRs
- Monitor: `bunx wrangler tail`

Cloudflare D1 binding in `wrangler.jsonc`.

## Communication

Extreme concision. Sacrifice grammar for brevity.
