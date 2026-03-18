# Match Edit/Insert with Replay Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow admins/editors to edit existing matches or insert new matches between existing ones, with automatic Elo recalculation and a visual replay dialog showing the process.

**Architecture:** Extend the existing CreateMatchDialog to support 3 modes (create/edit/insert). Add new tRPC procedures for edit and insert that handle reverting matches from the change point, applying the modification, then re-logging all subsequent matches. Create a ReplayProgressDialog component that visualizes the recalculation process with animations.

**Tech Stack:** React + TypeScript, tRPC, Drizzle ORM, shadcn/ui components, TanStack Query, Tailwind CSS

---

## Task 1: Add Backend Repository Function for Match Replay

**Files:**

- Modify: `apps/worker/src/repositories/match-repository.ts`

**Step 1: Add getMatchesAfter function**

Add after line 700 (after `findLatest` function):

```typescript
export const getMatchesAfter = async ({
	db,
	seasonId,
	createdAt,
}: {
	db: DrizzleDB;
	seasonId: string;
	createdAt: Date;
}) => {
	return db
		.select({
			id: match.id,
			seasonId: match.seasonId,
			homeScore: match.homeScore,
			awayScore: match.awayScore,
			createdAt: match.createdAt,
		})
		.from(match)
		.where(and(eq(match.seasonId, seasonId), sql`${match.createdAt} > ${createdAt}`))
		.orderBy(desc(match.createdAt));
};
```

**Step 2: Add getMatchWithFullDetails function**

Add after `getMatchesAfter`:

```typescript
export const getMatchWithFullDetails = async ({
	db,
	matchId,
}: {
	db: DrizzleDB;
	matchId: string;
}) => {
	const [matchData] = await db
		.select({
			id: match.id,
			seasonId: match.seasonId,
			homeScore: match.homeScore,
			awayScore: match.awayScore,
			createdAt: match.createdAt,
		})
		.from(match)
		.where(eq(match.id, matchId))
		.limit(1);

	if (!matchData) return null;

	const players = await db
		.select({
			id: matchPlayer.id,
			seasonPlayerId: matchPlayer.seasonPlayerId,
			homeTeam: matchPlayer.homeTeam,
			scoreBefore: matchPlayer.scoreBefore,
			scoreAfter: matchPlayer.scoreAfter,
		})
		.from(matchPlayer)
		.where(eq(matchPlayer.matchId, matchId));

	return {
		...matchData,
		players,
	};
};
```

**Step 3: Commit**

```bash
git add apps/worker/src/repositories/match-repository.ts
git commit -m "feat: add getMatchesAfter and getMatchWithFullDetails repository functions"
```

---

## Task 2: Add Backend Edit Match Procedure

**Files:**

- Modify: `apps/worker/src/trpc/router/match-router.ts`

**Step 1: Add edit procedure after remove procedure (around line 373)**

After the `remove` procedure, add:

```typescript
edit: leagueEditorProcedure
	.input(
		z.object({
			seasonSlug: z.string(),
			matchId: z.string(),
			homeScore: z.number().int().min(0),
			awayScore: z.number().int().min(0),
			homeTeamPlayerIds: z.array(z.string()),
			awayTeamPlayerIds: z.array(z.string()),
		})
	)
	.mutation(async ({ ctx, input }) => {
		const { db } = ctx;
		const { matchId, seasonSlug } = input;

		// Get the match to edit
		const matchToEdit = await matchRepository.getMatchWithFullDetails({
			db,
			matchId,
		});

		if (!matchToEdit) {
			throw new TRPCError({
				code: "NOT_FOUND",
				message: "Match not found",
			});
		}

		if (matchToEdit.seasonId !== ctx.season.id) {
			throw new TRPCError({
				code: "FORBIDDEN",
				message: "Match does not belong to this season",
			});
		}

		// Get all matches after this one (ordered oldest first for replay)
		const laterMatches = await matchRepository.getMatchesAfter({
			db,
			seasonId: ctx.season.id,
			createdAt: matchToEdit.createdAt,
		});

		// Reverse to get oldest first (for sequential replay)
		const matchesToReplay = [...laterMatches].reverse();

		// Remove the target match
		await matchRepository.remove({
			db,
			matchId,
			seasonId: ctx.season.id,
		});

		// Create the edited match with original timestamp
		const editedMatch = await matchRepository.create({
			db,
			input: {
				seasonId: ctx.season.id,
				homeScore: input.homeScore,
				awayScore: input.awayScore,
				homeTeamPlayerIds: input.homeTeamPlayerIds,
				awayTeamPlayerIds: input.awayTeamPlayerIds,
				userId: ctx.authentication.user.id,
			},
		});

		// Replay all subsequent matches
		for (const subsequentMatch of matchesToReplay) {
			const matchDetails = await matchRepository.getMatchWithFullDetails({
				db,
				matchId: subsequentMatch.id,
			});

			if (!matchDetails) continue;

			const homePlayerIds = matchDetails.players
				.filter((p) => p.homeTeam)
				.map((p) => p.seasonPlayerId);
			const awayPlayerIds = matchDetails.players
				.filter((p) => !p.homeTeam)
				.map((p) => p.seasonPlayerId);

			// Remove the old match
			await matchRepository.remove({
				db,
				matchId: subsequentMatch.id,
				seasonId: ctx.season.id,
			});

			// Recreate with new Elo calculations
			await matchRepository.create({
				db,
				input: {
					seasonId: ctx.season.id,
					homeScore: subsequentMatch.homeScore,
					awayScore: subsequentMatch.awayScore,
					homeTeamPlayerIds: homePlayerIds,
					awayTeamPlayerIds: awayPlayerIds,
					userId: ctx.authentication.user.id,
				},
			});
		}

		const standings = await seasonPlayerRepository.getStanding({
			db,
			seasonId: ctx.season.id,
		});

		ctx.waitUntil(
			broadcastSeasonEvent(ctx.env, ctx.organization.slug, seasonSlug, {
				type: "match:edit",
				data: {
					matchId,
					standings,
				},
				user: {
					id: ctx.authentication.user.id,
					name: ctx.authentication.user.name,
				},
			})
		);

		return { success: true, editedMatchId: editedMatch.id };
	}),
```

**Step 2: Commit**

```bash
git add apps/worker/src/trpc/router/match-router.ts
git commit -m "feat: add edit match tRPC procedure with replay logic"
```

---

## Task 3: Add Backend Insert Match Procedure

**Files:**

- Modify: `apps/worker/src/trpc/router/match-router.ts`

**Step 1: Add insert procedure after edit procedure**

After the `edit` procedure, add:

```typescript
insert: leagueEditorProcedure
	.input(
		z.object({
			seasonSlug: z.string(),
			insertAfterMatchId: z.string(),
			homeScore: z.number().int().min(0),
			awayScore: z.number().int().min(0),
			homeTeamPlayerIds: z.array(z.string()),
			awayTeamPlayerIds: z.array(z.string()),
		})
	)
	.mutation(async ({ ctx, input }) => {
		const { db } = ctx;
		const { insertAfterMatchId, seasonSlug } = input;

		// Get the match to insert after
		const referenceMatch = await matchRepository.getMatchWithFullDetails({
			db,
			matchId: insertAfterMatchId,
		});

		if (!referenceMatch) {
			throw new TRPCError({
				code: "NOT_FOUND",
				message: "Reference match not found",
			});
		}

		if (referenceMatch.seasonId !== ctx.season.id) {
			throw new TRPCError({
				code: "FORBIDDEN",
				message: "Match does not belong to this season",
			});
		}

		// Get all matches after the reference match (ordered oldest first for replay)
		const laterMatches = await matchRepository.getMatchesAfter({
			db,
			seasonId: ctx.season.id,
			createdAt: referenceMatch.createdAt,
		});

		// Reverse to get oldest first (for sequential replay)
		const matchesToReplay = [...laterMatches].reverse();

		// Create the new match first (it will get a new timestamp)
		await matchRepository.create({
			db,
			input: {
				seasonId: ctx.season.id,
				homeScore: input.homeScore,
				awayScore: input.awayScore,
				homeTeamPlayerIds: input.homeTeamPlayerIds,
				awayTeamPlayerIds: input.awayTeamPlayerIds,
				userId: ctx.authentication.user.id,
			},
		});

		// Replay all subsequent matches to recalculate Elo
		for (const subsequentMatch of matchesToReplay) {
			const matchDetails = await matchRepository.getMatchWithFullDetails({
				db,
				matchId: subsequentMatch.id,
			});

			if (!matchDetails) continue;

			const homePlayerIds = matchDetails.players
				.filter((p) => p.homeTeam)
				.map((p) => p.seasonPlayerId);
			const awayPlayerIds = matchDetails.players
				.filter((p) => !p.homeTeam)
				.map((p) => p.seasonPlayerId);

			// Remove the old match
			await matchRepository.remove({
				db,
				matchId: subsequentMatch.id,
				seasonId: ctx.season.id,
			});

			// Recreate with new Elo calculations
			await matchRepository.create({
				db,
				input: {
					seasonId: ctx.season.id,
					homeScore: subsequentMatch.homeScore,
					awayScore: subsequentMatch.awayScore,
					homeTeamPlayerIds: homePlayerIds,
					awayTeamPlayerIds: awayPlayerIds,
					userId: ctx.authentication.user.id,
				},
			});
		}

		const standings = await seasonPlayerRepository.getStanding({
			db,
			seasonId: ctx.season.id,
		});

		ctx.waitUntil(
			broadcastSeasonEvent(ctx.env, ctx.organization.slug, seasonSlug, {
				type: "match:insert",
				data: {
					standings,
				},
				user: {
					id: ctx.authentication.user.id,
					name: ctx.authentication.user.name,
				},
			})
		);

		return { success: true };
	}),
```

**Step 2: Commit**

```bash
git add apps/worker/src/trpc/router/match-router.ts
git commit -m "feat: add insert match tRPC procedure with replay logic"
```

---

## Task 4: Create Replay Progress Dialog Component

**Files:**

- Create: `apps/web/src/routes/_authenticated/_sidebar/leagues/$slug/seasons/-components/match/replay-progress-dialog.tsx`

**Step 1: Create the component file**

