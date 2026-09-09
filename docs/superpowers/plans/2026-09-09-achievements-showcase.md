# Achievements Showcase & Celebration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface all 13 achievement types as visible UI (earned/locked profile grid, league-wide board, confetti unlock celebration) and grant the `season_winner` achievement when a season is closed.

**Architecture:** Backend (worker) exposes achievements with `createdAt` plus a single league-scoped board query, and awards `season_winner` to top-scoring players on season close. Frontend (web) centralizes display metadata in one `achievementCatalog` module reused by the profile grid, the new `/leagues/$slug/achievements` board page, and a confetti flyout (modeled on the existing `streak-flyout`) triggered by the existing `achievement:unlock` SSE event.

**Tech Stack:** Hono + tRPC + Drizzle (Cloudflare Worker), TanStack Router + TanStack Query + shadcn/Tailwind, Hugeicons, Vitest (Cloudflare test env), agent-browser for UI verification.

---

## File Structure

**Backend (apps/worker):**
- `src/repositories/achievement-repository.ts` — modify: `getAchievements` adds `createdAt`; add `getLeagueBoard`; add `awardSeasonWinner`
- `src/trpc/router/achievement-router.ts` — modify: add `getLeagueBoard`
- `src/trpc/router/season-router.ts` — modify: `updateClosedStatus` grants `season_winner`
- `test/trpc/achievement-router.spec.ts` — create: integration tests
- `test/trpc/season-router.spec.ts` — create: `season_winner` tests

**Frontend (apps/web):**
- `src/lib/achievements.ts` — rewrite: `achievementCatalog` with name/description/icon/requirement for all 13 types
- `src/lib/event-types.ts` — modify: add `achievement-event` to `WindowEventMap`
- `src/hooks/use-season-sse.tsx` — modify: dispatch `achievement-event` for own unlocks
- `src/routes/-components/achievement-flyout.tsx` — create: confetti celebration overlay
- `src/routes/-components/achievement-animations.css` — create: confetti keyframes
- `src/routes/__root.tsx` — modify: mount `<AchievementFlyout />`
- `src/routes/_authenticated/_sidebar/leagues/$slug/players/$leaguePlayerId/index.tsx` — modify: earned+locked grid
- `src/routes/_authenticated/_sidebar/leagues/$slug/achievements/index.tsx` — create: league board page
- `src/routes/-components/sidebar/app-sidebar.tsx` — modify: "Achievements" nav entry

---

### Task 1: `getAchievements` returns `createdAt` + new `getLeagueBoard` and `awardSeasonWinner` repositories

**Files:**
- Modify: `apps/worker/src/repositories/achievement-repository.ts`

- [ ] **Step 1: Replace the repository file contents**

Current file has `getAchievements` returning `{ type }` only. Replace the whole file:

```ts
import { and, desc, eq, sql } from "drizzle-orm";
import type { DrizzleDB } from "../db";
import { user } from "../db/schema/auth-schema";
import {
	guest,
	player,
	playerAchievement,
	seasonPlayer,
	type achievementType,
} from "../db/schema/league-schema";

type AchievementType = (typeof achievementType)[number];

export type PlayerAchievement = {
	playerId: string;
	type: AchievementType;
	createdAt: Date;
};

export const getAchievements = async ({
	db,
	playerId,
	leagueId,
}: {
	db: DrizzleDB;
	playerId: string;
	leagueId: string;
}): Promise<PlayerAchievement[]> => {
	// Single query with join to verify player belongs to league
	const achievements = await db
		.select({
			playerId: playerAchievement.playerId,
			type: playerAchievement.type,
			createdAt: playerAchievement.createdAt,
		})
		.from(playerAchievement)
		.innerJoin(player, eq(playerAchievement.playerId, player.id))
		.where(and(eq(playerAchievement.playerId, playerId), eq(player.leagueId, leagueId)))
		.orderBy(desc(playerAchievement.createdAt));

	return achievements as PlayerAchievement[];
};

export const getLeagueBoard = async ({
	db,
	leagueId,
}: {
	db: DrizzleDB;
	leagueId: string;
}): Promise<Array<PlayerAchievement & { name: string; image: string | null }>> => {
	// Single query: every achievement in the league joined to player identity
	return db
		.select({
			playerId: playerAchievement.playerId,
			type: playerAchievement.type,
			createdAt: playerAchievement.createdAt,
			name: sql<string>`COALESCE(${user.name}, ${guest.displayName})`.as("name"),
			image: user.image,
		})
		.from(playerAchievement)
		.innerJoin(player, eq(playerAchievement.playerId, player.id))
		.leftJoin(user, eq(player.userId, user.id))
		.leftJoin(guest, eq(player.guestId, guest.id))
		.where(eq(player.leagueId, leagueId))
		.orderBy(desc(playerAchievement.createdAt));
};

export const addAchievement = async ({
	db,
	playerId,
	type,
}: {
	db: DrizzleDB;
	playerId: string;
	type: AchievementType;
}) => {
	const now = new Date();
	return db
		.insert(playerAchievement)
		.values({
			id: crypto.randomUUID(),
			playerId,
			type,
			createdAt: now,
			updatedAt: now,
		})
		.onConflictDoNothing();
};

export const awardSeasonWinner = async ({
	db,
	seasonId,
}: {
	db: DrizzleDB;
	seasonId: string;
}) => {
	// Top-scoring season players (all tied at the max score) become season winners
	const rows = await db
		.select({ playerId: seasonPlayer.playerId, score: seasonPlayer.score })
		.from(seasonPlayer)
		.where(eq(seasonPlayer.seasonId, seasonId))
		.orderBy(desc(seasonPlayer.score));

	if (rows.length === 0) return [];

	const maxScore = rows[0].score;
	const winners = rows.filter((r) => r.score === maxScore);

	const now = new Date();
	await db
		.insert(playerAchievement)
		.values(
			winners.map((w) => ({
				id: crypto.randomUUID(),
				playerId: w.playerId,
				type: "season_winner" as const,
				createdAt: now,
				updatedAt: now,
			}))
		)
		.onConflictDoNothing();

	return winners.map((w) => w.playerId);
};
```

