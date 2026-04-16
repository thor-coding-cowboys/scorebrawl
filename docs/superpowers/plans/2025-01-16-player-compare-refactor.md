# Player Comparison Page Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the player comparison page to use URL query parameters for player selection and replace the single-column drawer with a two-column (P1/P2) drawer.

**Architecture:** Player IDs stored in URL via TanStack Router `validateSearch`. A single `PlayerSelectionDrawer` component renders two columns; clicking either assigns/unassigns that player to that position. The existing compare page is the only file changed.

**Tech Stack:** TanStack Router (search params), React, TanStack Query, shadcn/ui Drawer, Hugeicons, tRPC

---

### Task 1: Add search params and wire navigation

**Files:**

- Modify: `apps/web/src/routes/_authenticated/_sidebar/leagues/$slug/players/compare.tsx`

- [ ] **Step 1: Add `validateSearch` schema and replace local state with URL state**

Replace the top of the route definition and component state. The full updated imports and route setup:

```tsx
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";

const compareSearchSchema = z.object({
	p1: z.string().optional(),
	p2: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/_sidebar/leagues/$slug/players/compare")({
	component: PlayerComparisonPage,
	validateSearch: compareSearchSchema,
	loader: async ({ params }) => {
		return { slug: params.slug };
	},
});
```

Inside `PlayerComparisonPage`, replace the old state:

```tsx
const { slug } = Route.useLoaderData();
const navigate = useNavigate({ from: Route.fullPath });
const trpc = useTRPC();
const [isDrawerOpen, setIsDrawerOpen] = useState(false);

const { p1: player1Id, p2: player2Id } = Route.useSearch();
```

Remove the old `const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);` line and the `const player1Id = allPlayers?.[0]?.id;` line.

- [ ] **Step 2: Update navigation helpers**

Add these helpers inside the component (after the search destructure):

```tsx
const setPlayer1Id = (id: string | undefined) => {
	navigate({ to: ".", search: (prev) => ({ ...prev, p1: id }) });
};

const setPlayer2Id = (id: string | undefined) => {
	navigate({ to: ".", search: (prev) => ({ ...prev, p2: id }) });
};
```

- [ ] **Step 3: Fix all references that used the old state**

- `player2Id` was `selectedPlayerId` — it's now `player2Id` from search params, already set above.
- Remove the `useQuery` for `activeSeason` (it was unused — query result was never used).
- The `availablePlayers` filter used `player1Id` — keep the same logic, it now uses search param value.
- Remove `handlePlayerSelect` function.

Update `availablePlayers` to exclude both selected players from each other's lists:

```tsx
const availablePlayers = allPlayers || [];
```

(The drawer handles exclusion visually, not by filtering the list.)

- [ ] **Step 4: Update the `enabled` condition for comparison query**

```tsx
enabled: !!player1Id && !!player2Id && player1Id !== player2Id,
```

This is unchanged — just verify it still references `player1Id` and `player2Id` from search.

- [ ] **Step 5: Run lint/typecheck**

```bash
bun oxc && bun typecheck
```

Expected: no new errors in compare.tsx

---

### Task 2: Update the player selector header card (both sides clickable)

**Files:**

- Modify: `apps/web/src/routes/_authenticated/_sidebar/leagues/$slug/players/compare.tsx`

- [ ] **Step 1: Update Player 1 display to be clickable**

Replace the Player 1 section inside `CardContent` (currently a static div) with a button that opens the drawer:

```tsx
{
	/* Player 1 Selector */
}
<div className="flex-1 w-full">
	{playersLoading ? (
		<Skeleton className="h-14 w-full" />
	) : player1Basic ? (
		<button
			type="button"
			onClick={() => setIsDrawerOpen(true)}
			className="w-full flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-left"
		>
			<Avatar className="h-12 w-12 rounded-lg">
				<AvatarImage src={player1Basic.image ?? undefined} className="rounded-lg" />
				<AvatarFallback className="rounded-lg text-lg">
					{player1Basic.name.charAt(0)}
				</AvatarFallback>
			</Avatar>
			<div className="flex-1">
				<p className="font-semibold">{player1Basic.name}</p>
				<p className="text-sm text-muted-foreground">Player 1 (click to change)</p>
			</div>
			<HugeiconsIcon icon={GitCompareIcon} className="size-4 text-muted-foreground" />
		</button>
	) : (
		<button
			type="button"
			onClick={() => setIsDrawerOpen(true)}
			className="w-full flex items-center justify-center gap-2 p-3 rounded-lg border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 transition-colors text-muted-foreground hover:text-primary"
		>
			<HugeiconsIcon icon={UserAdd01Icon} className="size-5" />
			<span className="font-medium">Select Player 1</span>
		</button>
	)}
</div>;
```

