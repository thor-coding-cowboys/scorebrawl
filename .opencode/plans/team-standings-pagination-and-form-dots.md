# Team Standings Pagination & Form Dots Implementation Plan

**Date:** February 8, 2026  
**Project:** Scorebrawl  
**Estimated Time:** 40 minutes (30 min implementation + 10 min testing)

---

## Overview

This plan addresses two related improvements to the Scorebrawl season dashboard:

1. **Team Standings Pagination** - Move pagination controls from footer to header to maintain consistent card height with Player Standings
2. **Form Dots in Dashboard Cards** - Complete incomplete implementation by fixing TypeScript errors and adding minimum match requirement

---

## User Requirements

### Team Standings Pagination

- ✅ Move pagination arrows to card header (like "View All" in Latest Matches)
- ✅ Remove "Showing X-Y of Z" text completely
- ✅ Match button style with existing patterns (outline Button, not GlowButton)
- ✅ Empty header when pagination not needed
- ✅ Cards must have equal height (Player Standings vs Team Standings)

### Form Dots

- ✅ Complete Option A: Fix TypeScript errors and display form dots
- ✅ Show glowing form dots (green/amber/red with shadow effects)
- ✅ Struggling player must have minimum 5 matches
- ✅ Show nothing when form data is empty or undefined
- ✅ Already created shared `FormDots` component at `apps/web/src/components/ui/form-dots.tsx`
- ✅ Already updated backend `getTopPlayer` to return form data

---

## Problem Analysis

### Current Issues

**Team Standings Pagination:**

```
┌─────────────────────┐  ┌─────────────────────────┐
│ Standings           │  │ Team Standings          │
├─────────────────────┤  ├─────────────────────────┤
│ Player 1            │  │ Team 1 👤👤            │
│ Player 2            │  │ Team 2 👤👤            │
│ Player 3            │  │ Team 3 👤👤            │
│ Player 4            │  │ Team 4 👤👤            │
└─────────────────────┘  ├─────────────────────────┤
                         │ Showing 1-4 of 6    ◀ ▶│ ← EXTRA HEIGHT
                         └─────────────────────────┘
   MISALIGNED ❌
```

**Form Dots:**

- TypeScript errors: `Property 'form' does not exist on type`
- `StrugglingCard` uses `getAll` query which doesn't return form data
- Need to filter players with minimum 5 matches
- Missing double-check for empty form arrays

---

## Expected Results

### Team Standings After Fix

```
┌─────────────────────┐  ┌──────────────────────◀ ▶┐
│ Standings           │  │ Team Standings           │
├─────────────────────┤  ├─────────────────────────┤
│ Player 1            │  │ Team 1 👤👤            │
│ Player 2            │  │ Team 2 👤👤            │
│ Player 3            │  │ Team 3 👤👤            │
│ Player 4            │  │ Team 4 👤👤            │
└─────────────────────┘  └─────────────────────────┘
   SAME HEIGHT ✅          ARROWS IN HEADER ✅
```

When no pagination needed:

```
┌─────────────────────────┐
│ Team Standings          │  ← No arrows, empty header
├─────────────────────────┤
│ Team 1 👤👤            │
│ Team 2 👤👤            │
│ Team 3 👤👤            │
└─────────────────────────┘
```

### Form Dots After Fix

```
Dashboard Cards:
┌──────────────────┐
│ 🔥 On Fire       │
├──────────────────┤
│ 👤 Pálmi        │
│    1439 pts      │
│    ●●●●● ← Glowing form dots (5 wins)
└──────────────────┘

┌──────────────────┐
│ ❄️ Struggling    │
├──────────────────┤
│ 👤 Jane         │
│    1000 pts      │
│    ●●●●● ← Glowing form dots (recent results)
└──────────────────┘
```

---

## Implementation Details

## Part 1: Team Standings Pagination

### File 1: `apps/web/src/components/season/team-standing-card.tsx`

**COMPLETE NEW CODE:**