- [ ] **Step 2: Typecheck**

Run: `bun typecheck`
Expected: PASS (no errors in worker).

- [ ] **Step 3: Commit**

```bash
git add apps/worker/src/repositories/achievement-repository.ts
git commit -m "feat(achievements): add createdAt, league board, season winner repositories"
```

---

### Task 2: `getLeagueBoard` tRPC procedure

**Files:**
- Modify: `apps/worker/src/trpc/router/achievement-router.ts`

- [ ] **Step 1: Add the procedure**

Replace the file:

```ts
import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";
import * as achievementRepository from "../../repositories/achievement-repository";
import { leagueProcedure } from "../trpc";

export const achievementRouter = {
	getByPlayerId: leagueProcedure
		.input(z.object({ playerId: z.string() }))
		.query(async ({ input, ctx }) => {
			return achievementRepository.getAchievements({
				db: ctx.db,
				playerId: input.playerId,
				leagueId: ctx.organizationId,
			});
		}),

	getLeagueBoard: leagueProcedure.query(async ({ ctx }) => {
		return achievementRepository.getLeagueBoard({
			db: ctx.db,
			leagueId: ctx.organizationId,
		});
	}),
} satisfies TRPCRouterRecord;
```

- [ ] **Step 2: Typecheck**

Run: `bun typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/worker/src/trpc/router/achievement-router.ts
git commit -m "feat(achievements): add getLeagueBoard tRPC procedure"
```

---

### Task 3: Integration tests for `getByPlayerId` createdAt + `getLeagueBoard`

**Files:**
- Create: `apps/worker/test/trpc/achievement-router.spec.ts`

- [ ] **Step 1: Write the test file**

```ts
import { env } from "cloudflare:test";
import { describe, expect, it, beforeEach } from "vitest";
import { getDb } from "../../src/db/index";
import { playerAchievement } from "../../src/db/schema/league-schema";
import { createAuthContext } from "../setup/auth-context-util";
import { createPlayers } from "../setup/season-context-util";
import { createTRPCTestClient } from "./trpc-test-client";

async function seedAchievement(playerId: string, type: "5_win_streak" | "10_win_streak") {
	const db = getDb(env.DB);
	const now = new Date();
	await db.insert(playerAchievement).values({
		id: crypto.randomUUID(),
		playerId,
		type,
		createdAt: now,
		updatedAt: now,
	});
	return now;
}

describe("achievement router", () => {
	let ctx: Awaited<ReturnType<typeof createAuthContext>>;
	let client: ReturnType<typeof createTRPCTestClient>;

	beforeEach(async () => {
		ctx = await createAuthContext();
		client = createTRPCTestClient({ sessionToken: ctx.sessionToken });
	});

	it("returns achievements with createdAt for a player", async () => {
		const [player] = await createPlayers(ctx, 2);
		const now = await seedAchievement(player.id, "5_win_streak");

		const result = await client.achievement.getByPlayerId.query({ playerId: player.id });

		expect(result).toHaveLength(1);
		expect(result[0].type).toBe("5_win_streak");
		expect(result[0].createdAt).toBeInstanceOf(Date);
		expect(result[0].createdAt.getTime()).toBeCloseTo(now.getTime(), -3);
	});

	it("returns empty list for a player with no achievements", async () => {
		const [player] = await createPlayers(ctx, 1);

		const result = await client.achievement.getByPlayerId.query({ playerId: player.id });

		expect(result).toHaveLength(0);
	});

	it("returns league board with player info", async () => {
		const players = await createPlayers(ctx, 2);
		await seedAchievement(players[0].id, "5_win_streak");
		await seedAchievement(players[0].id, "10_win_streak");
		await seedAchievement(players[1].id, "5_win_streak");

		const result = await client.achievement.getLeagueBoard.query();

		expect(result).toHaveLength(3);
		expect(result.every((r) => r.playerId === players[0].id || r.playerId === players[1].id)).toBe(
			true
		);
		expect(result.every((r) => r.name && r.createdAt instanceof Date)).toBe(true);
	});

	it("scopes league board to the current league only", async () => {
		const [player] = await createPlayers(ctx, 1);
		await seedAchievement(player.id, "5_win_streak");

		const otherCtx = await createAuthContext();
		const otherClient = createTRPCTestClient({ sessionToken: otherCtx.sessionToken });

		const result = await otherClient.achievement.getLeagueBoard.query();

		expect(result).toHaveLength(0);
	});
});
```

Note: `createPlayers(ctx, 2)` returns `player` rows (from `season-context-util.ts`), so `players[0].id` is a `player.id` — correct for `playerAchievement.playerId`.

- [ ] **Step 2: Run the tests**

Run: `bun run test --filter achievement-router`
Expected: PASS (4 tests).

- [ ] **Step 3: Commit**

```bash
git add apps/worker/test/trpc/achievement-router.spec.ts
git commit -m "test(achievements): getByPlayerId createdAt and getLeagueBoard"
```

---

### Task 4: Grant `season_winner` when a season is closed

**Files:**
- Modify: `apps/worker/src/trpc/router/season-router.ts`

- [ ] **Step 1: Add the award call in `updateClosedStatus`**

Import `achievementRepository` alongside the existing imports:

```ts
import * as seasonRepository from "../../repositories/season-repository";
import * as playerRepository from "../../repositories/player-repository";
import * as achievementRepository from "../../repositories/achievement-repository";
```

