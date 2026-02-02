# Next.js to Hono + React Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate the Next.js app (apps/scorebrawl) to separate Hono backend (apps/backend) and React SPA frontend (apps/frontend) with shared database/tRPC package.

**Architecture:** Create a shared `packages/database` containing Drizzle schemas, repositories, and tRPC routers. Backend uses Hono with tRPC integration. Frontend uses React with TanStack Router and tRPC client. Vite proxy forwards API requests to backend during development.

**Tech Stack:** Hono, tRPC, React, TanStack Router, Drizzle ORM, Bun, Vite, Shadcn/ui

---

## Task 1: Create Shared Database Package

**Files:**
- Create: `packages/database/package.json`
- Create: `packages/database/tsconfig.json`
- Create: `packages/database/src/index.ts`

**Step 1: Create package.json**

```json
{
  "name": "@scorebrawl/database",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./schema": "./src/schema.ts",
    "./types": "./src/types.ts",
    "./repositories/*": "./src/repositories/*.ts",
    "./trpc": "./src/trpc/index.ts"
  },
  "dependencies": {
    "drizzle-orm": "^0.44.5",
    "postgres": "^3.4.7",
    "zod": "^3.24.2",
    "@trpc/server": "next",
    "superjson": "^2.2.1",
    "@paralleldrive/cuid2": "^2.2.2",
    "@sindresorhus/slugify": "^2.2.1"
  },
  "devDependencies": {
    "@scorebrawl/typescript-config": "workspace:*",
    "typescript": "5.5.4"
  }
}
```

**Step 2: Create tsconfig.json**

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

**Step 3: Create placeholder index.ts**

```typescript
export * from "./schema";
export * from "./types";
export * from "./db";
```

**Step 4: Run bun install**

Run: `bun install`
Expected: Dependencies installed successfully

**Step 5: Commit**

```bash
git add packages/database
git commit -m "feat: create shared database package

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Copy Database Schema and Types

**Files:**
- Create: `packages/database/src/schema.ts`
- Create: `packages/database/src/types.ts`
- Create: `packages/database/src/db.ts`
- Create: `packages/database/src/errors.ts`
- Create: `packages/database/src/global.d.ts`

**Step 1: Copy schema.ts**

Run: `cp apps/scorebrawl/src/db/schema.ts packages/database/src/schema.ts`
Expected: File copied

**Step 2: Copy types.ts**

Run: `cp apps/scorebrawl/src/db/types.ts packages/database/src/types.ts`
Expected: File copied

**Step 3: Copy db.ts**

Run: `cp apps/scorebrawl/src/db/db.ts packages/database/src/db.ts`
Expected: File copied

**Step 4: Copy errors.ts**

Run: `cp apps/scorebrawl/src/db/errors.ts packages/database/src/errors.ts`
Expected: File copied

**Step 5: Copy global.d.ts**

Run: `cp apps/scorebrawl/src/db/global.d.ts packages/database/src/global.d.ts`
Expected: File copied

**Step 6: Commit**

```bash
git add packages/database/src
git commit -m "feat: copy database schema and types to shared package

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Copy Database Repositories

**Files:**
- Create: `packages/database/src/repositories/*`

**Step 1: Copy entire repositories directory**

Run: `cp -r apps/scorebrawl/src/db/repositories packages/database/src/`
Expected: All repository files copied

**Step 2: Verify files copied**

Run: `ls -la packages/database/src/repositories`
Expected: List of repository files

**Step 3: Commit**