```tsx
import { OverviewCard } from "./overview-card";
import { TeamStanding } from "./team-standing";
import { useStandings, useTeamStandings } from "@/lib/collections";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";

interface TeamStandingCardProps {
	seasonId: string;
	seasonSlug: string;
}

export function TeamStandingCard({ seasonId, seasonSlug }: TeamStandingCardProps) {
	const { standings } = useStandings(seasonId, seasonSlug);
	const { teamStandings } = useTeamStandings(seasonId, seasonSlug);
	const [currentPage, setCurrentPage] = useState(0);

	const maxRows = standings.length;
	const totalPages = Math.ceil(teamStandings.length / (maxRows || 1));
	const showPagination = maxRows && totalPages > 1;

	return (
		<OverviewCard
			title="Team Standings"
			className="h-full"
			action={
				showPagination ? (
					<div className="flex gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
							disabled={currentPage === 0}
						>
							<HugeiconsIcon icon={ArrowLeft01Icon} className="h-4 w-4" />
						</Button>
						<Button
							variant="outline"
							size="sm"
							onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
							disabled={currentPage === totalPages - 1}
						>
							<HugeiconsIcon icon={ArrowRight01Icon} className="h-4 w-4" />
						</Button>
					</div>
				) : undefined
			}
		>
			<TeamStanding
				seasonId={seasonId}
				seasonSlug={seasonSlug}
				maxRows={maxRows}
				currentPage={currentPage}
				onPageChange={setCurrentPage}
			/>
		</OverviewCard>
	);
}
```

**Key Changes:**

1. Added imports: `useState`, `Button`, icons, `useTeamStandings`
2. Added `currentPage` state
3. Calculate `totalPages` and `showPagination`
4. Added `action` prop with pagination buttons (only when needed)
5. Pass `currentPage` and `onPageChange` to child component

---

### File 2: `apps/web/src/components/season/team-standing.tsx`

**CHANGES TO MAKE:**

#### Step 1: Update Interface (around line 16)

**FIND:**

```tsx
interface TeamStandingProps {
	seasonId: string;
	seasonSlug: string;
	maxRows?: number;
}
```

**REPLACE WITH:**

```tsx
interface TeamStandingProps {
	seasonId: string;
	seasonSlug: string;
	maxRows?: number;
	currentPage?: number;
	onPageChange?: (page: number) => void;
}
```

#### Step 2: Update Component Signature (around line 52)

**FIND:**

```tsx
export function TeamStanding({ seasonId, seasonSlug, maxRows }: TeamStandingProps) {
	const { teamStandings } = useTeamStandings(seasonId, seasonSlug);
	const [currentPage, setCurrentPage] = useState(0);
```

**REPLACE WITH:**

```tsx
export function TeamStanding({
	seasonId,
	seasonSlug,
	maxRows,
	currentPage: externalPage = 0,
	onPageChange
}: TeamStandingProps) {
	const { teamStandings } = useTeamStandings(seasonId, seasonSlug);
	const [internalPage, setInternalPage] = useState(0);

	// Use external page if controlled, otherwise use internal state
	const currentPage = onPageChange ? externalPage : internalPage;
```

**NOTE:** This implements controlled/uncontrolled pattern. Parent can control pagination or component manages its own state.

#### Step 3: Remove Pagination Footer (around lines 136-159)

**DELETE THIS ENTIRE BLOCK:**

```tsx
			{showPagination && (
				<div className="flex items-center justify-between">
					<div className="text-sm text-muted-foreground">
						Showing {startIndex + 1}-{Math.min(endIndex, sortedData.length)} of {sortedData.length}
					</div>
					<div className="flex gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
							disabled={currentPage === 0}
						>
							<HugeiconsIcon icon={ArrowLeft01Icon} className="h-4 w-4" />
						</Button>
						<Button
							variant="outline"
							size="sm"
							onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
							disabled={currentPage === totalPages - 1}
						>
							<HugeiconsIcon icon={ArrowRight01Icon} className="h-4 w-4" />
						</Button>
					</div>
				</div>
			)}
```