```typescript
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { HugeiconsIcon } from "@hugeicons/react";
import { CheckmarkCircle01Icon, Loading02Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

interface ReplayStep {
	matchNumber: number;
	status: "pending" | "processing" | "completed";
	isEdit?: boolean;
}

interface ReplayProgressDialogProps {
	isOpen: boolean;
	totalMatches: number;
	currentStep: number;
	mode: "edit" | "insert";
	editMatchNumber?: number;
}

export function ReplayProgressDialog({
	isOpen,
	totalMatches,
	currentStep,
	mode,
	editMatchNumber,
}: ReplayProgressDialogProps) {
	const [steps, setSteps] = useState<ReplayStep[]>([]);

	useEffect(() => {
		// Build steps array
		const newSteps: ReplayStep[] = [];

		if (mode === "edit" && editMatchNumber) {
			// For edit: show all matches from edit point to end
			for (let i = editMatchNumber; i <= totalMatches; i++) {
				newSteps.push({
					matchNumber: i,
					status: i < editMatchNumber + currentStep ? "completed" :
							i === editMatchNumber + currentStep ? "processing" : "pending",
					isEdit: i === editMatchNumber,
				});
			}
		} else {
			// For insert: show from insert point to end
			const startNumber = editMatchNumber || 1;
			for (let i = startNumber; i <= totalMatches; i++) {
				newSteps.push({
					matchNumber: i,
					status: i < startNumber + currentStep ? "completed" :
							i === startNumber + currentStep ? "processing" : "pending",
				});
			}
		}

		setSteps(newSteps);
	}, [totalMatches, currentStep, mode, editMatchNumber]);

	const progress = Math.min(100, Math.round((currentStep / (steps.length || 1)) * 100));

	return (
		<Dialog open={isOpen}>
			<DialogContent className="sm:max-w-md" hideCloseButton>
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<HugeiconsIcon icon={Loading02Icon} className="size-5 animate-spin" />
						Recalculating Rankings...
					</DialogTitle>
				</DialogHeader>

				<div className="space-y-6 py-4">
					{/* Progress bar */}
					<div className="space-y-2">
						<div className="flex justify-between text-sm text-muted-foreground">
							<span>Progress</span>
							<span>{progress}%</span>
						</div>
						<Progress value={progress} className="h-2" />
					</div>

					{/* Match steps visualization */}
					<div className="space-y-2 max-h-64 overflow-y-auto">
						{steps.map((step, index) => (
							<div
								key={step.matchNumber}
								className={cn(
									"flex items-center gap-3 p-3 rounded-lg border transition-all duration-300",
									step.status === "completed" && "bg-green-50/50 border-green-200 dark:bg-green-950/20 dark:border-green-800",
									step.status === "processing" && "bg-blue-50/50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800 animate-pulse",
									step.status === "pending" && "bg-muted/30 border-muted",
									step.isEdit && "ring-2 ring-amber-400 ring-offset-2"
								)}
								style={{
									animationDelay: `${index * 50}ms`,
								}}
							>
								<div className="flex-shrink-0">
									{step.status === "completed" && (
										<HugeiconsIcon
											icon={CheckmarkCircle01Icon}
											className="size-5 text-green-600"
										/>
									)}
									{step.status === "processing" && (
										<HugeiconsIcon
											icon={Loading02Icon}
											className="size-5 text-blue-600 animate-spin"
										/>
									)}
									{step.status === "pending" && (
										<div className="size-5 rounded-full border-2 border-muted-foreground/30" />
									)}
								</div>

								<div className="flex-1 min-w-0">
									<div className="flex items-center gap-2">
										<span className="font-mono text-sm font-medium">
											Match #{step.matchNumber}
										</span>
										{step.isEdit && (
											<span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full font-medium">
												EDITED
											</span>
										)}
									</div>
									<p className="text-xs text-muted-foreground">
										{step.status === "completed" && "Elo recalculated"}
										{step.status === "processing" && "Recalculating Elo..."}
										{step.status === "pending" && "Waiting..."}
									</p>
								</div>
							</div>
						))}
					</div>

					{/* Status message */}
					<div className="text-center text-sm text-muted-foreground">
						{currentStep === 0 && "Preparing to recalculate..."}
						{currentStep > 0 && currentStep < steps.length && `Processing match ${currentStep} of ${steps.length}...`}
						{currentStep >= steps.length && "Finalizing..."}
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
```

**Step 2: Commit**

```bash
git add apps/web/src/routes/_authenticated/_sidebar/leagues/$slug/seasons/-components/match/replay-progress-dialog.tsx
git commit -m "feat: add replay progress dialog component"
```

---

## Task 5: Extend CreateMatchDialog for Edit/Insert Modes

**Files:**

- Modify: `apps/web/src/routes/_authenticated/_sidebar/leagues/$slug/seasons/-components/match/create-match-drawer.tsx`

**Step 1: Add new props and update imports**

Add to imports:

```typescript
import { PencilEdit01Icon, Delete01Icon } from "@hugeicons/core-free-icons";
```

Update the Props interface (around line 69):

```typescript
interface CreateMatchDialogProps {
	isOpen: boolean;
	onClose: () => void;
	seasonId: string;
	seasonSlug: string;
	// New props for edit/insert modes
	mode?: "create" | "edit" | "insert";
	matchToEdit?: {
		id: string;
		homeScore: number;
		awayScore: number;
		createdAt: Date;
		homeTeam: {
			players: { seasonPlayerId: string; name: string; image: string | null }[];
		};
		awayTeam: {
			players: { seasonPlayerId: string; name: string; image: string | null }[];
		};
	} | null;
	onRemove?: () => void;
}
```