Replace the `updateClosedStatus` mutation body:

```ts
	updateClosedStatus: leagueEditorProcedure
		.input(
			z.object({
				seasonSlug: z.string(),
				closed: z.boolean(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const comp = await seasonRepository.getBySlug({
				db: ctx.db,
				seasonSlug: input.seasonSlug,
				leagueId: ctx.organizationId,
			});

			const updated = await seasonRepository.updateClosedStatus({
				db: ctx.db,
				seasonId: comp.id,
				userId: ctx.authentication.user.id,
				closed: input.closed,
			});

			if (input.closed) {
				await achievementRepository.awardSeasonWinner({
					db: ctx.db,
					seasonId: comp.id,
				});
			}

			return updated;
		}),
```

- [ ] **Step 2: Typecheck**

Run: `bun typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/worker/src/trpc/router/season-router.ts
git commit -m "feat(achievements): grant season_winner on season close"
```

---

### Task 5: Integration tests for `season_winner` on close

**Files:**
- Create: `apps/worker/test/trpc/season-router.spec.ts`

- [ ] **Step 1: Write the test file**

```ts
import { env } from "cloudflare:test";
import { describe, expect, it, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "../../src/db/index";
import { playerAchievement } from "../../src/db/schema/league-schema";
import { createAuthContext } from "../setup/auth-context-util";
import { createPlayers } from "../setup/season-context-util";
import { createTRPCTestClient } from "./trpc-test-client";

async function getAchievementTypes(playerId: string): Promise<string[]> {
	const db = getDb(env.DB);
	const rows = await db
		.select({ type: playerAchievement.type })
		.from(playerAchievement)
		.where(eq(playerAchievement.playerId, playerId));
	return rows.map((r) => r.type);
}

describe("season router — season_winner", () => {
	let ctx: Awaited<ReturnType<typeof createAuthContext>>;
	let client: ReturnType<typeof createTRPCTestClient>;

	beforeEach(async () => {
		ctx = await createAuthContext();
		client = createTRPCTestClient({ sessionToken: ctx.sessionToken });
	});

	it("grants season_winner to the top-scoring player when season is closed", async () => {
		await createPlayers(ctx, 2);
		const season = await client.season.create.mutate({
			name: "Winner Season",
			initialScore: 1000,
			scoreType: "elo",
			kFactor: 32,
			startDate: new Date(),
		});

		const standings = await client.seasonPlayer.getStanding.query({ seasonSlug: season.slug });
		const winner = standings[0];
		const loser = standings[1];

		// Winner gains elo, loser loses it
		await client.match.create.mutate({
			seasonSlug: season.slug,
			homeScore: 3,
			awayScore: 0,
			homeTeamPlayerIds: [winner.id],
			awayTeamPlayerIds: [loser.id],
		});

		await client.season.updateClosedStatus.mutate({ seasonSlug: season.slug, closed: true });

		const winnerTypes = await getAchievementTypes(winner.playerId);
		const loserTypes = await getAchievementTypes(loser.playerId);
		expect(winnerTypes).toContain("season_winner");
		expect(loserTypes).not.toContain("season_winner");
	});

	it("is idempotent when closing an already-closed season", async () => {
		await createPlayers(ctx, 2);
		const season = await client.season.create.mutate({
			name: "Winner Season",
			initialScore: 1000,
			scoreType: "elo",
			kFactor: 32,
			startDate: new Date(),
		});

		const standings = await client.seasonPlayer.getStanding.query({ seasonSlug: season.slug });
		await client.match.create.mutate({
			seasonSlug: season.slug,
			homeScore: 2,
			awayScore: 0,
			homeTeamPlayerIds: [standings[0].id],
			awayTeamPlayerIds: [standings[1].id],
		});

		await client.season.updateClosedStatus.mutate({ seasonSlug: season.slug, closed: true });
		await client.season.updateClosedStatus.mutate({ seasonSlug: season.slug, closed: true });

		const types = await getAchievementTypes(standings[0].playerId);
		expect(types.filter((t) => t === "season_winner")).toHaveLength(1);
	});

	it("does not revoke season_winner when season is reopened", async () => {
		await createPlayers(ctx, 2);
		const season = await client.season.create.mutate({
			name: "Winner Season",
			initialScore: 1000,
			scoreType: "elo",
			kFactor: 32,
			startDate: new Date(),
		});

		const standings = await client.seasonPlayer.getStanding.query({ seasonSlug: season.slug });
		await client.match.create.mutate({
			seasonSlug: season.slug,
			homeScore: 2,
			awayScore: 0,
			homeTeamPlayerIds: [standings[0].id],
			awayTeamPlayerIds: [standings[1].id],
		});

		await client.season.updateClosedStatus.mutate({ seasonSlug: season.slug, closed: true });
		const closedTypes = await getAchievementTypes(standings[0].playerId);
		expect(closedTypes).toContain("season_winner");

		// Reopening must not revoke the already-earned achievement
		await client.season.updateClosedStatus.mutate({ seasonSlug: season.slug, closed: false });
		const reopenedTypes = await getAchievementTypes(standings[0].playerId);
		expect(reopenedTypes).toContain("season_winner");
	});
});
```

- [ ] **Step 2: Run the tests**

Run: `bun run test --filter season-router`
Expected: PASS (3 tests).

- [ ] **Step 3: Commit**

```bash
git add apps/worker/test/trpc/season-router.spec.ts
git commit -m "test(achievements): season_winner on season close"
```

---
### Task 6: Achievement metadata catalog

**Files:**
- Rewrite: `apps/web/src/lib/achievements.ts`

- [ ] **Step 1: Replace the file**