**FINAL RETURN SHOULD LOOK LIKE:**

```tsx
	return (
		<div className="space-y-4">
			<div className="rounded-md">
				<Table>
					{/* existing table code - NO CHANGES */}
				</Table>
			</div>
			{/* NO pagination footer anymore */}
		</div>
	);
}
```

#### Step 4: Clean Up Unused Imports

**IF** Button, HugeiconsIcon, ArrowLeft01Icon, ArrowRight01Icon are no longer used in this file, remove them from imports.

---

## Part 2: Form Dots in Dashboard Cards

### File 3: `apps/web/src/components/season/dashboard-cards.tsx`

#### Change 1: Update StrugglingCard Function (around line 40)

**FIND:**

```tsx
function StrugglingCard({ seasonSlug }: { seasonSlug: string }) {
	const trpc = useTRPC();
	const { data: allPlayers } = useQuery(trpc.seasonPlayer.getAll.queryOptions({ seasonSlug }));

	// Get lowest scoring player as "struggling"
	const strugglingPlayer = allPlayers?.length
		? [...allPlayers].sort((a, b) => a.score - b.score)[0]
		: null;

	return (
		<DashboardCard
			title="Struggling"
			icon={SnowIcon}
			glowColor="bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.1),transparent_60%)]"
			iconColor="text-blue-600"
		>
			{!allPlayers ? (
				<Skeleton className="h-12 w-full" />
			) : strugglingPlayer ? (
				<div className="flex items-center gap-3 min-w-0">
					<AvatarWithFallback src={strugglingPlayer.image} name={strugglingPlayer.name} size="md" />
					<div className="flex flex-col min-w-0 flex-1">
						<span className="text-sm font-medium truncate">{strugglingPlayer.name}</span>
						<span className="text-xs text-muted-foreground">{strugglingPlayer.score} points</span>
					</div>
					{strugglingPlayer.form && <FormDots form={strugglingPlayer.form} />}
				</div>
			) : (
				<div className="text-sm text-muted-foreground">No players</div>
			)}
		</DashboardCard>
	);
}
```

**REPLACE WITH:**

```tsx
function StrugglingCard({ seasonSlug }: { seasonSlug: string }) {
	const trpc = useTRPC();
	const { data: standings } = useQuery(trpc.seasonPlayer.getStanding.queryOptions({ seasonSlug }));

	// Filter players with minimum 5 matches, then get lowest score
	const strugglingPlayer = standings?.length
		? standings
			.filter(player => player.matchCount >= 5)
			.sort((a, b) => a.score - b.score)[0] || null
		: null;

	return (
		<DashboardCard
			title="Struggling"
			icon={SnowIcon}
			glowColor="bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.1),transparent_60%)]"
			iconColor="text-blue-600"
		>
			{!standings ? (
				<Skeleton className="h-12 w-full" />
			) : strugglingPlayer ? (
				<div className="flex items-center gap-3 min-w-0">
					<AvatarWithFallback src={strugglingPlayer.image} name={strugglingPlayer.name} size="md" />
					<div className="flex flex-col min-w-0 flex-1">
						<span className="text-sm font-medium truncate">{strugglingPlayer.name}</span>
						<span className="text-xs text-muted-foreground">{strugglingPlayer.score} points</span>
					</div>
					{strugglingPlayer.form && strugglingPlayer.form.length > 0 && (
						<FormDots form={strugglingPlayer.form} />
					)}
				</div>
			) : (
				<div className="text-sm text-muted-foreground">No players with 5+ matches</div>
			)}
		</DashboardCard>
	);
}
```

**Key Changes:**

1. Changed query from `getAll` → `getStanding`
2. Added filter: `.filter(player => player.matchCount >= 5)`
3. Changed variable: `allPlayers` → `standings`
4. Added double-check for form: `form && form.length > 0`
5. Updated empty state message to "No players with 5+ matches"