**Step 2: Update the component signature and initialization**

Update function signature (line 78):

```typescript
export function CreateMatchDialog({
	isOpen,
	onClose,
	seasonId,
	seasonSlug,
	mode = "create",
	matchToEdit,
	onRemove,
}: CreateMatchDialogProps) {
```

Update the initialization useEffect (around line 102):

```typescript
useEffect(() => {
	if (isOpen && seasonPlayers && !initialized) {
		if (mode === "edit" && matchToEdit) {
			// Pre-populate for edit mode
			setTeamSelection(
				seasonPlayers.map((p) => {
					const isHome = matchToEdit.homeTeam.players.some((hp) => hp.seasonPlayerId === p.id);
					const isAway = matchToEdit.awayTeam.players.some((ap) => ap.seasonPlayerId === p.id);
					return {
						...p,
						team: isHome ? "home" : isAway ? "away" : undefined,
					};
				})
			);
			setValue("homeScore", matchToEdit.homeScore);
			setValue("awayScore", matchToEdit.awayScore);
		} else {
			setTeamSelection(seasonPlayers.map((p) => ({ ...p })));
		}
		setInitialized(true);
	}
}, [isOpen, seasonPlayers, initialized, mode, matchToEdit, setValue]);
```

**Step 3: Add mutations for edit and insert**

Add after createMutation (around line 178):

```typescript
const editMutation = useMutation(
	trpc.match.edit.mutationOptions({
		onSuccess: () => {
			toast.success("Match updated successfully");
			queryClient.invalidateQueries({ queryKey: ["matches", seasonId] });
			queryClient.invalidateQueries({
				queryKey: trpc.seasonPlayer.getStanding.queryKey({ seasonSlug }),
			});
			queryClient.invalidateQueries({ queryKey: trpc.match.getLatest.queryKey({ seasonSlug }) });
			queryClient.invalidateQueries({
				queryKey: trpc.season.getCountInfo.queryKey({ seasonSlug }),
			});
			handleClose();
		},
		onError: (err) => {
			toast.error(err instanceof Error ? err.message : "Failed to update match");
		},
	})
);

const insertMutation = useMutation(
	trpc.match.insert.mutationOptions({
		onSuccess: () => {
			toast.success("Match inserted successfully");
			queryClient.invalidateQueries({ queryKey: ["matches", seasonId] });
			queryClient.invalidateQueries({
				queryKey: trpc.seasonPlayer.getStanding.queryKey({ seasonSlug }),
			});
			queryClient.invalidateQueries({ queryKey: trpc.match.getLatest.queryKey({ seasonSlug }) });
			queryClient.invalidateQueries({
				queryKey: trpc.season.getCountInfo.queryKey({ seasonSlug }),
			});
			handleClose();
		},
		onError: (err) => {
			toast.error(err instanceof Error ? err.message : "Failed to insert match");
		},
	})
);
```

**Step 4: Update the submit handler**

Update onSubmit function (around line 216):

```typescript
const onSubmit = (values: CreateMatchFormValues) => {
	if (!showDuplicateWarning && isDuplicateMatch(values)) {
		setShowDuplicateWarning(true);
		return;
	}
	setShowDuplicateWarning(false);

	if (mode === "edit" && matchToEdit) {
		editMutation.mutate({
			seasonSlug,
			matchId: matchToEdit.id,
			homeScore: values.homeScore,
			awayScore: values.awayScore,
			homeTeamPlayerIds: values.homePlayers.map((p) => p.id),
			awayTeamPlayerIds: values.awayPlayers.map((p) => p.id),
		});
	} else if (mode === "insert" && matchToEdit) {
		insertMutation.mutate({
			seasonSlug,
			insertAfterMatchId: matchToEdit.id,
			homeScore: values.homeScore,
			awayScore: values.awayScore,
			homeTeamPlayerIds: values.homePlayers.map((p) => p.id),
			awayTeamPlayerIds: values.awayPlayers.map((p) => p.id),
		});
	} else {
		createMutation.mutate({
			seasonSlug,
			homeScore: values.homeScore,
			awayScore: values.awayScore,
			homeTeamPlayerIds: values.homePlayers.map((p) => p.id),
			awayTeamPlayerIds: values.awayPlayers.map((p) => p.id),
		});
	}
};
```