```ts
import type { IconSvgElement } from "@hugeicons/react";
import {
	ArrowLeftRightIcon,
	CrownIcon,
	Fire02Icon,
	Fire03Icon,
	FireIcon,
	Shield01Icon,
	Shield02Icon,
	ShieldEnergyIcon,
	Target01Icon,
	Target02Icon,
	Target03Icon,
} from "@hugeicons/core-free-icons";

export type AchievementType =
	| "5_win_streak"
	| "10_win_streak"
	| "15_win_streak"
	| "3_win_loss_redemption"
	| "5_win_loss_redemption"
	| "8_win_loss_redemption"
	| "5_clean_sheet_streak"
	| "10_clean_sheet_streak"
	| "15_clean_sheet_streak"
	| "3_goals_5_games"
	| "5_goals_5_games"
	| "8_goals_5_games"
	| "season_winner";

export interface AchievementMetadata {
	name: string;
	description: string;
	requirement: string;
	icon: IconSvgElement;
}

export const achievementCatalog: Record<AchievementType, AchievementMetadata> = {
	"5_win_streak": {
		name: "5 Win Streak",
		description: "Win 5 matches in a row",
		requirement: "Win 5 matches in a row",
		icon: FireIcon,
	},
	"10_win_streak": {
		name: "10 Win Streak",
		description: "Win 10 matches in a row",
		requirement: "Win 10 matches in a row",
		icon: Fire02Icon,
	},
	"15_win_streak": {
		name: "15 Win Streak",
		description: "Win 15 matches in a row",
		requirement: "Win 15 matches in a row",
		icon: Fire03Icon,
	},
	"3_win_loss_redemption": {
		name: "3-Game Redemption",
		description: "Lose 3 in a row, then win 3 in a row",
		requirement: "Lose 3 in a row, then win 3 in a row",
		icon: ArrowLeftRightIcon,
	},
	"5_win_loss_redemption": {
		name: "5-Game Redemption",
		description: "Lose 5 in a row, then win 5 in a row",
		requirement: "Lose 5 in a row, then win 5 in a row",
		icon: ArrowLeftRightIcon,
	},
	"8_win_loss_redemption": {
		name: "8-Game Redemption",
		description: "Lose 8 in a row, then win 8 in a row",
		requirement: "Lose 8 in a row, then win 8 in a row",
		icon: ArrowLeftRightIcon,
	},
	"5_clean_sheet_streak": {
		name: "5 Clean Sheets",
		description: "5 straight matches without conceding",
		requirement: "5 straight matches without conceding",
		icon: Shield01Icon,
	},
	"10_clean_sheet_streak": {
		name: "10 Clean Sheets",
		description: "10 straight matches without conceding",
		requirement: "10 straight matches without conceding",
		icon: Shield02Icon,
	},
	"15_clean_sheet_streak": {
		name: "15 Clean Sheets",
		description: "15 straight matches without conceding",
		requirement: "15 straight matches without conceding",
		icon: ShieldEnergyIcon,
	},
	"3_goals_5_games": {
		name: "Goal Machine",
		description: "Score 3+ goals in 5 straight matches",
		requirement: "Score 3+ goals in 5 straight matches",
		icon: Target01Icon,
	},
	"5_goals_5_games": {
		name: "Sharpshooter",
		description: "Score 5+ goals in 5 straight matches",
		requirement: "Score 5+ goals in 5 straight matches",
		icon: Target02Icon,
	},
	"8_goals_5_games": {
		name: "Goal Overlord",
		description: "Score 8+ goals in 5 straight matches",
		requirement: "Score 8+ goals in 5 straight matches",
		icon: Target03Icon,
	},
	season_winner: {
		name: "Season Winner",
		description: "Finish a season at the top of the standings",
		requirement: "Finish a season at the top of the standings",
		icon: CrownIcon,
	},
};
```

- [ ] **Step 2: Typecheck**

Run: `bun typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/achievements.ts
git commit -m "feat(achievements): centralized achievement catalog"
```

---

### Task 7: Profile grid — earned + locked states

**Files:**
- Modify: `apps/web/src/routes/_authenticated/_sidebar/leagues/$slug/players/$leaguePlayerId/index.tsx`

- [ ] **Step 1: Update imports**

Change line 10 `import { formatAchievementName } from "@/lib/achievements";` to:

```ts
import { achievementCatalog } from "@/lib/achievements";
```

Add `cn` to the existing `@/lib/utils` import (line 9): `import { cn, truncateSlug } from "@/lib/utils";`

- [ ] **Step 2: Build the earned map after the achievements query**

Add right after the achievements `useQuery` block (currently around line 130):

```tsx
	const earnedAtMap = new Map<string, Date>(
		(achievements ?? []).map((a) => [a.type, a.createdAt])
	);
```

- [ ] **Step 3: Replace the Achievements card body**

Replace the whole `{/* Achievements */}` `<Card>` (lines ~490-528) with:

```tsx
				{/* Achievements */}
				<Card>
					<CardHeader>
						<CardTitle>Achievements</CardTitle>
						<CardDescription>Unlocked gaming milestones and accomplishments</CardDescription>
					</CardHeader>
					<CardContent>
						{achievementsLoading ? (
							<div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
								{Array.from({ length: 6 }).map((_, i) => (
									<div
										key={`achievement-skeleton-${String(i)}`}
										className="flex flex-col items-center space-y-2"
									>
										<Skeleton className="w-16 h-16 rounded-full" />
										<Skeleton className="h-4 w-20" />
									</div>
								))}
							</div>
						) : (
							<div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
								{Object.entries(achievementCatalog).map(([type, meta]) => {
									const earned = earnedAtMap.has(type);
									return (
										<div
											key={type}
											className="flex flex-col items-center space-y-2 text-center"
										>
											<div
												title={meta.description}
												className={cn(
													"w-16 h-16 rounded-full flex items-center justify-center border-2 transition-colors",
													earned
														? "bg-primary/10 border-primary/30 text-primary"
														: "bg-muted/30 border-border/50 text-muted-foreground/40 grayscale"
												)}
											>
												<HugeiconsIcon icon={meta.icon} className="size-8" />
											</div>
											<div className="space-y-0.5">
												<p
													className={cn(
														"text-sm font-medium",
														!earned && "text-muted-foreground/70"
													)}
												>
													{meta.name}
												</p>
												<p className="text-[11px] text-muted-foreground/60">
													{earned
														? new Date(earnedAtMap.get(type)!).toLocaleDateString()
														: meta.requirement}
												</p>
											</div>
										</div>
									);
								})}
							</div>
						)}
					</CardContent>
				</Card>
```