#### Change 2: Update OnFireCard Form Dots (around line 27-32)

**FIND:**

```tsx
					{data.form && <FormDots form={data.form} />}
```

**REPLACE WITH:**

```tsx
					{data.form && data.form.length > 0 && (
						<FormDots form={data.form} />
					)}
```

**Key Change:** Added double-check for `form.length > 0` to prevent rendering empty dots.

---

## Testing Checklist

### Phase 1: Code Quality

- [ ] Run `bun typecheck` - **MUST PASS** with no errors
  - Verify no `Property 'form' does not exist` errors
  - All imports resolve correctly
- [ ] Run `bun oxc` - **MUST PASS** with no warnings
  - Linting should be clean
- [ ] Run `bun test` - **MUST PASS** all tests
  - Existing team standings integration tests should pass
  - No regressions in other test suites

### Phase 2: Team Standings Pagination

**Test Case 1: Few Teams (No Pagination)**

- [ ] Create season with 4 players and 2 teams
- [ ] Verify: No pagination arrows in Team Standings header
- [ ] Verify: Player Standings and Team Standings have equal height
- [ ] Verify: Header is clean with just "Team Standings" title

**Test Case 2: Many Teams (Pagination Required)**

- [ ] Create season with 4 players and 8 teams (2 pages needed)
- [ ] Verify: Pagination arrows appear in Team Standings header
- [ ] Verify: Left arrow is disabled on page 1
- [ ] Click right arrow
- [ ] Verify: Page changes, left arrow becomes enabled
- [ ] Verify: Right arrow is disabled on last page
- [ ] Click left arrow
- [ ] Verify: Returns to page 1
- [ ] Verify: Player Standings and Team Standings still have equal height

**Test Case 3: Responsive Design**

- [ ] Test on mobile viewport (< 768px)
- [ ] Verify: Pagination arrows are still visible and functional
- [ ] Verify: Arrows don't overflow or break layout

**Test Case 4: Edge Cases**

- [ ] Test with 0 teams: Should show "No team standings"
- [ ] Test with exactly maxRows teams: Should NOT show pagination
- [ ] Test with maxRows + 1 teams: Should show pagination

### Phase 3: Form Dots Display

**Test Case 1: On Fire Card**

- [ ] Verify form dots appear with glowing colors
- [ ] Green dots for wins (W) with `shadow-[0_0_8px_rgba(34,197,94,0.6)]`
- [ ] Amber dots for draws (D) with `shadow-[0_0_8px_rgba(245,158,11,0.6)]`
- [ ] Red dots for losses (L) with `shadow-[0_0_8px_rgba(239,68,68,0.6)]`
- [ ] Maximum 5 dots displayed
- [ ] No dots when player has 0 matches

**Test Case 2: Struggling Card - With Qualified Player**

- [ ] Create season with player who has 5+ matches and lowest score
- [ ] Verify: Player appears in Struggling card
- [ ] Verify: Form dots appear with glowing colors
- [ ] Verify: Dots match recent match results

**Test Case 3: Struggling Card - No Qualified Player**

- [ ] Create season where all players have < 5 matches
- [ ] Verify: Struggling card shows "No players with 5+ matches"
- [ ] Verify: No avatar or form dots displayed

**Test Case 4: Struggling Card - Empty Season**

- [ ] Create season with 0 matches
- [ ] Verify: Shows "No players with 5+ matches"

**Test Case 5: Form Dots - Various States**

- [ ] Player with 5 wins: 5 green dots
- [ ] Player with 3W, 1D, 1L: Mixed colored dots in order
- [ ] Player with undefined form: No dots
- [ ] Player with empty form array: No dots

### Phase 4: Visual Regression Testing

- [ ] Take screenshots of all states
- [ ] Compare with `/Users/palmithor/Desktop/Screenshot 2026-02-08 at 20.57.51.png`
- [ ] Verify alignment is now correct
- [ ] Verify no layout shifts or jank

---

## Edge Cases & Error Handling

