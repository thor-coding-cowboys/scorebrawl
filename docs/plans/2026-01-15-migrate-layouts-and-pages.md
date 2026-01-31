# Migrate Next.js Layouts and Pages to TanStack Router

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Properly migrate all layouts, pages, and components from the Next.js app (apps/scorebrawl) to the new TanStack Router app (apps/frontend)

**Architecture:** Convert Next.js Server Components and route groups to TanStack Router file-based routing with client-side layouts. Replace Next.js-specific features (Server Actions, metadata) with TanStack Router equivalents.

**Tech Stack:** TanStack Router, React Query (via tRPC), React Context for shared state

---

## Phase 1: Core Layout Infrastructure

### Task 1: Create Sidebar Navigation System

**Files:**
- Copy: `apps/scorebrawl/src/components/app-sidebar.tsx` → `apps/frontend/src/components/app-sidebar.tsx`
- Copy: `apps/scorebrawl/src/components/nav-main.tsx` → `apps/frontend/src/components/nav-main.tsx`
- Copy: `apps/scorebrawl/src/components/nav-user.tsx` → `apps/frontend/src/components/nav-user.tsx`
- Copy: `apps/scorebrawl/src/components/layout/league-switcher.tsx` → `apps/frontend/src/components/layout/league-switcher.tsx` (if not exists)

**Step 1: Copy AppSidebar component**

Copy the entire `app-sidebar.tsx` file and convert Next.js specific imports:

```typescript
// Change from:
import { useParams, usePathname, useRouter } from "next/navigation";
import Image from "next/image";

// Change to:
import { useParams, useNavigate } from "@tanstack/react-router";
import { useLocation } from "@tanstack/react-router";
// Replace Image with regular <img> tag
```

**Step 2: Update navigation logic**

Replace Next.js router with TanStack Router:
- `router.push()` → `navigate({ to: url })`
- `pathname` → `location.pathname`
- `useParams<{ leagueSlug: string }>()` → `useParams({ from: '/leagues/$leagueSlug' })`

**Step 3: Copy NavMain and NavUser components**

Copy these files and apply same conversions for Next.js imports.

**Step 4: Test sidebar rendering**

Temporarily add sidebar to `__root.tsx` to verify it renders without errors.

**Step 5: Commit**

```bash
git add apps/frontend/src/components/app-sidebar.tsx apps/frontend/src/components/nav-main.tsx apps/frontend/src/components/nav-user.tsx
git commit -m "feat: add sidebar navigation system"
```

---

### Task 2: Create Authenticated Leagues Layout

**Files:**
- Create: `apps/frontend/src/routes/_authenticated.tsx` (layout route)
- Modify: `apps/frontend/src/routes/__root.tsx`

**Step 1: Create authenticated layout route**

TanStack Router uses `_` prefix for layout routes. Create `_authenticated.tsx`:

```typescript
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { AppSidebar } from '@/components/app-sidebar';
import { SiteFooter } from '@/components/layout/site-footer';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { authClient } from '@/lib/auth-client';
import { trpc } from '@/lib/trpc';

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async () => {
    const { data: session } = await authClient.getSession();

    if (!session) {
      throw redirect({ to: '/auth/sign-in' });
    }

    return { session };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { data: leagues } = trpc.league.getAll.useQuery();

  return (
    <SidebarProvider>
      <AppSidebar leagues={leagues || []} />
      <SidebarInset className="h-full">
        <main className="flex-1 container relative flex flex-col">
          <Outlet />
        </main>
        <SiteFooter />
      </SidebarInset>
    </SidebarProvider>
  );
}
```

**Step 2: Move authenticated routes under layout**

Restructure routes to use the layout:
- Move `routes/leagues/` → `routes/_authenticated/leagues/`
- Move `routes/profile.tsx` → `routes/_authenticated/profile.tsx`
- Move `routes/onboarding.tsx` → `routes/_authenticated/onboarding.tsx`

**Step 3: Update route imports**