```bash
git add packages/database/src/repositories
git commit -m "feat: copy database repositories to shared package

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Copy Models and DTOs

**Files:**
- Create: `packages/database/src/model/*`
- Create: `packages/database/src/dto/*`

**Step 1: Copy models directory**

Run: `cp -r apps/scorebrawl/src/model packages/database/src/`
Expected: Models copied

**Step 2: Copy DTOs directory**

Run: `cp -r apps/scorebrawl/src/dto packages/database/src/`
Expected: DTOs copied

**Step 3: Update package.json exports**

Edit `packages/database/package.json` and add:

```json
"exports": {
  ".": "./src/index.ts",
  "./schema": "./src/schema.ts",
  "./types": "./src/types.ts",
  "./repositories/*": "./src/repositories/*.ts",
  "./model": "./src/model/index.ts",
  "./dto": "./src/dto/index.ts",
  "./trpc": "./src/trpc/index.ts"
}
```

**Step 4: Commit**

```bash
git add packages/database
git commit -m "feat: add models and DTOs to database package

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Copy tRPC Setup to Database Package

**Files:**
- Create: `packages/database/src/trpc/context.ts`
- Create: `packages/database/src/trpc/trpc.ts`
- Create: `packages/database/src/trpc/root.ts`
- Create: `packages/database/src/trpc/index.ts`
- Create: `packages/database/src/trpc/routers/*`

**Step 1: Create trpc directory**

Run: `mkdir -p packages/database/src/trpc/routers`
Expected: Directory created

**Step 2: Copy API setup files**

Run: `cp apps/scorebrawl/src/server/api/trpc.ts packages/database/src/trpc/trpc.ts`
Expected: File copied

**Step 3: Copy root router**

Run: `cp apps/scorebrawl/src/server/api/root.ts packages/database/src/trpc/root.ts`
Expected: File copied

**Step 4: Copy all router files**

Run: `cp -r apps/scorebrawl/src/server/api/routers/* packages/database/src/trpc/routers/`
Expected: All router files copied

**Step 5: Create context.ts for better-auth integration**

Create `packages/database/src/trpc/context.ts`:

```typescript
import type { Session, User } from "better-auth/types";

export type TRPCContext = {
  session: Session | null;
  user: User | null;
  headers: Headers;
};

export const createTRPCContext = (opts: {
  session: Session | null;
  user: User | null;
  headers: Headers;
}): TRPCContext => {
  return {
    session: opts.session,
    user: opts.user,
    headers: opts.headers,
  };
};
```

**Step 6: Update trpc.ts to use context type**

Edit `packages/database/src/trpc/trpc.ts` and replace context type references with import from `./context.ts`

**Step 7: Create index.ts**

Create `packages/database/src/trpc/index.ts`:

```typescript
export { appRouter } from "./root";
export type { AppRouter } from "./root";
export { createTRPCContext } from "./context";
export type { TRPCContext } from "./context";
```

**Step 8: Commit**

```bash
git add packages/database/src/trpc
git commit -m "feat: add tRPC routers to database package

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Fix Import Paths in Database Package

**Files:**
- Modify: All files in `packages/database/src`

**Step 1: Replace @/ imports with relative imports**

Run a find and replace across all files in packages/database/src:
- Replace `@/db` with `..` or appropriate relative path
- Replace `@/model` with `../model`
- Replace `@/dto` with `../dto`

This requires careful manual editing or a script.

**Step 2: Verify no @ imports remain**

Run: `grep -r "from \"@/" packages/database/src`
Expected: No results (or only comments)

**Step 3: Test compilation**

Run: `cd packages/database && bun run tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add packages/database
git commit -m "fix: resolve import paths in database package

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 7: Setup Backend Package Dependencies

**Files:**
- Modify: `apps/backend/package.json`
- Create: `apps/backend/tsconfig.json`
- Create: `apps/backend/.env.example`

**Step 1: Update package.json**

Edit `apps/backend/package.json`:

```json
{
  "name": "backend",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "bun run --hot src/index.ts",
    "build": "bun build src/index.ts --outdir=dist",
    "start": "bun run dist/index.js"
  },
  "dependencies": {
    "@scorebrawl/database": "workspace:*",
    "@trpc/server": "next",
    "hono": "^4.11.4",
    "superjson": "^2.2.1",
    "drizzle-orm": "^0.44.5",
    "postgres": "^3.4.7",
    "better-auth": "^1.3.11",
    "zod": "^3.24.2"
  },
  "devDependencies": {
    "@scorebrawl/typescript-config": "workspace:*",
    "@types/bun": "latest",
    "typescript": "5.5.4"
  }
}
```

**Step 2: Create tsconfig.json**

Create `apps/backend/tsconfig.json`:

```json
{
  "extends": "@scorebrawl/typescript-config/base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "types": ["bun-types"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 3: Create .env.example**

Create `apps/backend/.env.example`:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/scorebrawl
BETTER_AUTH_SECRET=your-secret-key
BETTER_AUTH_URL=http://localhost:3001
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
UPLOADTHING_TOKEN=
```

**Step 4: Run bun install**

Run: `bun install`
Expected: Dependencies installed

**Step 5: Commit**

```bash
git add apps/backend
git commit -m "feat: setup backend dependencies and configuration

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 8: Setup Backend with Hono and tRPC

**Files:**
- Create: `apps/backend/src/auth.ts`
- Create: `apps/backend/src/trpc.ts`
- Modify: `apps/backend/src/index.ts`

**Step 1: Copy auth setup**

Run: `cp apps/scorebrawl/src/lib/auth.ts apps/backend/src/auth.ts`
Expected: File copied

**Step 2: Create tRPC adapter for Hono**

Create `apps/backend/src/trpc.ts`:

```typescript
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter, createTRPCContext } from "@scorebrawl/database/trpc";
import type { Context } from "hono";
import { auth } from "./auth";

export async function handleTRPC(c: Context) {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext: () =>
      createTRPCContext({
        session: session?.session ?? null,
        user: session?.user ?? null,
        headers: c.req.raw.headers,
      }),
  });
}
```

**Step 3: Update index.ts with routes**

Edit `apps/backend/src/index.ts`:

```typescript
import { Hono } from "hono";
import { cors } from "hono/cors";
import { handleTRPC } from "./trpc";
import { auth } from "./auth";

const app = new Hono();

// CORS for frontend
app.use(
  "/*",
  cors({
    origin: ["http://localhost:3000"],
    credentials: true,
  })
);

// Health check
app.get("/health", (c) => c.json({ status: "ok" }));

// Better-auth routes
app.on(["POST", "GET"], "/api/auth/**", (c) => {
  return auth.handler(c.req.raw);
});

// tRPC routes
app.all("/api/trpc/*", handleTRPC);

export default app;
```

**Step 4: Test server starts**

Run: `cd apps/backend && bun run dev` (in background)
Expected: Server starts on default port

**Step 5: Stop server**

Run: Kill the background process
Expected: Server stopped

**Step 6: Commit**

```bash
git add apps/backend/src
git commit -m "feat: setup Hono backend with tRPC and auth

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 9: Setup Frontend Package Dependencies

**Files:**
- Modify: `apps/frontend/package.json`
- Create: `apps/frontend/.env.example`

**Step 1: Update package.json**

Edit `apps/frontend/package.json` to add missing dependencies:

```json
{
  "name": "frontend",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite dev --port 3000",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "@scorebrawl/database": "workspace:*",
    "@trpc/client": "next",
    "@trpc/react-query": "next",
    "@tailwindcss/vite": "^4.0.6",
    "@tanstack/query-db-collection": "^0.2.0",
    "@tanstack/react-db": "^0.1.1",
    "@tanstack/react-devtools": "^0.7.0",
    "@tanstack/react-query": "^5.69.0",
    "@tanstack/react-query-devtools": "^5.84.2",
    "@tanstack/react-router": "^1.132.0",
    "@tanstack/react-router-devtools": "^1.132.0",
    "@tanstack/react-start": "^1.132.0",
    "@tanstack/router-plugin": "^1.132.0",
    "better-auth": "^1.3.11",
    "@daveyplate/better-auth-ui": "^3.1.10",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "lucide-react": "^0.544.0",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "superjson": "^2.2.1",
    "tailwind-merge": "^3.0.2",
    "tailwindcss": "^4.0.6",
    "vite-tsconfig-paths": "^5.1.4",
    "zod": "^3.24.2",
    "react-hook-form": "^7.62.0",
    "@hookform/resolvers": "^5.2.2",
    "date-fns": "^3.6.0",
    "next-themes": "^0.3.0"
  },
  "devDependencies": {
    "@scorebrawl/typescript-config": "workspace:*",
    "@tanstack/devtools-vite": "^0.3.11",
    "@testing-library/dom": "^10.4.0",
    "@testing-library/react": "^16.2.0",
    "@types/node": "^22.10.2",
    "@types/react": "^19.2.0",
    "@types/react-dom": "^19.2.0",
    "@vitejs/plugin-react": "^5.0.4",
    "jsdom": "^27.0.0",
    "typescript": "^5.7.2",
    "vite": "^7.1.7",
    "vitest": "^3.0.5"
  }
}
```

**Step 2: Create .env.example**

Create `apps/frontend/.env.example`:

```env
VITE_API_URL=http://localhost:3001
```

**Step 3: Run bun install**

Run: `bun install`
Expected: Dependencies installed

**Step 4: Commit**

```bash
git add apps/frontend
git commit -m "feat: add frontend dependencies

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 10: Configure Vite Proxy

**Files:**
- Modify: `apps/frontend/vite.config.ts`

**Step 1: Update vite.config.ts with proxy**

Edit `apps/frontend/vite.config.ts`:

```typescript
import { defineConfig } from "vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import viteTsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";

const config = defineConfig({
  plugins: [
    devtools(),
    viteTsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});

export default config;
```

**Step 2: Commit**

```bash
git add apps/frontend/vite.config.ts
git commit -m "feat: configure Vite proxy for backend API

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 11: Setup tRPC Client in Frontend

**Files:**
- Create: `apps/frontend/src/lib/trpc.ts`
- Create: `apps/frontend/src/lib/auth-client.ts`

**Step 1: Create tRPC client**

Create `apps/frontend/src/lib/trpc.ts`:

```typescript
import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "@scorebrawl/database/trpc";

export const trpc = createTRPCReact<AppRouter>();

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch: (url, options) => {
        return fetch(url, {
          ...options,
          credentials: "include",
        });
      },
    }),
  ],
});
```

**Step 2: Copy auth client**

Run: `cp apps/scorebrawl/src/lib/auth-client.ts apps/frontend/src/lib/auth-client.ts`
Expected: File copied

**Step 3: Update auth client for new URL**

Edit `apps/frontend/src/lib/auth-client.ts` to use `baseURL: "/api/auth"` instead of relative path

**Step 4: Commit**

```bash
git add apps/frontend/src/lib
git commit -m "feat: setup tRPC and auth clients in frontend

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 12: Setup tRPC and Query Providers

**Files:**
- Create: `apps/frontend/src/providers/trpc-provider.tsx`

**Step 1: Create tRPC provider**

Create `apps/frontend/src/providers/trpc-provider.tsx`:

```typescript
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { trpc, trpcClient } from "@/lib/trpc";
import { useState } from "react";

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
          },
        },
      })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </trpc.Provider>
  );
}
```

**Step 2: Update router.tsx to use provider**

Edit `apps/frontend/src/router.tsx` to wrap with TRPCProvider

**Step 3: Commit**

```bash
git add apps/frontend/src/providers
git commit -m "feat: add tRPC provider to frontend

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 13: Copy Shadcn Components to Frontend

**Files:**
- Create: `apps/frontend/src/components/ui/*`
- Create: `apps/frontend/src/lib/utils.ts`

**Step 1: Create ui directory**

Run: `mkdir -p apps/frontend/src/components/ui`
Expected: Directory created

**Step 2: Copy all UI components**

Run: `cp -r apps/scorebrawl/src/components/ui/* apps/frontend/src/components/ui/`
Expected: All components copied

**Step 3: Copy utils.ts**

Run: `cp apps/scorebrawl/src/lib/utils.ts apps/frontend/src/lib/utils.ts`
Expected: File copied

**Step 4: Update components.json to match scorebrawl config**

Edit `apps/frontend/components.json`:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/styles.css",
    "baseColor": "slate",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

**Step 5: Commit**

```bash
git add apps/frontend/src/components/ui apps/frontend/src/lib/utils.ts apps/frontend/components.json
git commit -m "feat: copy shadcn components to frontend

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 14: Copy Global Styles and Fonts

**Files:**
- Modify: `apps/frontend/src/styles.css`

**Step 1: Copy global styles from scorebrawl**

Run: `cat apps/scorebrawl/src/app/globals.css >> apps/frontend/src/styles.css`
Expected: Styles appended

**Step 2: Manually review and deduplicate**

Edit `apps/frontend/src/styles.css` to remove duplicates and merge properly

**Step 3: Commit**

```bash
git add apps/frontend/src/styles.css
git commit -m "feat: copy global styles to frontend

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 15: Update Turbo Configuration

**Files:**
- Modify: `turbo.json`
- Modify: Root `package.json`

**Step 1: Update turbo.json**

Edit `turbo.json`:

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.local", "**/.env"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"],
      "env": [
        "BETTER_AUTH_SECRET",
        "DATABASE_URL",
        "GOOGLE_CLIENT_ID",
        "GOOGLE_CLIENT_SECRET",
        "SKIP_ENV_VALIDATION",
        "NODE_ENV",
        "UPLOADTHING_TOKEN",
        "VITE_API_URL"
      ]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "cache": false,
      "persistent": true
    }
  }
}
```

**Step 2: Update root package.json scripts**

Edit root `package.json`:

```json
{
  "scripts": {
    "build": "turbo build",
    "dev:all": "turbo dev",
    "dev:scorebrawl": "turbo dev --filter scorebrawl",
    "dev:new": "turbo dev --filter frontend --filter backend",
    "db:start": "./dev/bin/start-db.sh",
    "db:stop": "./dev/bin/stop-db.sh",
    "test": "turbo test",
    "flint": "bunx @biomejs/biome check . --write --unsafe",
    "flint:check": "bunx @biomejs/biome check ."
  }
}
```

**Step 3: Commit**

```bash
git add turbo.json package.json
git commit -m "feat: update turbo config for new apps

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 16: Start Development Servers