### Team Standings Pagination

| Scenario                   | Expected Behavior             | Handled By                      |
| -------------------------- | ----------------------------- | ------------------------------- |
| Division by zero (0 teams) | No crash, no pagination       | `maxRows \|\| 1`                |
| Undefined maxRows          | Defaults to showing all teams | Default parameter handling      |
| currentPage out of bounds  | Clamped by Math.max/Math.min  | Button disabled states          |
| Controlled vs uncontrolled | Works in both modes           | Controlled/uncontrolled pattern |

### Form Dots

| Scenario                | Expected Behavior            | Handled By                          |
| ----------------------- | ---------------------------- | ----------------------------------- |
| Player with 0 matches   | No form dots                 | `form.length > 0` check             |
| Player with 4 matches   | Not in Struggling card       | `matchCount >= 5` filter            |
| Undefined form          | No crash, no dots            | `form &&` check                     |
| Empty form array        | No dots                      | `form.length > 0` check             |
| All players < 5 matches | "No players with 5+ matches" | Filter returns empty, null fallback |

---

## Files Modified Summary

| File Path                                               | Changes                           | Lines Added | Lines Removed |
| ------------------------------------------------------- | --------------------------------- | ----------- | ------------- |
| `apps/web/src/components/season/team-standing-card.tsx` | Add pagination state & header     | +30         | -10           |
| `apps/web/src/components/season/team-standing.tsx`      | Remove footer, controlled props   | +10         | -25           |
| `apps/web/src/components/season/dashboard-cards.tsx`    | Fix form dots, add 5-match filter | +15         | -10           |
| **TOTAL**                                               |                                   | **~55**     | **~45**       |

**Net change:** ~10 lines added

---

## Pre-existing Work Completed

These tasks were already completed in the previous conversation:

✅ **Backend:**

- Created `apps/web/src/components/ui/form-dots.tsx` with glowing colors
- Updated `getTopPlayer` repository to return form data
- Updated `standing.tsx` to use shared FormDots component
- Updated `team-standing.tsx` to use shared FormDots component

✅ **Team Standings Features:**

- Multi-avatar display in team standings (shows player avatars)
- Team standings separate card layout
- Integration tests for team creation/scoring

---

## Risk Assessment

### Low Risk ✅

- Form dots: Simple query change with proper null checks
- Pagination removal: Just deleting UI elements
- TypeScript: All types exist from backend

### Medium Risk ⚠️

- Controlled/uncontrolled pattern: Must handle both cases
- Struggling player filter: Could return empty if no players qualify

### Mitigation Strategies

- Use `|| null` fallback for filter results
- Test empty states thoroughly
- Keep internal state as fallback for backward compatibility
- Add console warnings for unexpected states during development

---

## Post-Implementation Verification

After completing implementation, verify with these specific checks:

### Visual Verification Checklist

1. **Card Height Alignment:**

   ```bash
   # Open dev tools, inspect both cards
   # Player Standings height === Team Standings height
   ```

2. **Pagination State Machine:**

   ```
   Page 1 (first): [◀️ disabled] [▶️ enabled]
   Page 2 (middle): [◀️ enabled] [▶️ enabled]
   Page N (last): [◀️ enabled] [▶️ disabled]
   ```

3. **Form Dots Glow Effect:**

   ```css
   /* Verify these shadows are applied */
   W: shadow-[0_0_8px_rgba(34,197,94,0.6)]   /* Green */
   D: shadow-[0_0_8px_rgba(245,158,11,0.6)]  /* Amber */
   L: shadow-[0_0_8px_rgba(239,68,68,0.6)]   /* Red */
   ```

4. **TypeScript Compilation:**

   ```bash
   # Should show 0 errors
   bun typecheck
   ```

5. **Screenshot Comparison:**
   - Take new screenshot of season dashboard
   - Compare side-by-side with original screenshot
   - Verify cards are now aligned

---

## Rollback Plan

If issues arise during implementation:

### Quick Rollback Steps