Update all moved route files to use new path in `createFileRoute()`:
- `/leagues/$leagueSlug` → `/_authenticated/leagues/$leagueSlug`

**Step 4: Test navigation**

Run: `bun run dev`
Navigate to `http://localhost:3000/leagues/my-awesome-league`
Expected: Sidebar appears with league navigation

**Step 5: Commit**

```bash
git add apps/frontend/src/routes/_authenticated* apps/frontend/src/routes/_authenticated/leagues/
git commit -m "feat: add authenticated layout with sidebar"
```

---

### Task 3: Create Season Context Provider

**Files:**
- Copy: `apps/scorebrawl/src/context/season-context.tsx` → `apps/frontend/src/context/season-context.tsx`
- Create: `apps/frontend/src/routes/_authenticated/leagues/$leagueSlug/seasons/$seasonSlug.tsx` (layout)

**Step 1: Copy SeasonContext**

Copy the season context file and convert:

```typescript
// Change from Next.js:
"use client";

// To TanStack Router approach - just export the context
import { createContext, useContext, type ReactNode } from 'react';
import { trpc } from '@/lib/trpc';

interface SeasonContextValue {
  season: /* Season type */;
  leagueSlug: string;
  seasonSlug: string;
}

const SeasonContext = createContext<SeasonContextValue | null>(null);

export function SeasonProvider({
  children,
  leagueSlug,
  seasonSlug
}: {
  children: ReactNode;
  leagueSlug: string;
  seasonSlug: string;
}) {
  const { data: season } = trpc.season.getBySlug.useQuery({ leagueSlug, seasonSlug });

  if (!season) return <div>Loading season...</div>;

  return (
    <SeasonContext.Provider value={{ season, leagueSlug, seasonSlug }}>
      {children}
    </SeasonContext.Provider>
  );
}

export function useSeason() {
  const context = useContext(SeasonContext);
  if (!context) throw new Error('useSeason must be used within SeasonProvider');
  return context;
}
```

**Step 2: Update season layout route**

Modify `routes/_authenticated/leagues/$leagueSlug/seasons/$seasonSlug/route.tsx`:

```typescript
import { createFileRoute, Outlet } from '@tanstack/react-router';
import { SeasonProvider } from '@/context/season-context';

export const Route = createFileRoute('/_authenticated/leagues/$leagueSlug/seasons/$seasonSlug')({
  component: SeasonLayout,
});

function SeasonLayout() {
  const { leagueSlug, seasonSlug } = Route.useParams();

  return (
    <SeasonProvider leagueSlug={leagueSlug} seasonSlug={seasonSlug}>
      <Outlet />
    </SeasonProvider>
  );
}
```

**Step 3: Test context access**

Add temporary test in season index page to verify context works.

**Step 4: Commit**

```bash
git add apps/frontend/src/context/season-context.tsx
git commit -m "feat: add season context provider"
```

---

## Phase 2: League Pages Migration

### Task 4: Migrate League Home/Dashboard Page

**Files:**
- Copy: `apps/scorebrawl/src/app/(leagues)/leagues/[leagueSlug]/page.tsx` → `apps/frontend/src/routes/_authenticated/leagues/$leagueSlug/index.tsx`
- Copy all related components from `apps/scorebrawl/src/app/(leagues)/leagues/[leagueSlug]/components/`

**Step 1: Read original page**

Examine `apps/scorebrawl/src/app/(leagues)/leagues/[leagueSlug]/page.tsx` to understand structure.

**Step 2: Copy and convert page**

Convert Server Component to TanStack Router component:

```typescript
import { createFileRoute } from '@tanstack/react-router';
import { trpc } from '@/lib/trpc';

export const Route = createFileRoute('/_authenticated/leagues/$leagueSlug/')({
  component: LeaguePage,
});

function LeaguePage() {
  const { leagueSlug } = Route.useParams();
  const { data: league } = trpc.league.getLeagueBySlugAndRole.useQuery({ leagueSlug });
  const { data: activeSeason } = trpc.season.findActive.useQuery({ leagueSlug });

  // Rest of component logic...
}
```

