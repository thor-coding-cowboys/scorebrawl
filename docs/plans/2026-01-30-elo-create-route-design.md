# ELO Match Creation Route Migration

**Date:** 2026-01-30
**Status:** 🎨 Design Approved
**Type:** Feature Migration

## Summary

Migrate the ELO match creation route from Next.js app to TanStack Router app, creating the `/leagues/$leagueSlug/seasons/$seasonSlug/matches/elo-create` route to match the existing Next.js URL structure.

## Problem

The `AddMatchButton` component navigates to `/matches/elo-create`, but this route doesn't exist in the TanStack Router app, resulting in a 404 error. The existing `/matches/create` route exists but uses a different URL pattern.

## Design Decision

**Approach:** Create the `/matches/elo-create` route to maintain URL consistency with the Next.js app during migration.

**Alternative considered:** Update button to use existing `/matches/create` route
- **Rejected because:** Maintaining URL consistency during migration period is more important; simplification can happen post-migration.

## Architecture

### Route Structure

**New file:**
```
apps/frontend/src/routes/_authenticated/_withSidebar/leagues/$leagueSlug/seasons/$seasonSlug/matches/elo-create.tsx
```

**Route responsibilities:**
1. Validate season is open (redirect if closed)
2. Display breadcrumbs for navigation context
3. Render the MatchForm component
4. Show standings and latest matches for context

### Component Reuse

All required components are already migrated:
- ✅ `BreadcrumbsHeader` - Navigation breadcrumbs
- ✅ `MatchForm` - Complete ELO match creation form
- ✅ `ClosedSeasonRedirect` - Handles closed season state
- ✅ `StandingTabs` - Displays player/team standings
- ✅ `LatestMatches` - Shows recent match history
- ✅ `useSeason` - Context hook for season data

### Page Layout

```
┌─────────────────────────────────────┐
│ Breadcrumbs Header                  │
├─────────────────────────────────────┤
│                                     │
│ Match Creation Form                 │
│ - Score steppers (Home/Away)        │
│ - Team selection cards              │
│ - Player drawer with shuffle/even   │
│                                     │
├──────────────────┬──────────────────┤
│ StandingTabs     │ LatestMatches    │
│ - Player/Team    │ - Recent matches │
│ - Sortable       │ - Empty state    │
└──────────────────┴──────────────────┘
```

**Responsive behavior:**
- Desktop (lg+): Two-column grid for standings and matches
- Mobile: Stacked layout

### Data Flow

1. Route params (leagueSlug, seasonSlug) extracted from URL
2. `useSeason()` hook provides season context
3. Check `season.closed` → redirect if true
4. MatchForm handles:
   - Fetching season players
   - Team selection state management
   - Match submission via `trpc.match.createEloMatch`
   - Query invalidation on success
5. StandingTabs and LatestMatches auto-update on successful match creation

### Error Handling

**Closed season:**
- Displays toast notification
- Redirects to league dashboard
- Handled by `ClosedSeasonRedirect` component

**Form validation:**
- Minimum 1 player per team (Zod schema)
- Score must be ≥ 0
- Handled by MatchForm internally

**API errors:**
- Toast notification with error message
- Form remains populated for retry
- Handled by MatchForm's mutation error callback

## Implementation Details

### Breadcrumbs Structure
```tsx
[
  { name: "Seasons", href: `/leagues/${leagueSlug}/seasons` },
  { name: season.name, href: `/leagues/${leagueSlug}/seasons/${seasonSlug}` },
  { name: "Matches", href: `/leagues/${leagueSlug}/seasons/${seasonSlug}/matches` },
  { name: "Create" },
]
```

### Component Structure
```tsx
function EloCreateMatchPage() {
  const { leagueSlug, seasonSlug } = Route.useParams();
  const { season } = useSeason();

  if (season?.closed) {
    return <ClosedSeasonRedirect leagueSlug={leagueSlug} />;
  }

  return (
    <>
      <BreadcrumbsHeader breadcrumbs={[...]} />
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

## Benefits

**User Experience:**
1. Immediate context - see standings and recent matches while creating
2. Clear navigation - breadcrumbs show location
3. Visual feedback - matches appear in "Latest Matches" on creation
4. Prevents errors - closed season check before render

**Developer Experience:**
1. Zero new components needed - all already migrated
2. Consistent URL structure with Next.js app
3. Clean separation of concerns - route handles layout, form handles logic
4. Type-safe routing with TanStack Router

## Testing Plan

### Manual Testing
1. Navigate to season dashboard
2. Click "Add Match" button
3. Verify redirect to `/leagues/{slug}/seasons/{slug}/matches/elo-create`
4. Verify breadcrumbs display correctly
5. Create a match with players
6. Verify match appears in "Latest Matches"
7. Verify standings update
8. Test closed season redirect

### Automated Testing (agent-browser)

**Test Date:** 2026-01-30

**Test Results:** ✅ PASSED

1. ✅ Sign in with test credentials - Successful
2. ✅ Navigate to `/leagues/test-1/seasons/asdf-1/matches/elo-create` - No 404 error
3. ✅ Verify page renders - Page title: "Scorebrawl"
4. ✅ Verify all components visible:
   - Breadcrumbs: "Seasons > asdf > Matches > Create" ✅
   - Match creation form with score steppers (Home/Away) ✅
   - "Add Players" button ✅
   - "Create" button ✅
   - StandingTabs component with Individual/Team tabs ✅
   - LatestMatches component with "No registered matches" state ✅
5. ✅ Screenshot saved: `elo-create-route.png`

**Component Verification:**
- MatchForm: Renders with score controls (0-0), team cards, "Add Players" button
- BreadcrumbsHeader: All 4 breadcrumb levels present and linkable
- StandingTabs: Shows Individual/Team tabs, displays player standings table
- LatestMatches: Shows "Latest Matches" heading with empty state message
- Season warning: "Season is not active" displayed correctly

**Layout Verification:**
- Responsive grid: Two-column layout for StandingTabs and LatestMatches confirmed
- All interactive elements accessible and properly labeled
- No console errors or visual issues

**Test credentials:**
- Email: `palmithor@gmail.com`
- Password: `Test.1234`

## Future Considerations

**Post-migration cleanup:**
- Consider consolidating `/matches/create` and `/matches/elo-create` routes
- Evaluate if "elo-create" naming is necessary (vs just "create")
- May want to add fixture/non-ELO match creation routes

**Enhancements:**
- Add match history chart
- Add player performance metrics
- Add team balancing suggestions based on recent performance

## References

- Next.js route: `apps/scorebrawl/src/app/(leagues)/leagues/[leagueSlug]/seasons/[seasonSlug]/matches/elo-create/page.tsx`
- Migration docs: `docs/plans/2026-01-14-complete-migration.md`
- Routing fix: `docs/plans/2026-01-15-completed-routing-migration.md`