1. **Team Standings Only:**

   ```bash
   git checkout HEAD -- apps/web/src/components/season/team-standing-card.tsx
   git checkout HEAD -- apps/web/src/components/season/team-standing.tsx
   ```

2. **Form Dots Only:**

   ```bash
   git checkout HEAD -- apps/web/src/components/season/dashboard-cards.tsx
   ```

3. **Full Rollback:**
   ```bash
   git stash
   # Or if committed:
   git revert HEAD
   ```

### Partial Implementation Strategy

Can implement in stages if needed:

**Stage 1:** Team standings pagination only  
**Stage 2:** Form dots after testing Stage 1

This allows isolated testing and easier debugging.

---

## Additional Notes

### Why getStanding instead of getAll?

The `getAll` query returns basic player data without form:

```typescript
// getAll returns:
{ id, seasonId, playerId, score, disabled, createdAt, updatedAt, name, image, userId }

// getStanding returns:
{ id, seasonId, playerId, score, name, image, userId, matchCount, winCount, lossCount, drawCount, rank, pointDiff, form }
```

Using `getStanding` gives us access to:

- ✅ `form` array (last 5 match results)
- ✅ `matchCount` (for 5-match minimum filter)
- ✅ Win/loss/draw counts (for future use)

### Why Minimum 5 Matches?

User requirement: "minimum 5 matches in this season"

This prevents:

- New players dominating "struggling" after 1 bad match
- Statistical noise from small sample sizes
- Unfair comparison between players with vastly different match counts

---

## Success Criteria

Implementation is considered successful when:

✅ All TypeScript checks pass  
✅ All lint checks pass  
✅ All existing tests pass  
✅ Player Standings and Team Standings cards have equal height  
✅ Pagination arrows appear only when needed (>1 page)  
✅ Pagination arrows work correctly (change pages, disable appropriately)  
✅ Form dots display with glowing effects in dashboard cards  
✅ Struggling card requires 5+ matches  
✅ No form dots show when form is empty/undefined  
✅ No console errors or warnings  
✅ Responsive layout works on mobile

---

## Timeline

**Estimated Duration:** 40 minutes

| Phase | Task                          | Time   |
| ----- | ----------------------------- | ------ |
| 1     | Update team-standing-card.tsx | 10 min |
| 2     | Update team-standing.tsx      | 10 min |
| 3     | Update dashboard-cards.tsx    | 10 min |
| 4     | Testing & verification        | 10 min |

**Dependencies:**

- No external dependencies
- All required components/hooks already exist
- No database migrations needed
- No API changes needed

---

## Appendix A: Key Code Patterns

### Controlled/Uncontrolled Component Pattern

```tsx
function Component({
  externalValue = defaultValue,
  onChange
}: Props) {
  const [internalValue, setInternalValue] = useState(defaultValue);

  // Use external if controlled, otherwise internal
  const value = onChange ? externalValue : internalValue;
  const setValue = onChange || setInternalValue;

  // Use 'value' and 'setValue' throughout component
}
```

### Conditional Action Prop Pattern

```tsx
<OverviewCard
  title="Title"
  action={
    condition ? (
      <ActionComponent />
    ) : undefined  // undefined = empty header
  }
>
  {children}
</OverviewCard>
```

### Safe Form Dots Rendering

```tsx
{data.form && data.form.length > 0 && (
  <FormDots form={data.form} />
)}
```

---

## Appendix B: Reference Files

**View these files for context:**

- Pattern reference: `apps/web/src/components/season/latest-matches.tsx` (line 42-56)
- Card component: `apps/web/src/components/season/overview-card.tsx`
- Form dots: `apps/web/src/components/ui/form-dots.tsx`
- Repository: `apps/worker/src/repositories/season-player-repository.ts` (line 128-133)

---

## Document Version

**Version:** 1.0  
**Last Updated:** February 8, 2026  
**Status:** Ready for Implementation  
**Approved By:** User

---

END OF IMPLEMENTATION PLAN