- [ ] **Step 4: Typecheck**

Run: `bun typecheck`
Expected: PASS. (`achievement.type` is the key type; `a.createdAt` comes from `getByPlayerId`.)

- [ ] **Step 5: Commit**

```bash
git add "apps/web/src/routes/_authenticated/_sidebar/leagues/$slug/players/$leaguePlayerId/index.tsx"
git commit -m "feat(achievements): earned and locked states on player profile"
```

---

### Task 8: League achievements board page

**Files:**
- Create: `apps/web/src/routes/_authenticated/_sidebar/leagues/$slug/achievements/index.tsx`

- [ ] **Step 1: Write the page**

```tsx
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useTRPC } from "@/lib/trpc";
import { truncateSlug } from "@/lib/utils";
import { achievementCatalog } from "@/lib/achievements";
import { HugeiconsIcon } from "@hugeicons/react";

export const Route = createFileRoute("/_authenticated/_sidebar/leagues/$slug/achievements/")(
	{
		component: LeagueAchievementsPage,
		loader: async ({ params }) => {
			return { slug: params.slug };
		},
	}
);

type BoardRow = {
	playerId: string;
	type: string;
	createdAt: Date;
	name: string;
	image: string | null;
};

type PlayerStats = {
	playerId: string;
	name: string;
	image: string | null;
	count: number;
	types: string[];
};

function LeagueAchievementsPage() {
	const { slug } = Route.useLoaderData();
	const trpc = useTRPC();

	const { data: rows, isLoading } = useQuery(trpc.achievement.getLeagueBoard.queryOptions());

	const byType = new Map<string, BoardRow[]>();
	const byPlayer = new Map<string, PlayerStats>();

	for (const row of rows ?? []) {
		const typeList = byType.get(row.type) ?? [];
		typeList.push(row);
		byType.set(row.type, typeList);

		const existing = byPlayer.get(row.playerId);
		if (existing) {
			existing.count += 1;
			existing.types.push(row.type);
		} else {
			byPlayer.set(row.playerId, {
				playerId: row.playerId,
				name: row.name,
				image: row.image,
				count: 1,
				types: [row.type],
			});
		}
	}

	const decorated = [...byPlayer.values()].sort((a, b) => b.count - a.count);

	return (
		<>
			<Header
				breadcrumbs={[
					{ name: "Leagues", href: "/leagues" },
					{ name: truncateSlug(slug), href: `/leagues/${slug}` },
					{ name: "Achievements" },
				]}
			/>
			<div className="flex flex-1 flex-col gap-4 p-4 pt-0">
				<Card>
					<CardHeader>
						<CardTitle>Most Decorated Players</CardTitle>
						<CardDescription>Ranked by total achievements earned</CardDescription>
					</CardHeader>
					<CardContent>
						{isLoading ? (
							<div className="space-y-3">
								{Array.from({ length: 3 }).map((_, i) => (
									<div key={`decorated-skeleton-${String(i)}`} className="flex items-center gap-3">
										<Skeleton className="h-10 w-10 rounded-lg" />
										<Skeleton className="h-4 w-40" />
									</div>
								))}
							</div>
						) : decorated.length === 0 ? (
							<p className="text-center text-muted-foreground py-8">
								No achievements earned in this league yet
							</p>
						) : (
							<div className="space-y-3">
								{decorated.map((p, index) => (
									<Link
										key={p.playerId}
										to="/leagues/$slug/players/$leaguePlayerId"
										params={{ slug, leaguePlayerId: p.playerId }}
										className="flex items-center gap-3 rounded-lg hover:bg-muted/50 p-2 transition-colors"
									>
										<span className="w-6 text-sm font-bold text-muted-foreground">
											{index + 1}
										</span>
										<Avatar className="rounded-lg">
											<AvatarImage src={p.image ?? undefined} alt={p.name} className="rounded-lg" />
											<AvatarFallback className="rounded-lg">{p.name.charAt(0)}</AvatarFallback>
										</Avatar>
										<div className="flex-1 min-w-0">
											<p className="font-medium truncate">{p.name}</p>
											<p className="text-sm text-muted-foreground truncate">
												{p.types.map((t) => achievementCatalog[t as keyof typeof achievementCatalog]?.name).filter(Boolean).join(" · ")}
											</p>
										</div>
										<span className="text-lg font-bold">{p.count}</span>
									</Link>
								))}
							</div>
						)}
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>League Achievements</CardTitle>
						<CardDescription>Who holds each achievement</CardDescription>
					</CardHeader>
					<CardContent>
						{isLoading ? (
							<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
								{Array.from({ length: 6 }).map((_, i) => (
									<Skeleton key={`board-skeleton-${String(i)}`} className="h-24 w-full" />
								))}
							</div>
						) : (
							<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
								{Object.entries(achievementCatalog).map(([type, meta]) => {
									const holders = byType.get(type) ?? [];
									return (
										<div
											key={type}
											className="rounded-lg border p-4 flex flex-col items-start gap-3"
										>
											<div className="flex items-center gap-3">
												<div
													className={
														holders.length > 0
															? "text-primary"
															: "text-muted-foreground/40 grayscale"
													}
												>
													<HugeiconsIcon icon={meta.icon} className="size-6" />
												</div>
												<div>
													<p className="text-sm font-medium">{meta.name}</p>
													<p className="text-xs text-muted-foreground">{meta.description}</p>
												</div>
											</div>
											{holders.length === 0 ? (
												<p className="text-xs text-muted-foreground">Nobody yet</p>
											) : (
												<div className="flex -space-x-2">
													{holders.map((h) => (
														<Avatar key={`${h.playerId}-${h.type}`} className="size-7 rounded-full ring-2 ring-background">
															<AvatarImage src={h.image ?? undefined} alt={h.name} className="rounded-full" />
															<AvatarFallback className="text-[10px] rounded-full">
																{h.name.charAt(0)}
															</AvatarFallback>
														</Avatar>
													))}
												</div>
											)}
										</div>
									);
								})}
							</div>
						)}
					</CardContent>
				</Card>
			</div>
		</>
	);
}
```
- [ ] **Step 2: Register the route**

