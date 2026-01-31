# Next.js to Hono + React Migration

## Overview

The Scorebrawl application has been migrated from a monolithic Next.js app to a separated architecture:

- **Backend**: Hono + tRPC API (apps/backend)
- **Frontend**: React + TanStack Router SPA (apps/frontend)
- **Shared**: Database, models, and tRPC routers (packages/database)
- **Legacy**: Original Next.js app (apps/scorebrawl) - to be deprecated

## Running the New Stack

### Development

Start both servers:
```bash
bun run dev:new
```

Or individually:
```bash
# Backend
cd apps/backend && bun run dev

# Frontend (separate terminal)
cd apps/frontend && bun run dev
```

### Environment Variables

**Backend** (`apps/backend/.env`):
- DATABASE_URL
- BETTER_AUTH_SECRET
- BETTER_AUTH_URL
- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET

**Frontend** (`apps/frontend/.env`):
- VITE_API_URL=http://localhost:3001

## Architecture

### Request Flow

1. Frontend makes tRPC call
2. Vite proxy forwards `/api/*` to backend (dev only)
3. Hono backend routes to tRPC handler
4. tRPC router executes (from @scorebrawl/database)
5. Response returns through chain

### Shared Database Package

`packages/database` exports:
- Schema (Drizzle)
- Repositories
- Models and DTOs
- tRPC routers

Both Next.js app and Hono backend can use this package.

## Migration Status

- ✅ Database and models
- ✅ tRPC routers with tests
- ✅ Authentication setup
- ✅ Shadcn components
- ⏳ Component migration (in progress)
- ⏳ Route migration (in progress)

## Testing

```bash
# Test database package
cd packages/database && bun test

# Test frontend
cd apps/frontend && bun test

# Test backend
cd apps/backend && bun test
```

## Notes

- Don't manually create route tree - let Vite dev server auto-generate it
- Both apps will diverge in components over time (SPA vs SSR)
- Database package can be used by both Next.js and Hono during transition period