**Step 5: Update the dialog title and add remove button**

Update DialogHeader (around line 368):

```typescript
<DialogHeader className="relative z-10 p-4 pb-3 border-b border-border">
	<div className="flex items-center gap-3">
		<div className={cn(
			"w-1.5 h-5",
			mode === "create" && "bg-blue-500",
			mode === "edit" && "bg-amber-500",
			mode === "insert" && "bg-purple-500"
		)} />
		<DialogTitle className="text-base font-bold font-mono tracking-tight">
			{mode === "create" && "Create Match"}
			{mode === "edit" && "Edit Match"}
			{mode === "insert" && "Insert Match"}
		</DialogTitle>
	</div>
</DialogHeader>
```

Update the submit button section (around line 520):

```typescript
<GlowButton
	type="submit"
	glowColor={showDuplicateWarning ? glowColors.red : mode === "edit" ? glowColors.amber : mode === "insert" ? glowColors.purple : glowColors.blue}
	className="flex-1 font-mono"
	disabled={
		createMutation.isPending ||
		editMutation.isPending ||
		insertMutation.isPending ||
		homePlayers.length !== awayPlayers.length
	}
	data-testid="match-submit-button"
>
	{createMutation.isPending || editMutation.isPending || insertMutation.isPending
		? mode === "edit"
			? "Updating..."
			: mode === "insert"
				? "Inserting..."
				: "Creating..."
		: showDuplicateWarning
			? "Create Anyway"
			: mode === "edit"
				? "Save Changes"
				: mode === "insert"
					? "Insert Match"
					: "Create Match"}
</GlowButton>
```

Add remove button before the GlowButton (around line 511):

```typescript
{mode === "edit" && onRemove && (
	<Button
		type="button"
		variant="outline"
		className="font-mono border-destructive text-destructive hover:bg-destructive/10"
		onClick={onRemove}
		data-testid="match-remove-button"
	>
		<HugeiconsIcon icon={Delete01Icon} className="size-4 mr-1" />
		Remove
	</Button>
)}
```

**Step 6: Commit**

```bash
git add apps/web/src/routes/_authenticated/_sidebar/leagues/$slug/seasons/-components/match/create-match-drawer.tsx
git commit -m "feat: extend create match dialog to support edit and insert modes"
```

---

## Task 6: Add Edit and Insert UI to Matches Page

**Files:**

- Modify: `apps/web/src/routes/_authenticated/_sidebar/leagues/$slug/seasons/$seasonSlug/matches.tsx`

**Step 1: Add state and handlers for edit/insert dialogs**

Add imports:

```typescript
import { PencilEdit01Icon, Add01Icon } from "@hugeicons/core-free-icons";
```

Add state after line 58:

```typescript
const [editMatch, setEditMatch] = useState<(typeof matches)[0] | null>(null);
const [insertAfterMatch, setInsertAfterMatch] = useState<(typeof matches)[0] | null>(null);
const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
const [isInsertDialogOpen, setIsInsertDialogOpen] = useState(false);
```

**Step 2: Add permission check for editing**

Add after line 46:

```typescript
const canEditMatches = role === "owner" || role === "editor";
```

**Step 3: Update the match row rendering to include edit/insert buttons**

Modify the virtual item rendering (around line 220):