Run: `bun dev` (TanStack Router code generation), then stop. If the dev server is already running, it regenerates automatically.

- [ ] **Step 3: Typecheck**

Run: `bun typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add "apps/web/src/routes/_authenticated/_sidebar/leagues/$slug/achievements/index.tsx"
git commit -m "feat(achievements): league achievements board page"
```

---

### Task 9: Sidebar "Achievements" nav entry

**Files:**
- Modify: `apps/web/src/routes/-components/sidebar/app-sidebar.tsx`

- [ ] **Step 1: Add icon import**

Add `MedalFirstPlaceIcon` to the `@hugeicons/core-free-icons` import block (line 1-8):

```ts
import {
	Activity01Icon,
	Award01Icon,
	UserMultipleIcon,
	UserIcon,
	Mail01Icon,
	ArrowRight01Icon,
	MedalFirstPlaceIcon,
} from "@hugeicons/core-free-icons";
```

- [ ] **Step 2: Add route match**

Add after `isPlayersRoute` (line 115):

```tsx
	const isAchievementsRoute = matchRoute({ to: "/leagues/$slug/achievements", fuzzy: false });
```

- [ ] **Step 3: Add the menu item**

Add after the Players `SidebarMenuItem` (after line 227):

```tsx
							<SidebarMenuItem>
								<SidebarMenuButton asChild isActive={!!isAchievementsRoute}>
									<Link
										to="/leagues/$slug/achievements"
										params={{ slug: leagueSlug }}
										onClick={handleNavClick}
									>
										<HugeiconsIcon icon={MedalFirstPlaceIcon} className="size-4" />
										<span>Achievements</span>
									</Link>
								</SidebarMenuButton>
							</SidebarMenuItem>
```

- [ ] **Step 4: Typecheck**

Run: `bun typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/routes/-components/sidebar/app-sidebar.tsx
git commit -m "feat(achievements): sidebar navigation entry"
```

---

### Task 10: Dispatch `achievement-event` for own unlocks

**Files:**
- Modify: `apps/web/src/lib/event-types.ts`
- Modify: `apps/web/src/hooks/use-season-sse.tsx`

- [ ] **Step 1: Add the event type**

In `apps/web/src/lib/event-types.ts`, add:

```ts
export interface AchievementEventDetail {
	playerId: string;
	playerName: string;
	playerImage?: string | null;
	type: string;
	timestamp?: number;
}
```

and add to `WindowEventMap`:

```ts
		"achievement-event": CustomEvent<AchievementEventDetail>;
```

- [ ] **Step 2: Dispatch on own unlock**

In `apps/web/src/hooks/use-season-sse.tsx`, replace the `achievement:unlock` block (lines ~152-163):

```tsx
					if (parsed.type === "achievement:unlock" && parsed.data?.player && parsed.data.type) {
						const { player, type } = parsed.data;
						toast.info(
							<span className="flex items-center gap-2">
								<AvatarWithFallback src={player.image} name={player.name} size="sm" />
								<span>
									{player.name} unlocked <b>{formatAchievementName(type)}</b>
								</span>
							</span>
						);
						if (player.id === currentUserId) {
							window.dispatchEvent(
								new CustomEvent("achievement-event", {
									detail: {
										playerId: player.id,
										playerName: player.name,
										playerImage: player.image,
										type,
										timestamp: Date.now(),
									},
								})
							);
						}
						return;
					}
```

- [ ] **Step 3: Typecheck**

Run: `bun typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/event-types.ts apps/web/src/hooks/use-season-sse.tsx
git commit -m "feat(achievements): dispatch achievement-event on own unlock"
```

---

### Task 11: Confetti achievement flyout

**Files:**
- Create: `apps/web/src/routes/-components/achievement-animations.css`
- Create: `apps/web/src/routes/-components/achievement-flyout.tsx`
- Modify: `apps/web/src/routes/__root.tsx`

- [ ] **Step 1: Create the confetti keyframes**

`apps/web/src/routes/-components/achievement-animations.css`:

```css
@keyframes achievement-confetti {
	0% {
		opacity: 0;
		transform: translateY(0) rotate(0deg);
	}
	10% {
		opacity: 1;
	}
	100% {
		opacity: 0;
		transform: translateY(90vh) rotate(var(--rotate, 360deg));
	}
}

@keyframes achievement-burst {
	0% {
		opacity: 0;
		transform: rotate(var(--angle, 0deg)) scaleY(0);
	}
	30% {
		opacity: 0.6;
		transform: rotate(var(--angle, 0deg)) scaleY(1);
	}
	100% {
		opacity: 0;
		transform: rotate(var(--angle, 0deg)) scaleY(1.2);
	}
}
```

