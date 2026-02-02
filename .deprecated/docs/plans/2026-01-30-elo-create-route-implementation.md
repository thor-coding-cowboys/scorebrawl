# ELO Match Creation Route Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create the `/leagues/$leagueSlug/seasons/$seasonSlug/matches/elo-create` route to fix 404 errors when clicking "Add Match" button.

**Architecture:** Single route file that composes existing migrated components (MatchForm, BreadcrumbsHeader, StandingTabs, LatestMatches) with closed season validation and responsive layout.

**Tech Stack:** TanStack Router v1.132.0, React 19.2.0, TypeScript 5.5.4, tRPC, shadcn/ui

---

## Task 1: Create ELO Match Creation Route

**Files:**
- Create: `apps/frontend/src/routes/_authenticated/_withSidebar/leagues/$leagueSlug/seasons/$seasonSlug/matches/elo-create.tsx`

**Step 1: Create the route file**

Create the file with the complete route implementation:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { MatchForm } from "@/components/match/MatchForm";
import { ClosedSeasonRedirect } from "@/components/match/ClosedSeasonRedirect";
import { BreadcrumbsHeader } from "@/components/layout/breadcrumbs-header";
import { StandingTabs } from "@/components/season/StandingTabs";
import { LatestMatches } from "@/components/season/LatestMatches";
import { useSeason } from "@/context/season-context";

export const Route = createFileRoute(
  "/_authenticated/_withSidebar/leagues/$leagueSlug/seasons/$seasonSlug/matches/elo-create"
)({
  component: EloCreateMatchPage,
});

function EloCreateMatchPage() {
  const { leagueSlug, seasonSlug, season } = useSeason();

  if (season?.closed) {
    return <ClosedSeasonRedirect leagueSlug={leagueSlug} />;
  }

  return (
    <>
      <BreadcrumbsHeader
        breadcrumbs={[
          { name: "Seasons", href: `/leagues/${leagueSlug}/seasons` },
          { name: season.name, href: `/leagues/${leagueSlug}/seasons/${seasonSlug}` },
          { name: "Matches", href: `/leagues/${leagueSlug}/seasons/${seasonSlug}/matches` },
          { name: "Create" },
        ]}
      />
      <div className="grid gap-6">
        <MatchForm leagueSlug={leagueSlug} seasonSlug={seasonSlug} />
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
          <StandingTabs />
          <LatestMatches />
        </div>
      </div>
    </>
  );
}
```

**Step 2: Verify TanStack Router picks up the route**

Run: `cd apps/frontend && bun run dev`

Expected: Server starts without errors, route tree regenerates automatically

**Step 3: Commit the route**

```bash
git add apps/frontend/src/routes/_authenticated/_withSidebar/leagues/\$leagueSlug/seasons/\$seasonSlug/matches/elo-create.tsx
git commit -m "feat: add ELO match creation route

- Create /matches/elo-create route matching Next.js structure
- Compose existing components: MatchForm, StandingTabs, LatestMatches
- Add breadcrumbs navigation for context
- Handle closed season redirect
- Responsive layout: 2-column desktop, stacked mobile

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Manual Verification

**Files:**
- None (testing only)

**Step 1: Start the development server**

Run: `cd apps/frontend && bun run dev`

Expected: Server running on http://localhost:3000

**Step 2: Sign in with test credentials**

Navigate to: http://localhost:3000/auth/sign-in

Credentials:
- Email: `palmithor@gmail.com`
- Password: `Test.1234`

Expected: Redirected to league dashboard

**Step 3: Navigate to season with matches**

Navigate to: http://localhost:3000/leagues/test-1/seasons/asdf-1

Expected: Season dashboard displays

**Step 4: Click "Add Match" button**

Click the "Add Match" button in the header

Expected:
- Redirects to `/leagues/test-1/seasons/asdf-1/matches/elo-create`
- No 404 error
- Page displays with:
  - Breadcrumbs: Seasons > Season Name > Matches > Create
  - Match creation form with score steppers
  - StandingTabs on left
  - LatestMatches on right

**Step 5: Verify responsive layout**

Resize browser window to mobile width

Expected:
- Layout stacks vertically
- Form, standings, and matches all visible
- No horizontal overflow

---

## Task 3: Automated Browser Testing

**Files:**
- None (testing only)

**Prerequisites:**
- Frontend dev server running on http://localhost:3000
- Backend dev server running on http://localhost:3001

**Step 1: Use agent-browser skill for automated verification**

Use: @agent-browser skill

Prompt:
```
Navigate to http://localhost:3000/auth/sign-in
Sign in with palmithor@gmail.com and password Test.1234
Navigate to /leagues/test-1/seasons/asdf-1/matches/elo-create
Verify page loads without 404
Take screenshot named elo-create-route.png
```

Expected: Screenshot showing successful page render with all components visible

**Step 2: Document test results**

Update: `docs/plans/2026-01-30-elo-create-route-design.md`

Add screenshot reference and test results to testing section.

**Step 3: Commit documentation update**

```bash
git add docs/plans/2026-01-30-elo-create-route-design.md
git commit -m "docs: add browser test results for elo-create route

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Code Review Checkpoint

**Files:**
- All files created/modified in this plan

**Step 1: Use code review skill**

Use: @superpowers:requesting-code-review

Verify:
- Route file follows TanStack Router conventions
- TypeScript types are correct
- Components are imported correctly
- Layout matches design specification
- Responsive classes are appropriate
- Breadcrumbs structure is correct

**Step 2: Address any review feedback**

If issues found, fix them and commit:

```bash
git add <modified-files>
git commit -m "fix: address code review feedback for elo-create route

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Verification Checklist

Before marking complete, verify:

- [ ] Route file created at correct path
- [ ] TanStack Router regenerates route tree without errors
- [ ] No 404 error when navigating to `/matches/elo-create`
- [ ] Breadcrumbs display correctly
- [ ] MatchForm renders and functions
- [ ] StandingTabs displays player/team standings
- [ ] LatestMatches displays recent matches
- [ ] Closed season redirect works
- [ ] Responsive layout works on mobile
- [ ] TypeScript compiles without errors
- [ ] All components properly imported
- [ ] Code review completed

---

## Success Criteria

**Functional:**
- Clicking "Add Match" button navigates to `/matches/elo-create` without 404
- All components render correctly
- Match creation works end-to-end
- Standings and matches update after creation
- Closed season validation prevents match creation

**Technical:**
- TypeScript types are correct
- No console errors or warnings
- Route follows TanStack Router conventions
- Responsive layout works on all screen sizes
- Code is clean and maintainable

---

## References

- Design doc: `docs/plans/2026-01-30-elo-create-route-design.md`
- TanStack Router docs: https://tanstack.com/router/latest
- Migration docs: `docs/plans/2026-01-14-complete-migration.md`
- Next.js reference: `apps/scorebrawl/src/app/(leagues)/leagues/[leagueSlug]/seasons/[seasonSlug]/matches/elo-create/page.tsx`