- [ ] **Step 2: Add `player1Basic` and `player2Basic` derivations**

```tsx
const player1Basic = allPlayers?.find((p) => p.id === player1Id);
const player2Basic = allPlayers?.find((p) => p.id === player2Id);
```

Replace the old `player2Basic` line with both of these.

- [ ] **Step 3: Update Player 2 display to reference `player2Basic`**

The Player 2 button already shows `player2Basic`, just update the subtitle text from "Player 2 (click to change)" to match and ensure `onClick` calls `setIsDrawerOpen(true)`.

- [ ] **Step 4: Run lint/typecheck**

```bash
bun oxc && bun typecheck
```

---

### Task 3: Replace drawer with two-column PlayerSelectionDrawer

**Files:**

- Modify: `apps/web/src/routes/_authenticated/_sidebar/leagues/$slug/players/compare.tsx`

- [ ] **Step 1: Remove old single-column drawer JSX**

Remove the entire `{/* Player Selection Drawer */}` block at the bottom of the return (the `<Drawer>` that contained the single-column player list).

- [ ] **Step 2: Add `PlayerSelectionDrawer` component at the bottom of the file**

Add after the main `PlayerComparisonPage` function:

```tsx
function PlayerSelectionDrawer({
	isOpen,
	onClose,
	players,
	player1Id,
	player2Id,
	onSelectPlayer1,
	onSelectPlayer2,
}: {
	isOpen: boolean;
	onClose: () => void;
	players: { id: string; name: string; image: string | null; isGuest: boolean }[];
	player1Id: string | undefined;
	player2Id: string | undefined;
	onSelectPlayer1: (id: string | undefined) => void;
	onSelectPlayer2: (id: string | undefined) => void;
}) {
	return (
		<Drawer
			open={isOpen}
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
		>
			<DrawerContent className="max-h-[85vh]">
				<div className="mx-auto w-full max-w-xl">
					<DrawerHeader className="border-b border-border pb-3">
						<DrawerTitle className="text-sm font-bold font-mono text-center">
							Select Players
						</DrawerTitle>
					</DrawerHeader>

					<div className="grid grid-cols-2 gap-0 max-h-[55vh] overflow-y-auto">
						{/* Player 1 Column */}
						<div className="border-r border-border">
							<div className="sticky top-0 bg-background px-3 py-2 border-b border-border">
								<span className="text-xs font-mono font-medium uppercase tracking-wider text-blue-500">
									Player 1
								</span>
							</div>
							<ComparePlayerList
								players={players}
								side="p1"
								player1Id={player1Id}
								player2Id={player2Id}
								onSelect={(id) => {
									onSelectPlayer1(player1Id === id ? undefined : id);
								}}
							/>
						</div>

						{/* Player 2 Column */}
						<div>
							<div className="sticky top-0 bg-background px-3 py-2 border-b border-border">
								<span className="text-xs font-mono font-medium uppercase tracking-wider text-rose-500">
									Player 2
								</span>
							</div>
							<ComparePlayerList
								players={players}
								side="p2"
								player1Id={player1Id}
								player2Id={player2Id}
								onSelect={(id) => {
									onSelectPlayer2(player2Id === id ? undefined : id);
								}}
							/>
						</div>
					</div>

					<DrawerFooter className="border-t border-border">
						<Button onClick={onClose} className="w-full">
							Done
						</Button>
					</DrawerFooter>
				</div>
			</DrawerContent>
		</Drawer>
	);
}
```

- [ ] **Step 3: Add `ComparePlayerList` component**

Add after `PlayerSelectionDrawer`:

```tsx
function ComparePlayerList({
	players,
	side,
	player1Id,
	player2Id,
	onSelect,
}: {
	players: { id: string; name: string; image: string | null; isGuest: boolean }[];
	side: "p1" | "p2";
	player1Id: string | undefined;
	player2Id: string | undefined;
	onSelect: (id: string) => void;
}) {
	return (
		<div className="flex flex-col">
			{players.map((player) => {
				const isThisSide = side === "p1" ? player.id === player1Id : player.id === player2Id;
				const isOtherSide = side === "p1" ? player.id === player2Id : player.id === player1Id;

				return (
					<button
						key={player.id}
						type="button"
						onClick={() => onSelect(player.id)}
						className={cn(
							"flex items-center gap-2 px-3 py-2 text-left transition-colors border-b border-border/50 last:border-b-0",
							isThisSide && side === "p1" && "bg-blue-500/10 border-l-2 border-l-blue-500",
							isThisSide && side === "p2" && "bg-rose-500/10 border-l-2 border-l-rose-500",
							isOtherSide && "opacity-40 line-through",
							!isThisSide && !isOtherSide && "hover:bg-muted/50"
						)}
					>
						<Avatar className="h-9 w-9 rounded-lg shrink-0">
							<AvatarImage src={player.image ?? undefined} className="rounded-lg" />
							<AvatarFallback className="rounded-lg text-sm">
								{player.name.charAt(0)}
							</AvatarFallback>
						</Avatar>
						<div className="flex-1 min-w-0">
							<p className="text-xs font-medium truncate">{player.name}</p>
							<p className="text-[0.65rem] text-muted-foreground">
								{player.isGuest ? "Guest" : "Member"}
							</p>
						</div>
						{isThisSide && (
							<HugeiconsIcon
								icon={Tick01Icon}
								className={cn(
									"size-3.5 shrink-0",
									side === "p1" ? "text-blue-500" : "text-rose-500"
								)}
							/>
						)}
					</button>
				);
			})}
			{players.length === 0 && (
				<div className="flex items-center justify-center h-20 text-xs text-muted-foreground">
					No players available
				</div>
			)}
		</div>
	);
}
```

- [ ] **Step 4: Wire `PlayerSelectionDrawer` into the JSX return**

At the bottom of the return inside `PlayerComparisonPage`, just before the closing `</>`, add:

```tsx
<PlayerSelectionDrawer
	isOpen={isDrawerOpen}
	onClose={() => setIsDrawerOpen(false)}
	players={allPlayers ?? []}
	player1Id={player1Id}
	player2Id={player2Id}
	onSelectPlayer1={setPlayer1Id}
	onSelectPlayer2={setPlayer2Id}
/>
```

- [ ] **Step 5: Remove unused imports**

Remove any imports that are no longer used after the refactor. The following should still be needed:

- Keep: `Drawer`, `DrawerContent`, `DrawerHeader`, `DrawerFooter`, `DrawerTitle`
- Keep: `Avatar`, `AvatarImage`, `AvatarFallback`
- Keep: `Tick01Icon`, `UserAdd01Icon`, `GitCompareIcon`
- Remove if unused: any others flagged by oxc

- [ ] **Step 6: Run lint/typecheck**

```bash
bun oxc && bun typecheck
```

Expected: no errors

---

### Task 4: Handle same-player conflict in drawer

**Files:**

- Modify: `apps/web/src/routes/_authenticated/_sidebar/leagues/$slug/players/compare.tsx`

- [ ] **Step 1: Auto-clear conflicting selection when assigning**

Update the `onSelect` handlers in `PlayerSelectionDrawer` to handle the cross-conflict case — if the player being assigned to P1 is already P2, clear P2 (and vice versa):

```tsx
onSelect={(id) => {
  // If selecting for P1 and this player is already P2, clear P2
  if (player2Id === id) {
    onSelectPlayer2(undefined);
  }
  onSelectPlayer1(player1Id === id ? undefined : id);
}}
```

And for the P2 column:

```tsx
onSelect={(id) => {
  // If selecting for P2 and this player is already P1, clear P1
  if (player1Id === id) {
    onSelectPlayer1(undefined);
  }
  onSelectPlayer2(player2Id === id ? undefined : id);
}}
```

- [ ] **Step 2: Show "select different players" message when same ID**

In `PlayerComparisonPage`, after the player selector card, add a conditional message when `player1Id === player2Id && !!player1Id`:

```tsx
{
	player1Id && player2Id && player1Id === player2Id && (
		<div className="text-sm text-muted-foreground text-center p-2">
			Please select two different players to compare.
		</div>
	);
}
```

This is already handled by `enabled: player1Id !== player2Id` on the query, but it provides user feedback.

- [ ] **Step 3: Run lint/typecheck**

```bash
bun oxc && bun typecheck
```

---

### Task 5: Final verification

- [ ] **Step 1: Run full check**

```bash
bun oxc && bun typecheck
```

Expected: no errors

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/routes/_authenticated/_sidebar/leagues/\$slug/players/compare.tsx docs/superpowers/specs/2025-01-16-player-compare-query-params-design.md docs/superpowers/plans/2025-01-16-player-compare-refactor.md
git commit -m "feat: player compare page with URL query params and dual selection drawer"
```