- [ ] **Step 2: Create the flyout component**

`apps/web/src/routes/-components/achievement-flyout.tsx`:

```tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { achievementCatalog } from "@/lib/achievements";
import { HugeiconsIcon } from "@hugeicons/react";
import "@/lib/event-types";
import "./achievement-animations.css";

export interface AchievementFlyoutEvent {
	playerId: string;
	playerName: string;
	playerImage?: string | null;
	type: string;
	timestamp: number;
}

const CONFETTI_COLORS = [
	"#f97316",
	"#22c55e",
	"#3b82f6",
	"#eab308",
	"#a855f7",
	"#ec4899",
	"#06b6d4",
];

const CONFETTI_COUNT = 120;

function Confetti() {
	const pieces = useRef(
		Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
			id: i,
			left: Math.random() * 100,
			delay: Math.random() * 1.5,
			duration: 2.5 + Math.random() * 2,
			color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
			width: 6 + Math.random() * 6,
			height: 10 + Math.random() * 8,
			rotate: Math.random() * 360,
		}))
	).current;

	return (
		<div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
			{pieces.map((p) => (
				<div
					key={p.id}
					className="absolute"
					style={{
						left: `${p.left}%`,
						top: "-10%",
						width: p.width,
						height: p.height,
						backgroundColor: p.color,
						opacity: 0,
						borderRadius: 2,
						animation: `achievement-confetti ${p.duration}s ease-in ${p.delay}s forwards`,
						["--rotate" as string]: `${p.rotate}deg`,
					}}
				/>
			))}
		</div>
	);
}

function RadialBurst() {
	const lines = useRef(
		Array.from({ length: 36 }, (_, i) => ({
			id: i,
			angle: i * 10,
			delay: Math.random() * 0.5,
		}))
	).current;

	return (
		<div
			className="absolute inset-0 flex items-center justify-center pointer-events-none"
			aria-hidden="true"
		>
			{lines.map((l) => (
				<div
					key={l.id}
					className="absolute w-px origin-bottom bg-gradient-to-t from-fuchsia-500/60 to-transparent"
					style={
						{
							height: "40vh",
							"--angle": `${l.angle}deg`,
							opacity: 0,
							animation: `achievement-burst 0.8s ease-out ${l.delay}s forwards`,
						} as React.CSSProperties
					}
				/>
			))}
		</div>
	);
}

type Phase = "hidden" | "entering" | "visible" | "exiting";

function getEventId(event: AchievementFlyoutEvent): string {
	return `${event.playerId}-${event.type}`;
}

function getShownEvents(): Set<string> {
	if (typeof window === "undefined") return new Set();
	try {
		const stored = sessionStorage.getItem("achievement-events-shown");
		if (stored) return new Set(JSON.parse(stored));
	} catch {
		// ignore
	}
	return new Set();
}

function addShownEvent(eventId: string) {
	if (typeof window === "undefined") return;
	try {
		const shown = getShownEvents();
		shown.add(eventId);
		const arr = Array.from(shown).slice(-100);
		sessionStorage.setItem("achievement-events-shown", JSON.stringify(arr));
	} catch {
		// ignore
	}
}

export function AchievementFlyout() {
	const [currentEvent, setCurrentEvent] = useState<AchievementFlyoutEvent | null>(null);
	const [phase, setPhase] = useState<Phase>("hidden");
	const eventQueue = useRef<AchievementFlyoutEvent[]>([]);
	const isShowing = useRef(false);
	const mountTime = useRef(Date.now());
	const processRef = useRef<(() => void) | null>(null);
	const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
	const canDismiss = useRef(false);

	const clearTimers = useCallback(() => {
		for (const t of timers.current) clearTimeout(t);
		timers.current = [];
	}, []);

	const dismiss = useCallback(() => {
		if (!canDismiss.current) return;
		clearTimers();
		setPhase("exiting");
		timers.current.push(
			setTimeout(() => {
				setPhase("hidden");
				setCurrentEvent(null);
				isShowing.current = false;
				processRef.current?.();
			}, 600)
		);
	}, [clearTimers]);

	const processNext = useCallback(() => {
		if (eventQueue.current.length === 0 || isShowing.current) return;

		isShowing.current = true;
		const next = eventQueue.current.shift();
		if (!next) {
			isShowing.current = false;
			return;
		}

		setCurrentEvent(next);
		setPhase("entering");

		canDismiss.current = false;
		clearTimers();
		timers.current.push(
			setTimeout(() => {
				setPhase("visible");
				timers.current.push(
					setTimeout(() => {
						canDismiss.current = true;
					}, 1000)
				);
				timers.current.push(
					setTimeout(() => {
						setPhase("exiting");
						timers.current.push(
							setTimeout(() => {
								setPhase("hidden");
								setCurrentEvent(null);
								isShowing.current = false;
								processRef.current?.();
							}, 600)
						);
					}, 5000)
				);
			}, 600)
		);
	}, [clearTimers]);

	processRef.current = processNext;

	const queueEvent = useCallback((event: AchievementFlyoutEvent) => {
		if (event.timestamp < mountTime.current - 5000) return;

		const id = getEventId(event);
		if (getShownEvents().has(id)) return;
		addShownEvent(id);

		eventQueue.current.push(event);
		processRef.current?.();
	}, []);

	useEffect(() => {
		mountTime.current = Date.now();

		const handler = (e: Event) => {
			const detail = (e as CustomEvent<AchievementFlyoutEvent>).detail;
			if (detail?.playerId && detail?.type) queueEvent(detail);
		};

		window.addEventListener("achievement-event", handler);
		return () => window.removeEventListener("achievement-event", handler);
	}, [queueEvent]);

	if (!currentEvent || phase === "hidden") return null;

	const meta =
		achievementCatalog[currentEvent.type as keyof typeof achievementCatalog] ??
		achievementCatalog["5_win_streak"];

	return (
		<div
			className={cn(
				"fixed inset-0 z-[100] flex flex-col items-center justify-center",
				"transition-opacity duration-500",
				phase === "entering" && "opacity-0",
				phase === "visible" && "opacity-100",
				phase === "exiting" && "opacity-0 pointer-events-none"
			)}
			onClick={dismiss}
		>
			{/* Background */}
			<div className="absolute inset-0 bg-gradient-to-b from-black via-fuchsia-950/80 to-black" />

			{/* Vignette */}
			<div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_20%,black_80%)]" />

			{/* Radial burst lines */}
			{phase !== "exiting" && <RadialBurst />}

			{/* Confetti */}
			<Confetti />

			{/* Ring pulse behind icon */}
			<div
				className={cn(
					"absolute rounded-full bg-fuchsia-500/10 shadow-[0_0_120px_60px_rgba(217,70,239,0.15)]",
					"transition-all duration-700",
					phase === "entering" && "scale-0 opacity-0",
					phase === "visible" && "scale-100 opacity-100",
					phase === "exiting" && "scale-150 opacity-0"
				)}
				style={{ width: 280, height: 280 }}
			/>

			{/* Content */}
			<div className="relative z-10 flex flex-col items-center gap-6">
				<div
					className={cn(
						"transition-all duration-700 ease-out",
						phase === "entering" && "scale-0 opacity-0",
						phase === "visible" && "scale-100 opacity-100",
						phase === "exiting" && "scale-75 opacity-0"
					)}
					style={{ transitionDelay: phase === "visible" ? "100ms" : "0ms" }}
				>
					<div className="flex items-center justify-center size-36 rounded-full bg-gradient-to-br from-fuchsia-500/30 to-violet-500/30 ring-2 ring-fuchsia-400/40 text-fuchsia-300">
						<HugeiconsIcon icon={meta.icon} className="size-16" />
					</div>
				</div>

				<h1
					className={cn(
						"text-5xl sm:text-6xl font-black tracking-tighter text-center",
						"text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-fuchsia-400 to-violet-400",
						"transition-all duration-600 ease-out",
						phase === "entering" && "opacity-0 translate-y-8 scale-90",
						phase === "visible" && "opacity-100 translate-y-0 scale-100",
						phase === "exiting" && "opacity-0 -translate-y-4"
					)}
					style={{
						transitionDelay: phase === "visible" ? "250ms" : "0ms",
						textShadow: "0 0 40px rgba(217,70,239,0.5), 0 0 80px rgba(139,92,246,0.3)",
					}}
				>
					ACHIEVEMENT UNLOCKED
				</h1>

				<p
					className={cn(
						"text-xl sm:text-2xl font-bold text-white/90 text-center max-w-md",
						"transition-all duration-500",
						phase === "entering" && "opacity-0 translate-y-4",
						phase === "visible" && "opacity-100 translate-y-0",
						phase === "exiting" && "opacity-0"
					)}
					style={{ transitionDelay: phase === "visible" ? "400ms" : "0ms" }}
				>
					{currentEvent.playerName} unlocked {meta.name}
				</p>

				<div
					className={cn(
						"flex items-center gap-2 px-5 py-2.5",
						"text-sm font-bold tracking-wide uppercase",
						"bg-fuchsia-500/20 text-fuchsia-300 ring-1 ring-fuchsia-500/30",
						"transition-all duration-500",
						phase === "entering" && "opacity-0 scale-75",
						phase === "visible" && "opacity-100 scale-100",
						phase === "exiting" && "opacity-0 scale-75"
					)}
					style={{ transitionDelay: phase === "visible" ? "550ms" : "0ms" }}
				>
					{meta.description}
				</div>
			</div>
		</div>
	);
}
```