**Step 3: Copy related components**

Copy any components used by this page from `apps/scorebrawl/src/app/(leagues)/leagues/[leagueSlug]/components/` to corresponding location in `apps/frontend`.

**Step 4: Test page rendering**

Navigate to league page and verify it displays correctly.

**Step 5: Commit**

```bash
git add apps/frontend/src/routes/_authenticated/leagues/\$leagueSlug/index.tsx
git commit -m "feat: migrate league home page"
```

---

### Task 5: Migrate Seasons List Page

**Files:**
- Replace: `apps/frontend/src/routes/_authenticated/leagues/$leagueSlug/seasons/index.tsx`
- Copy components from: `apps/scorebrawl/src/app/(leagues)/leagues/[leagueSlug]/seasons/`

**Step 1: Copy page from Next.js app**

```bash
cp apps/scorebrawl/src/app/\(leagues\)/leagues/[leagueSlug]/seasons/page.tsx apps/frontend/src/routes/_authenticated/leagues/\$leagueSlug/seasons/index.tsx
```

**Step 2: Convert to TanStack Router**

Update imports and structure:

```typescript
import { createFileRoute, Link } from '@tanstack/react-router';
import { trpc } from '@/lib/trpc';

export const Route = createFileRoute('/_authenticated/leagues/$leagueSlug/seasons/')({
  component: SeasonsPage,
});

function SeasonsPage() {
  const { leagueSlug } = Route.useParams();
  const { data: seasons } = trpc.season.getAll.useQuery({ leagueSlug });
  const { data: league } = trpc.league.getLeagueBySlugAndRole.useQuery({ leagueSlug });

  // Render seasons list with cards
  // Show "Create Season" button if user has editor access
}
```

**Step 3: Copy AddSeasonButton component**

Copy `apps/scorebrawl/src/app/(leagues)/leagues/[leagueSlug]/seasons/components/AddSeasonButton.tsx` and convert.

**Step 4: Test page**

Visit `/leagues/my-awesome-league/seasons` and verify seasons list displays.

**Step 5: Commit**

```bash
git add apps/frontend/src/routes/_authenticated/leagues/\$leagueSlug/seasons/index.tsx
git commit -m "feat: migrate seasons list page"
```

---

### Task 6: Migrate Season Dashboard Page

**Files:**
- Replace: `apps/frontend/src/routes/_authenticated/leagues/$leagueSlug/seasons/$seasonSlug/index.tsx`
- Copy all components from: `apps/scorebrawl/src/app/(leagues)/leagues/[leagueSlug]/seasons/[seasonSlug]/components/`

**Step 1: Identify components to copy**

List all components in season dashboard:
- DashboardCards
- StandingTabs (with SeasonPlayerStanding, SeasonTeamStanding)
- LatestMatches
- Fixtures
- Charts (PointProgression, PlayerFormCard)
- YourNextMatchCard

**Step 2: Copy component directory**

```bash
mkdir -p apps/frontend/src/components/season
cp -r apps/scorebrawl/src/app/\(leagues\)/leagues/[leagueSlug]/seasons/[seasonSlug]/components/* apps/frontend/src/components/season/
```

**Step 3: Convert each component**

Go through each component and:
- Remove `"use client"` directives
- Change Next.js imports (`next/link` → `@tanstack/react-router`)
- Replace Server Component data fetching with tRPC hooks
- Update Image components to regular img tags

**Step 4: Update main page**

Replace season index page with rich dashboard:

```typescript
import { createFileRoute } from '@tanstack/react-router';
import { useSeason } from '@/context/season-context';
import { DashboardCards } from '@/components/season/DashboardCards';
import { StandingTabs } from '@/components/season/StandingTabs';
import { LatestMatches } from '@/components/season/LatestMatches';
import { Fixtures } from '@/components/season/Fixtures';

export const Route = createFileRoute('/_authenticated/leagues/$leagueSlug/seasons/$seasonSlug/')({
  component: SeasonDashboard,
});

function SeasonDashboard() {
  const { season, leagueSlug, seasonSlug } = useSeason();

  return (
    <div className="space-y-6">
      <DashboardCards />
      <StandingTabs />
      <LatestMatches />
      <Fixtures />
    </div>
  );
}
```