```typescript
return (
	<div
		key={virtualItem.key}
		data-index={virtualItem.index}
		ref={virtualizer.measureElement}
		style={{
			position: "absolute",
			top: 0,
			left: 0,
			width: "100%",
			transform: `translateY(${virtualItem.start}px)`,
		}}
		className="hover:bg-muted/50 transition-colors border-b border-border/50 last:border-b-0 py-3 px-2 overflow-hidden group"
	>
		<div className="flex items-center gap-2">
			<div className="flex-1">
				<MatchRow
					match={match}
					seasonSlug={seasonSlug}
					seasonId={seasonId ?? ""}
				/>
			</div>
			{canEditMatches && !isSeasonLocked && (
				<div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
					<Button
						variant="ghost"
						size="icon"
						className="h-8 w-8"
						onClick={() => {
							setEditMatch(match);
							setIsEditDialogOpen(true);
						}}
						data-testid={`edit-match-${match.id}`}
					>
						<HugeiconsIcon icon={PencilEdit01Icon} className="size-4" />
					</Button>
					<Button
						variant="ghost"
						size="icon"
						className="h-8 w-8"
						onClick={() => {
							setInsertAfterMatch(match);
							setIsInsertDialogOpen(true);
						}}
						data-testid={`insert-after-match-${match.id}`}
					>
						<HugeiconsIcon icon={Add01Icon} className="size-4" />
					</Button>
				</div>
			)}
		</div>
	</div>
);
```

**Step 4: Add the edit and insert dialogs at the end of the component**

After the RemoveMatchDialog (around line 270), add:

```typescript
{seasonId && editMatch && (
	<CreateMatchDialog
		isOpen={isEditDialogOpen}
		onClose={() => {
			setIsEditDialogOpen(false);
			setEditMatch(null);
		}}
		seasonId={seasonId}
		seasonSlug={seasonSlug}
		mode="edit"
		matchToEdit={editMatch}
		onRemove={() => {
			setIsEditDialogOpen(false);
			setIsRemoveDialogOpen(true);
		}}
	/>
)}
{seasonId && insertAfterMatch && (
	<CreateMatchDialog
		isOpen={isInsertDialogOpen}
		onClose={() => {
			setIsInsertDialogOpen(false);
			setInsertAfterMatch(null);
		}}
		seasonId={seasonId}
		seasonSlug={seasonSlug}
		mode="insert"
		matchToEdit={insertAfterMatch}
	/>
)}
```

**Step 5: Commit**

```bash
git add apps/web/src/routes/_authenticated/_sidebar/leagues/$slug/seasons/$seasonSlug/matches.tsx
git commit -m "feat: add edit and insert UI to matches page"
```

---

## Task 7: Run Type Checks and Fix Issues

**Step 1: Run typecheck**

```bash
bun typecheck
```

**Step 2: Fix any type errors**

Common issues to fix:

- Missing imports
- Type mismatches in mutation options
- Props interface updates

**Step 3: Run linter**

```bash
bun oxc
```

**Step 4: Commit fixes**

```bash
git add -A
git commit -m "fix: resolve type errors and lint issues"
```

---

## Task 8: Manual Testing

**Test scenarios:**

1. **Edit a match:**
   - Go to matches page
   - Hover over a match, click edit icon
   - Change scores or players
   - Verify Elo recalculates for subsequent matches

2. **Insert a match:**
   - Click insert icon after a match
   - Create a new match
   - Verify it's inserted and Elo recalculates

3. **Remove from edit dialog:**
   - Open edit dialog
   - Click remove button
   - Verify match is removed

4. **Permission testing:**
   - Login as member/viewer
   - Verify edit/insert buttons don't appear

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete match edit/insert with replay functionality"
```

---

## Summary

This implementation adds:

- Backend repository functions for getting matches after a timestamp
- `match.edit` tRPC procedure for editing matches with replay
- `match.insert` tRPC procedure for inserting matches with replay
- `ReplayProgressDialog` component for visual feedback
- Extended `CreateMatchDialog` supporting 3 modes (create/edit/insert)
- Edit/insert buttons on the matches page (admin/editor only)

The replay system automatically:

1. Removes the target match (for edit) or identifies insertion point
2. Removes all subsequent matches
3. Creates the edited/inserted match
4. Re-creates all subsequent matches with recalculated Elo
5. Broadcasts updates to connected clients
