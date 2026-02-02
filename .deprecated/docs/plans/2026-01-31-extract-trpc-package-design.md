# Extract tRPC to Separate Package

**Date:** 2026-01-31
**Status:** Approved

## Overview

Extract tRPC-related code from `@scorebrawl/database` into a new `@scorebrawl/trpc` package to establish clear separation between data access and API layers.

## Architecture

### Layered Structure

**Layer 1: Database** (`@scorebrawl/database`)
- Database schema and migrations
- Repositories (data access layer)
- DTOs and models
- Custom errors
- Core utilities

**Layer 2: API** (`@scorebrawl/trpc`)
- tRPC router definitions
- API procedures and middleware
- Request/response types
- Route-level business logic
- API tests

**Layer 3: Applications** (apps/backend, apps/frontend)
- Backend: tRPC server setup and handlers
- Frontend: tRPC client configuration

### Benefits

- Clear separation of concerns (data access vs API layer)
- Database package can be used without tRPC (e.g., in background jobs, CLI tools)
- Easier to test each layer independently
- Future flexibility (could add a REST API package alongside tRPC)

## Package Structure

```
packages/trpc/
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── src/
    ├── index.ts                    # Main exports
    ├── types.ts                    # Type exports
    ├── trpc.ts                     # tRPC instance, middleware, procedures
    ├── root.ts                     # App router
    └── routers/
        ├── achievement-router.ts
        ├── avatar-router.ts
        ├── invite-router.ts
        ├── league-router.ts
        ├── league-player-router.ts
        ├── league-team-router.ts
        ├── match-router.ts
        ├── member-router.ts
        ├── season-router.ts
        ├── season-player-router.ts
        ├── season-team-router.ts
        ├── user-router.ts
        └── __tests__/
            ├── league-router.spec.ts
            ├── match-router.spec.ts
            ├── season-router.spec.ts
            └── user-router.spec.ts
```

### Package Exports

```json
{
  "exports": {
    ".": "./src/index.ts",
    "./types": "./src/types.ts",
    "./routers/*": "./src/routers/*.ts"
  }
}
```

## Dependencies

### New Package Dependencies

**Runtime:**
- `@scorebrawl/database`: workspace:*
- `@scorebrawl/utils`: workspace:*
- `@trpc/server`: next
- `better-auth`: ^1.1.6
- `superjson`: ^2.2.1
- `zod`: ^3.24.2

**Dev:**
- `@scorebrawl/typescript-config`: workspace:*
- `@types/bun`: latest
- `typescript`: 5.5.4
- `vitest`: ^3.0.5

### Database Package Changes

**Remove:**
- `@trpc/server` (moving to trpc package)
- `superjson` (moving to trpc package)
- Export paths: `./trpc` and `./trpc/types`

**Keep:**
- `better-auth` (used by database)
- `zod` (used by database)

## Import Updates

All imports in moved files change from relative to package imports:

```typescript
// Before
import { ScoreBrawlError } from "../errors";
import { findBySlugWithUserRole } from "../repositories/league-repository";

// After
import { ScoreBrawlError } from "@scorebrawl/database";
import { findBySlugWithUserRole } from "@scorebrawl/database/repositories/league-repository";
```

## Migration

### Application Updates

**apps/backend/src/trpc.ts:**
```typescript
// Before
import { appRouter, type TRPCContext } from "@scorebrawl/database/trpc";

// After
import { appRouter, type TRPCContext } from "@scorebrawl/trpc";
```

**apps/frontend/src/lib/trpc.ts:**
```typescript
// Before
import type { AppRouter } from "@scorebrawl/database/trpc/types";

// After
import type { AppRouter } from "@scorebrawl/trpc/types";
```

### Verification Steps

1. Run TypeScript compilation across all packages
2. Run all tRPC tests: `cd packages/trpc && bun test`
3. Run database tests: `cd packages/database && bun test`
4. Start backend and verify tRPC endpoints
5. Start frontend and verify client connection

### Atomic Commit Strategy

All changes in a single commit:
- Create new package structure
- Move files with updated imports
- Update database package.json
- Update app imports
- Update workspace configuration

## Testing

### Test Configuration

New `packages/trpc/vitest.config.ts` will configure test environment for API layer tests.

### Test Coverage

- Router endpoint tests (*.spec.ts)
- Authorization middleware tests
- Input/output schema validation
- Database repository mocking

### Success Criteria

- ✅ All existing tests pass in new location
- ✅ TypeScript compiles without errors
- ✅ Backend server handles tRPC requests
- ✅ Frontend client calls endpoints successfully
- ✅ No circular dependencies
- ✅ Database package works independently of tRPC