**Step 5: Test dashboard**

Navigate to season page and verify all components render correctly.

**Step 6: Commit**

```bash
git add apps/frontend/src/components/season/ apps/frontend/src/routes/_authenticated/leagues/\$leagueSlug/seasons/\$seasonSlug/index.tsx
git commit -m "feat: migrate season dashboard with charts and standings"
```

---

### Task 7: Migrate Matches Pages

**Files:**
- Replace: `apps/frontend/src/routes/_authenticated/leagues/$leagueSlug/seasons/$seasonSlug/matches/index.tsx`
- Replace: `apps/frontend/src/routes/_authenticated/leagues/$leagueSlug/seasons/$seasonSlug/matches/create.tsx`
- Copy: `apps/scorebrawl/src/app/(leagues)/leagues/[leagueSlug]/seasons/[seasonSlug]/matches/elo-create/` components

**Step 1: Copy MatchesPage component**

Copy from `apps/scorebrawl/src/app/(leagues)/leagues/[leagueSlug]/seasons/[seasonSlug]/matches/components/MatchesPage.tsx`.

**Step 2: Update matches index page**

```typescript
import { createFileRoute } from '@tanstack/react-router';
import { MatchesPage } from '@/components/season/MatchesPage';

export const Route = createFileRoute('/_authenticated/leagues/$leagueSlug/seasons/$seasonSlug/matches/')({
  component: MatchesPage,
});
```

**Step 3: Copy match creation components**

```bash
cp -r apps/scorebrawl/src/app/\(leagues\)/leagues/[leagueSlug]/seasons/[seasonSlug]/matches/elo-create/components/* apps/frontend/src/components/match/
```

**Step 4: Update match create page**

```typescript
import { createFileRoute } from '@tanstack/react-router';
import { MatchForm } from '@/components/match/MatchForm';
import { useSeason } from '@/context/season-context';

export const Route = createFileRoute('/_authenticated/leagues/$leagueSlug/seasons/$seasonSlug/matches/create')({
  component: CreateMatchPage,
});

function CreateMatchPage() {
  const { season } = useSeason();

  if (season.isClosed) {
    return <ClosedSeasonRedirect />;
  }

  return <MatchForm />;
}
```

**Step 5: Test match creation**

Try creating a match and verify form works.

**Step 6: Commit**

```bash
git add apps/frontend/src/routes/_authenticated/leagues/\$leagueSlug/seasons/\$seasonSlug/matches/
git commit -m "feat: migrate matches pages with creation form"
```

---

### Task 8: Migrate Players Pages

**Files:**
- Replace: `apps/frontend/src/routes/_authenticated/leagues/$leagueSlug/players/index.tsx`
- Replace: `apps/frontend/src/routes/_authenticated/leagues/$leagueSlug/players/$playerId.tsx`
- Copy components from: `apps/scorebrawl/src/app/(leagues)/leagues/[leagueSlug]/players/components/`

**Step 1: Copy player table components**

```bash
cp apps/scorebrawl/src/app/\(leagues\)/leagues/[leagueSlug]/players/components/leaguePlayersTable.tsx apps/frontend/src/components/league/
cp apps/scorebrawl/src/app/\(leagues\)/leagues/[leagueSlug]/players/components/leagueTeamsTable.tsx apps/frontend/src/components/league/
```

**Step 2: Update players index page**