- [ ] **Step 3: Mount in the root**

In `apps/web/src/routes/__root.tsx`, add the import and component:

```tsx
import { AchievementFlyout } from "@/components/achievement-flyout";
```

and render it after `<StreakFlyout />`:

```tsx
			<StreakFlyout />
			<AchievementFlyout />
```

- [ ] **Step 4: Typecheck**

Run: `bun typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/routes/-components/achievement-animations.css apps/web/src/routes/-components/achievement-flyout.tsx apps/web/src/routes/__root.tsx
git commit -m "feat(achievements): confetti unlock flyout"
```

---

### Task 12: Full verification

- [ ] **Step 1: Lint + format + typecheck**

Run: `bun check`
Expected: PASS (oxlint, oxfmt, typecheck).

- [ ] **Step 2: Run worker tests**

Run: `bun run test`
Expected: PASS, including the new `achievement-router` and `season-router` specs.

- [ ] **Step 3: Manual UI verification (agent-browser)**

App runs at `https://scorebrawl.localhost:1355` (portless). Log in as `seed@scorebrawl.com`.

- Verify the player profile grid shows all 13 achievement types, earned ones colored with a date, locked ones dimmed with requirement text.
- Open `/leagues/{slug}/achievements` (via the sidebar "Achievements" entry): "Most Decorated Players" ranking renders and the per-type holder grid renders.
- Trigger an unlock for the logged-in user (create a match that earns an achievement) and confirm the confetti flyout + toast appear; confirm no flyout for others' unlocks (only the toast).
- Close a season and confirm the winner's profile shows `season_winner` unlocked.

- [ ] **Step 4: Final commit (if any verification fixes were made)**

```bash
git add -A
git commit -m "fix(achievements): verification fixes"
```