**Files:**
- None (testing only)

**Step 1: Start backend in background**

Run: `cd apps/backend && bun run dev &`
Expected: Backend starts on port 3001

**Step 2: Start frontend**

Run: `cd apps/frontend && bun run dev`
Expected: Frontend starts on port 3000, route tree is generated

**Step 3: Verify proxy works**

Open browser to `http://localhost:3000` and check network tab for API calls going through proxy

**Step 4: Stop servers**

Run: Stop both processes
Expected: Servers stopped

**Step 5: Create .env files**

Create `apps/backend/.env` and `apps/frontend/.env` from examples

**Step 6: Commit**

```bash
git add apps/backend/.env.example apps/frontend/.env.example
git commit -m "docs: add environment variable examples

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 17: Create Migration Documentation

**Files:**
- Create: `docs/MIGRATION.md`

**Step 1: Create migration guide**

Create `docs/MIGRATION.md`:

```markdown
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
- ✅ tRPC routers
- ✅ Authentication setup
- ✅ Shadcn components
- ⏳ Component migration (in progress)
- ⏳ Route migration (in progress)
```

**Step 2: Commit**

```bash
git add docs/MIGRATION.md
git commit -m "docs: add migration documentation

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Post-Migration Tasks

The following tasks should be completed after the core migration:

1. **Migrate components**: Copy business logic components from `apps/scorebrawl/src/components` to `apps/frontend/src/components`
2. **Migrate pages**: Convert Next.js pages/routes to TanStack Router routes
3. **Update imports**: Change all component imports to use new structure
4. **Authentication UI**: Integrate Better-Auth UI components
5. **File uploads**: Set up UploadThing in backend
6. **Background jobs**: Set up Trigger.dev in backend
7. **Testing**: Port tests to Vitest
8. **Deployment**: Configure for production (Vercel frontend, Railway/Fly.io backend)
9. **Remove legacy app**: Once migration is complete, remove `apps/scorebrawl`

## Notes

- Don't manually create route tree - let Vite dev server auto-generate it
- Both apps will diverge in components over time (SPA vs SSR)
- Database package can be used by both Next.js and Hono during transition period