```typescript
import { createFileRoute } from '@tanstack/react-router';
import { LeaguePlayersTable } from '@/components/league/leaguePlayersTable';
import { LeagueTeamsTable } from '@/components/league/leagueTeamsTable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export const Route = createFileRoute('/_authenticated/leagues/$leagueSlug/players/')({
  component: PlayersPage,
});

function PlayersPage() {
  const { leagueSlug } = Route.useParams();

  return (
    <Tabs defaultValue="players">
      <TabsList>
        <TabsTrigger value="players">Players</TabsTrigger>
        <TabsTrigger value="teams">Teams</TabsTrigger>
      </TabsList>
      <TabsContent value="players">
        <LeaguePlayersTable leagueSlug={leagueSlug} />
      </TabsContent>
      <TabsContent value="teams">
        <LeagueTeamsTable leagueSlug={leagueSlug} />
      </TabsContent>
    </Tabs>
  );
}
```

**Step 3: Update player detail page**

Copy and convert player detail page from Next.js app.

**Step 4: Test pages**

Visit players page and player detail page to verify they work.

**Step 5: Commit**

```bash
git add apps/frontend/src/routes/_authenticated/leagues/\$leagueSlug/players/
git commit -m "feat: migrate players pages with tables"
```

---

### Task 9: Migrate Members and Invites Pages (Editor Only)

**Files:**
- Replace: `apps/frontend/src/routes/_authenticated/leagues/$leagueSlug/members.tsx`
- Replace: `apps/frontend/src/routes/_authenticated/leagues/$leagueSlug/invites.tsx`
- Copy components from: `apps/scorebrawl/src/app/(leagues)/leagues/[leagueSlug]/members/components/`
- Copy components from: `apps/scorebrawl/src/app/(leagues)/leagues/[leagueSlug]/invites/components/`

**Step 1: Copy member components**

```bash
cp apps/scorebrawl/src/app/\(leagues\)/leagues/[leagueSlug]/members/components/MemberTable.tsx apps/frontend/src/components/league/
```

**Step 2: Update members page**

```typescript
import { createFileRoute } from '@tanstack/react-router';
import { MemberTable } from '@/components/league/MemberTable';

export const Route = createFileRoute('/_authenticated/leagues/$leagueSlug/members')({
  component: MembersPage,
});

function MembersPage() {
  const { leagueSlug } = Route.useParams();

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Members</h1>
      <MemberTable leagueSlug={leagueSlug} />
    </div>
  );
}
```

**Step 3: Copy invite components**

```bash
mkdir -p apps/frontend/src/components/league/invites
cp apps/scorebrawl/src/app/\(leagues\)/leagues/[leagueSlug]/invites/components/* apps/frontend/src/components/league/invites/
```

**Step 4: Update invites page**

```typescript
import { createFileRoute } from '@tanstack/react-router';
import { InviteTable } from '@/components/league/invites/InviteTable';
import { InviteDialog } from '@/components/league/invites/InviteDialog';

export const Route = createFileRoute('/_authenticated/leagues/$leagueSlug/invites')({
  component: InvitesPage,
});

function InvitesPage() {
  const { leagueSlug } = Route.useParams();

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Invites</h1>
        <InviteDialog leagueSlug={leagueSlug} />
      </div>
      <InviteTable leagueSlug={leagueSlug} />
    </div>
  );
}
```

**Step 5: Test pages**

Visit members and invites pages to verify they work.

**Step 6: Commit**

```bash
git add apps/frontend/src/routes/_authenticated/leagues/\$leagueSlug/members.tsx apps/frontend/src/routes/_authenticated/leagues/\$leagueSlug/invites.tsx
git commit -m "feat: migrate members and invites pages"
```

---

### Task 10: Migrate Settings Page

**Files:**
- Replace: `apps/frontend/src/routes/_authenticated/leagues/$leagueSlug/settings.tsx`
- Copy: `apps/scorebrawl/src/app/(leagues)/leagues/[leagueSlug]/settings/components/LeagueSettings.tsx`

**Step 1: Copy LeagueSettings component**

```bash
cp apps/scorebrawl/src/app/\(leagues\)/leagues/[leagueSlug]/settings/components/LeagueSettings.tsx apps/frontend/src/components/league/
```

**Step 2: Update settings page**

