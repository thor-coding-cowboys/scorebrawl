# Player Comparison Page Enhancement

**Date:** 2025-01-16  
**Topic:** Player Compare Page with Query Parameters & Dual Selection Drawer

## Summary

Refactor the player comparison page to use URL query parameters for player IDs and implement a dual-column player selection drawer similar to match creation.

## Current State

- Player 1 is hardcoded to the first player in the list
- Only player 2 can be changed via a simple single-column drawer
- No URL query parameters - selections aren't shareable
- No way to change player 1

## Proposed Changes

### 1. URL Structure

**Route:** `/leagues/$slug/players/compare?p1=xxx&p2=yyy`

- Both player IDs stored as query parameters using TanStack Router's `validateSearch`
- Schema: `z.object({ p1: z.string().optional(), p2: z.string().optional() })`
- Initial state: if no params, both players show "Select Player" empty state
- Shareable URLs - can link directly to a specific player comparison
- URL updates immediately when selections change via `navigate()`

### 2. Player Selection Drawer

**Layout:** Two-column bottom drawer (max-h-[85vh], max-w-xl centered)

**Columns:**

- Left: "Player 1" header (blue themed)
- Right: "Player 2" header (rose themed)

**Player List Items:**

- All players appear in both columns
- Visual states per column:
  - **Selected for this column:** bg-primary/10, left border (blue for P1, rose for P2), checkmark icon
  - **Selected for other column:** opacity-40, line-through (disabled appearance)
  - **Unselected:** hover:bg-muted/50

**Interaction:**

- Click player in P1 column → assigns to P1 (or unassigns if already P1)
- Click player in P2 column → assigns to P2 (or unassigns if already P2)
- Same player cannot occupy both positions (automatic prevention)
- If player is P2 and clicked in P1 column → moves them to P1, clears P2

**Footer:**

- "Done" button (GlowButton with blue glow) to close drawer

### 3. Page Layout Updates

**Player Selector Header Card:**

- Both player cards clickable to open drawer
- Clicking P1 card opens drawer, could highlight P1 column
- Clicking P2 card opens drawer, could highlight P2 column
- Empty state cards show:
  - Avatar placeholder with "?"
  - "Select Player 1" / "Select Player 2" text
  - Dashed border styling

**Comparison Cards (below header):**

- Remain largely unchanged
- Show player data when both selected
- Show waiting states when not selected

**Charts & Stats:**

- Only render when both players have valid IDs
- Query enabled only when both IDs present and different

### 4. State Management

**URL State (via TanStack Router):**

```typescript
const compareSearchSchema = z.object({
	p1: z.string().optional(),
	p2: z.string().optional(),
});
```

**Component State:**

- `isDrawerOpen: boolean` - local state for drawer visibility
- `drawerFocus: 'p1' | 'p2' | null` - optional: which column to emphasize when opening

**Data Fetching:**

- `useQuery(trpc.player.getAll.queryOptions())` - all players for drawer lists
- `useQuery(trpc.player.comparePlayers.queryOptions({ player1Id, player2Id }))` - comparison data, enabled when both IDs present
- `useQuery(trpc.player.getSeasonHistory.queryOptions({ playerId }))` - history for charts, per player

**Navigation:**

```typescript
const navigate = useNavigate({ from: Route.fullPath });

// Update P1
navigate({ to: ".", search: { ...search, p1: newPlayerId } });

// Update P2
navigate({ to: ".", search: { ...search, p2: newPlayerId } });

// Clear both
navigate({ to: ".", search: {} });
```

### 5. Component Structure

```
PlayerComparisonPage
├── Header (breadcrumbs)
├── PlayerSelectorCard (both players clickable)
├── PlayerCardsGrid (comparison display)
├── HeadToHeadCard (when data available)
├── StatsComparisonCard (when data available)
├── ChartsSection (when data available)
└── PlayerSelectionDrawer
    ├── DrawerHeader (title)
    ├── TwoColumnPlayerLists
    │   ├── PlayerList (P1 column)
    │   └── PlayerList (P2 column)
    └── DrawerFooter (Done button)
```

### 6. Visual Design Details

**Player List Item (Selected State):**

- P1: `bg-blue-500/10 border-l-2 border-l-blue-500`
- P2: `bg-rose-500/10 border-l-2 border-l-rose-500`

**Player List Item (Other Column Selected):**

- `opacity-40 line-through`
- Prevents confusion about already-selected players

**Empty State Card:**

- Border: `border-2 border-dashed border-border`
- Hover: `hover:border-primary hover:bg-primary/5`
- Icon: `UserAdd01Icon` centered in circle

### 7. Edge Cases

**Same Player Selected:**

- Query disabled if `p1 === p2`
- Show message: "Please select two different players to compare"

**Invalid Player ID:**

- Query fails gracefully
- Show error state in respective player card

**One Player Missing:**

- Show empty state for missing player
- Still allow changing the selected player

**URL Sharing:**

- When page loads with valid p1/p2 params, drawer stays closed
- Comparison data loads immediately

## Files to Modify

1. `/apps/web/src/routes/_authenticated/_sidebar/leagues/$slug/players/compare.tsx` - Main page refactor

## Dependencies

- TanStack Router for URL state management
- shadcn/ui Drawer component (already in use)
- Hugeicons for icons
- tRPC for data fetching
- Existing `player-selection-drawer.tsx` pattern as reference

## Acceptance Criteria

- [ ] URL query params `p1` and `p2` control player selection
- [ ] Drawer opens from bottom with two columns (P1/P2)
- [ ] Clicking player in column assigns/unassigns them to that position
- [ ] Same player cannot be both P1 and P2
- [ ] Both player cards in header are clickable to open drawer
- [ ] Empty states show when players not selected
- [ ] Comparison only loads when both players selected and different
- [ ] URL is shareable - visiting with params loads comparison directly
- [ ] Uses existing UI patterns from match creation drawer