```typescript
import { createFileRoute } from '@tanstack/react-router';
import { LeagueSettings } from '@/components/league/LeagueSettings';

export const Route = createFileRoute('/_authenticated/leagues/$leagueSlug/settings')({
  component: SettingsPage,
});

function SettingsPage() {
  const { leagueSlug } = Route.useParams();

  return <LeagueSettings leagueSlug={leagueSlug} />;
}
```

**Step 3: Test settings page**

Visit settings page and try updating league settings.

**Step 4: Commit**

```bash
git add apps/frontend/src/routes/_authenticated/leagues/\$leagueSlug/settings.tsx
git commit -m "feat: migrate league settings page"
```

---

## Phase 3: Profile and Onboarding

### Task 11: Migrate Profile Page

**Files:**
- Replace: `apps/frontend/src/routes/_authenticated/profile.tsx`
- Copy components from: `apps/scorebrawl/src/app/(leagues)/profile/components/`

**Step 1: Copy profile components**

```bash
mkdir -p apps/frontend/src/components/profile
cp apps/scorebrawl/src/app/\(leagues\)/profile/components/* apps/frontend/src/components/profile/
```

**Step 2: Update profile page**

```typescript
import { createFileRoute } from '@tanstack/react-router';
import { UserInfo } from '@/components/profile/user-info';
import { LinkedAccounts } from '@/components/profile/linked-accounts';
import { Passkeys } from '@/components/profile/passkeys';
import { LeagueList } from '@/components/profile/league-list';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export const Route = createFileRoute('/_authenticated/profile')({
  component: ProfilePage,
});

function ProfilePage() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Profile</h1>
      <Tabs defaultValue="account">
        <TabsList>
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="leagues">Leagues</TabsTrigger>
        </TabsList>
        <TabsContent value="account">
          <UserInfo />
        </TabsContent>
        <TabsContent value="security">
          <LinkedAccounts />
          <Passkeys />
        </TabsContent>
        <TabsContent value="leagues">
          <LeagueList />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

**Step 3: Test profile page**

Visit profile page and verify all tabs work.

**Step 4: Commit**

```bash
git add apps/frontend/src/routes/_authenticated/profile.tsx apps/frontend/src/components/profile/
git commit -m "feat: migrate profile page with all tabs"
```

---

### Task 12: Verify Onboarding Page

**Files:**
- Check: `apps/frontend/src/routes/_authenticated/onboarding.tsx`
- Compare with: `apps/scorebrawl/src/app/(onboarding)/onboarding/page.tsx`

**Step 1: Compare implementations**

Check if current onboarding page matches Next.js version.

**Step 2: Update if needed**

If differences found, copy missing components or logic.

**Step 3: Test onboarding flow**

Create new account and verify onboarding works.

**Step 4: Commit if changed**

```bash
git add apps/frontend/src/routes/_authenticated/onboarding.tsx
git commit -m "fix: update onboarding page to match Next.js version"
```

---

## Phase 4: Testing and Polish

### Task 13: Update Breadcrumbs

**Files:**
- Check: `apps/frontend/src/components/layout/breadcrumbs-header.tsx`
- Update to work with TanStack Router

**Step 1: Update breadcrumb component**

Ensure breadcrumbs component works with TanStack Router's location/navigation.

**Step 2: Add breadcrumbs to pages**

Add breadcrumb headers to key pages (season dashboard, matches, etc.).

**Step 3: Test navigation**

Click through breadcrumbs to verify navigation works.

**Step 4: Commit**

```bash
git add apps/frontend/src/components/layout/breadcrumbs-header.tsx
git commit -m "feat: update breadcrumbs for TanStack Router"
```

---

### Task 14: Fix Missing Components

**Step 1: Search for broken imports**

Run TypeScript check:
```bash
cd apps/frontend
bun run typecheck
```

**Step 2: Identify missing components**

Look for import errors and copy missing components from Next.js app.

**Step 3: Copy missing components**

For each missing component:
```bash
cp apps/scorebrawl/src/components/[component].tsx apps/frontend/src/components/[component].tsx
```

**Step 4: Convert Next.js specific code**

Update each copied component to work with TanStack Router.

**Step 5: Verify build**

```bash
bun run build
```

Expected: Build succeeds without errors

**Step 6: Commit**

```bash
git add .
git commit -m "fix: add missing components from Next.js app"
```

---

### Task 15: Test Full Navigation Flow

**Step 1: Test league navigation**

Start at home → click league → verify sidebar shows → click each nav item.

Expected: All pages load without errors.

**Step 2: Test season navigation**

Navigate to season → verify dashboard shows with charts → click matches → verify matches list shows.

**Step 3: Test create flows**

Try creating:
- New league
- New season
- New match

Verify all forms work and save data.

**Step 4: Test editor features**

As league owner, verify:
- Members page shows
- Invites page works
- Settings page allows changes

**Step 5: Document issues**

Create list of any broken features found during testing.

**Step 6: Commit fixes**

```bash
git add .
git commit -m "fix: resolve navigation and feature issues found in testing"
```

---

## Implementation Notes

### Key Differences: Next.js → TanStack Router

**Routing:**
- Next.js: `(group)` folders, `page.tsx` files
- TanStack Router: `_layout.tsx` or `route.tsx` files, file-based paths

**Layouts:**
- Next.js: `layout.tsx` wraps children automatically
- TanStack Router: Layouts use `<Outlet />` and underscore prefix (`_authenticated.tsx`)

**Data Fetching:**
- Next.js: Server Components, async `await`
- TanStack Router: Client-side tRPC hooks (`useQuery`, `useMutation`)

**Navigation:**
- Next.js: `<Link href>`, `router.push()`
- TanStack Router: `<Link to>`, `navigate({ to })`

**Params:**
- Next.js: `params` as Promise in async components
- TanStack Router: `useParams()` hook or `Route.useParams()`

**Metadata:**
- Next.js: `generateMetadata()` function
- TanStack Router: Use `<Helmet>` or custom head management

### Common Conversion Patterns

**Server Component → Client Component:**

```typescript
// Before (Next.js Server Component)
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await api.something.get({ slug });
  return <div>{data.name}</div>;
}

// After (TanStack Router)
import { createFileRoute } from '@tanstack/react-router';
import { trpc } from '@/lib/trpc';

export const Route = createFileRoute('/path/$slug')({
  component: Page,
});

function Page() {
  const { slug } = Route.useParams();
  const { data } = trpc.something.get.useQuery({ slug });

  if (!data) return <div>Loading...</div>;

  return <div>{data.name}</div>;
}
```

**Next.js Link → TanStack Router Link:**

```typescript
// Before
<Link href={`/leagues/${leagueSlug}`}>View League</Link>

// After
<Link to="/leagues/$leagueSlug" params={{ leagueSlug }}>View League</Link>
```

**Next.js useRouter → TanStack Router useNavigate:**

```typescript
// Before
import { useRouter } from 'next/navigation';
const router = useRouter();
router.push('/some-path');

// After
import { useNavigate } from '@tanstack/react-router';
const navigate = useNavigate();
navigate({ to: '/some-path' });
```

**Next.js Image → Regular img:**

```typescript
// Before
<Image src={logoUrl} alt="Logo" width={40} height={40} />

// After
<img src={logoUrl} alt="Logo" className="w-10 h-10" />
```

---

## Testing Commands

```bash
# Type checking
cd apps/frontend && bun run typecheck

# Development server
bun run dev

# Build production
bun run build

# Lint
bun run flint
```

## Success Criteria

- [ ] All pages from Next.js app migrated to TanStack Router
- [ ] Sidebar navigation works with league switching
- [ ] Season dashboard shows charts and standings
- [ ] Match creation form works
- [ ] Players, members, invites pages display correctly
- [ ] Settings page allows updating league info
- [ ] Profile page shows user info and security settings
- [ ] Onboarding flow completes successfully
- [ ] No TypeScript errors
- [ ] Build succeeds
- [ ] All navigation flows work end-to-end
