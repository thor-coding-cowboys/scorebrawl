# Subtle Toast Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace noisy per-event feedback after match registration with subtle, multi-tenant toast notifications driven by the existing season-scoped SSE stream.

**Architecture:** Enrich the `match:insert` SSE payload with `scoreType` + `players` (reusing `getMatchWithPlayers`), emit a new `achievement:unlock` event from the queue consumer (which now carries `leagueSlug`/`seasonSlug`), and wire subtle sonner toasts in `use-season-sse.ts`. Multi-tenancy is inherited from the existing per-league/per-season Durable Object and the season-route-scoped hook.

**Tech Stack:** TypeScript, Hono, Drizzle ORM (D1), Cloudflare Durable Objects + Queues, tRPC, React + TanStack Query/Router, sonner, Vitest (worker only).

---

## File Structure

### Worker (`apps/worker`)

- `src/services/achievement-calculation.ts` (modify) — `calculateAchievements` returns newly-earned achievements with player name/image; add `buildAchievementUnlockEvents`; extend `AchievementQueueMessage` with `leagueSlug`/`seasonSlug`.
- `src/services/match-events.ts` (create) — `buildMatchInsertData` + shared `MatchDisplayPlayer` / `SeasonScoreType` types.
- `src/durable-objects/season-sse.ts` (modify) — add `"achievement:unlock"` to `SeasonSSEEvent` union.
- `src/trpc/router/match-router.ts` (modify) — enrich `match:insert` broadcast; pass `leagueSlug`/`seasonSlug` to queue; refactor `createFromFixture` to reuse `finalizeMatchCreation`.
- `src/trpc/router/session-router.ts` (modify) — pass `leagueSlug`/`seasonSlug` to the `recordResult` queue send.
- `src/index.ts` (modify) — queue consumer broadcasts `achievement:unlock` per newly-earned achievement.

### Frontend (`apps/web`)

- `src/lib/achievements.ts` (create) — shared `formatAchievementName`.
- `src/lib/match-names.ts` (create) — shared `MatchDisplayPlayer`, `getTeamInfo`, `getSideLabel`, `buildMatchResultToast`.
- `src/routes/_authenticated/_sidebar/leagues/$slug/seasons/-components/match/match-score-display.tsx` (modify) — import shared helpers instead of local defs.
- `src/routes/_authenticated/_sidebar/leagues/$slug/seasons/-components/match/match-row.tsx` (modify) — import `MatchDisplayPlayer` from `@/lib/match-names`.
- `src/routes/_authenticated/_sidebar/leagues/$slug/seasons/-components/match/remove-match-dialog.tsx` (modify) — same.
- `src/routes/_authenticated/_sidebar/leagues/$slug/players/$leaguePlayerId/index.tsx` (modify) — import `formatAchievementName` from `@/lib/achievements`.
- `src/hooks/use-season-sse.ts` (modify) — wire the toasts.

### Tests (`apps/worker/test`)

- `test/services/achievement-calculation.spec.ts` (modify) — return-value + unlock-event tests.
- `test/services/match-events.spec.ts` (create) — enrichment integration test.

---

## Task 1: `calculateAchievements` returns newly-earned achievements

**Files:**
- Modify: `apps/worker/src/services/achievement-calculation.ts`
- Test: `apps/worker/test/services/achievement-calculation.spec.ts`

- [ ] **Step 1: Write failing tests**

Append two tests inside the existing top-level `describe("achievement calculation", ...)` block in `apps/worker/test/services/achievement-calculation.spec.ts` (after the `"away player achievements"` describe):

```ts
	describe("return value", () => {
		it("returns newly earned achievements with player info", async () => {
			const { client, season, home, away } = await setupLeagueWithSeason();

			for (let i = 0; i < 5; i++) {
				await createMatch(client, season.slug, home.id, away.id, 2, 1);
			}

			const db = getDb(env.DB);
			const result = await calculateAchievements(db, [home.id]);

			const types = result.map((a) => a.type);
			expect(types).toContain("5_win_streak");
			expect(types).not.toContain("10_win_streak");

			const winStreak = result.find((a) => a.type === "5_win_streak");
			expect(winStreak?.playerId).toBe(home.playerId);
			expect(winStreak?.name).toBeTruthy();
		});

		it("omits already-earned achievements on subsequent calls", async () => {
			const { client, season, home, away } = await setupLeagueWithSeason();

			for (let i = 0; i < 5; i++) {
				await createMatch(client, season.slug, home.id, away.id, 2, 1);
			}

			const db = getDb(env.DB);
			const first = await calculateAchievements(db, [home.id]);
			expect(first.map((a) => a.type)).toContain("5_win_streak");

			const second = await calculateAchievements(db, [home.id]);
			expect(second).toHaveLength(0);
		});
	});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --cwd apps/worker test -- achievement-calculation.spec.ts`
Expected: FAIL — `calculateAchievements` currently returns `undefined`, so `result.map` throws `TypeError: Cannot read properties of undefined`.

- [ ] **Step 3: Implement return value + player info**

Edit `apps/worker/src/services/achievement-calculation.ts`.

**3a. Replace imports** (lines 1-8):

```ts
import { sql, inArray, eq } from "drizzle-orm";
import type { DrizzleDB } from "../db";
import { user } from "../db/schema/auth-schema";
import {
	matchPlayer,
	seasonPlayer,
	playerAchievement,
	player,
	guest,
	type achievementType,
} from "../db/schema/league-schema";
```

**3b. Replace the type + message block** (lines 10-16):

```ts
type AchievementType = (typeof achievementType)[number];

type AchievementQueueMessage = {
	seasonPlayerIds: string[];
};

export type NewAchievement = {
	playerId: string;
	name: string;
	image: string | null;
	type: AchievementType;
};

export type { AchievementQueueMessage };
```

**3c. Replace the function signature** (line 33) from:

```ts
export async function calculateAchievements(db: DrizzleDB, seasonPlayerIds: string[]) {
	if (seasonPlayerIds.length === 0) return;
```

to:

```ts
export async function calculateAchievements(
	db: DrizzleDB,
	seasonPlayerIds: string[]
): Promise<NewAchievement[]> {
	if (seasonPlayerIds.length === 0) return [];
```

**3d. Replace the `playerIdMap` resolution block** (lines 119-128) from:

```ts
	// Resolve seasonPlayerId -> playerId for achievement storage
	const playerIdMap = await db
		.select({
			seasonPlayerId: seasonPlayer.id,
			playerId: seasonPlayer.playerId,
		})
		.from(seasonPlayer)
		.where(inArray(seasonPlayer.id, seasonPlayerIds));

	const seasonToPlayerMap = new Map(playerIdMap.map((p) => [p.seasonPlayerId, p.playerId]));
```

to:

```ts
	// Resolve seasonPlayerId -> player info for achievement storage + broadcast
	const playerInfo = await db
		.select({
			seasonPlayerId: seasonPlayer.id,
			playerId: seasonPlayer.playerId,
			name: sql<string>`COALESCE(${user.name}, ${guest.displayName})`.as("name"),
			image: user.image,
		})
		.from(seasonPlayer)
		.innerJoin(player, eq(seasonPlayer.playerId, player.id))
		.leftJoin(user, eq(player.userId, user.id))
		.leftJoin(guest, eq(player.guestId, guest.id))
		.where(inArray(seasonPlayer.id, seasonPlayerIds));

	const seasonToPlayerMap = new Map(playerInfo.map((p) => [p.seasonPlayerId, p]));
```

**3e. Replace the declaration and loop-push** (lines 141-192). Change `achievementsToInsert` type and the two places referencing `playerId`:

From:

```ts
	// Calculate achievements per player
	const achievementsToInsert: { playerId: string; type: AchievementType }[] = [];

	for (const spId of seasonPlayerIds) {
		const playerId = seasonToPlayerMap.get(spId);
		if (!playerId) continue;
```

to:

```ts
	// Calculate achievements per player
	const achievementsToInsert: NewAchievement[] = [];

	for (const spId of seasonPlayerIds) {
		const info = seasonToPlayerMap.get(spId);
		if (!info) continue;
```

And the push (lines 189-191), from:

```ts
		for (const achievement of earned) {
			achievementsToInsert.push({ playerId, type: achievement });
		}
```

to:

```ts
		for (const achievement of earned) {
			achievementsToInsert.push({
				playerId: info.playerId,
				name: info.name,
				image: info.image,
				type: achievement,
			});
		}
```

**3f. Replace the batch insert block** (lines 194-210) from:

```ts
	// Batch insert all achievements (idempotent via onConflictDoNothing)
	if (achievementsToInsert.length > 0) {
		const now = new Date();
		await db
			.insert(playerAchievement)
			.values(
				achievementsToInsert.map((a) => ({
					id: crypto.randomUUID(),
					playerId: a.playerId,
					type: a.type,
					createdAt: now,
					updatedAt: now,
				}))
			)
			.onConflictDoNothing();
	}
}
```

to:

```ts
	// Filter out achievements already earned (idempotent, no re-broadcast)
	const playerIds = [...new Set(achievementsToInsert.map((a) => a.playerId))];
	const existing = playerIds.length
		? await db
				.select({ playerId: playerAchievement.playerId, type: playerAchievement.type })
				.from(playerAchievement)
				.where(inArray(playerAchievement.playerId, playerIds))
		: [];
	const existingSet = new Set(existing.map((e) => `${e.playerId}:${e.type}`));
	const newAchievements = achievementsToInsert.filter(
		(a) => !existingSet.has(`${a.playerId}:${a.type}`)
	);

	if (newAchievements.length > 0) {
		const now = new Date();
		await db
			.insert(playerAchievement)
			.values(
				newAchievements.map((a) => ({
					id: crypto.randomUUID(),
					playerId: a.playerId,
					type: a.type,
					createdAt: now,
					updatedAt: now,
				}))
			)
			.onConflictDoNothing();
	}

	return newAchievements;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run --cwd apps/worker test -- achievement-calculation.spec.ts`
Expected: PASS (all existing + the two new tests).

- [ ] **Step 5: Commit**

```bash
git add apps/worker/src/services/achievement-calculation.ts apps/worker/test/services/achievement-calculation.spec.ts
git commit -m "feat: return newly-earned achievements from calculateAchievements"
```

---

## Task 2: `achievement:unlock` SSE event + queue consumer broadcast

**Files:**
- Modify: `apps/worker/src/durable-objects/season-sse.ts`
- Modify: `apps/worker/src/services/achievement-calculation.ts`
- Modify: `apps/worker/src/trpc/router/match-router.ts`
- Modify: `apps/worker/src/trpc/router/session-router.ts`
- Modify: `apps/worker/src/index.ts`
- Test: `apps/worker/test/services/achievement-calculation.spec.ts`

- [ ] **Step 1: Add `buildAchievementUnlockEvents` + extend message type**

In `apps/worker/src/services/achievement-calculation.ts`, replace the type block (added in Task 1):

```ts
type AchievementQueueMessage = {
	seasonPlayerIds: string[];
};

export type NewAchievement = {
	playerId: string;
	name: string;
	image: string | null;
	type: AchievementType;
};

export type { AchievementQueueMessage };
```

with:

```ts
export type AchievementQueueMessage = {
	seasonPlayerIds: string[];
	leagueSlug: string;
	seasonSlug: string;
};

export type NewAchievement = {
	playerId: string;
	name: string;
	image: string | null;
	type: AchievementType;
};

export function buildAchievementUnlockEvents(
	newAchievements: NewAchievement[]
): Array<{
	type: "achievement:unlock";
	data: { player: { id: string; name: string; image: string | null }; type: AchievementType };
}> {
	return newAchievements.map((a) => ({
		type: "achievement:unlock",
		data: {
			player: { id: a.playerId, name: a.name, image: a.image },
			type: a.type,
		},
	}));
}
```

- [ ] **Step 2: Add `achievement:unlock` to the SSE event union**

Edit `apps/worker/src/durable-objects/season-sse.ts` (lines 3-18):

```ts
export interface SeasonSSEEvent {
	type:
		| "match:insert"
		| "match:delete"
		| "standings:update"
		| "streak"
		| "session:start"
		| "session:end"
		| "session:update"
		| "achievement:unlock"
		| "connected";
	data: unknown;
	user?: {
		id: string;
		name: string;
	};
}
```

- [ ] **Step 3: Wire queue consumer broadcast**

Edit `apps/worker/src/index.ts`.

**3a. Update imports** — add `broadcastSeasonEvent` to the sse-router import (line 12):

```ts
import { sseRouter, broadcastSeasonEvent } from "./routes/sse-router";
```

**3b. Replace the queue handler** (lines 40-61) with:

```ts
	async queue(batch: MessageBatch<AchievementQueueMessage | SeedInput>, env: Env) {
		const db = getDb(env.DB);
		for (const msg of batch.messages) {
			try {
				const body = msg.body;
				if ("seasonPlayerIds" in body) {
					const newAchievements = await calculateAchievements(db, body.seasonPlayerIds);
					for (const event of buildAchievementUnlockEvents(newAchievements)) {
						await broadcastSeasonEvent(env, body.leagueSlug, body.seasonSlug, event);
					}
				} else if ("leagueSlug" in body) {
					if (!env.SEED_ALLOWED) {
						console.warn("[Seed Queue] SEED_ALLOWED not set, skipping seed job");
						msg.ack();
						continue;
					}
					await seedLeague(db, body);
				}
				msg.ack();
			} catch (error) {
				console.error("[Queue] Failed to process message:", error);
				msg.retry();
			}
		}
	},
```

**3c. Update the import of `calculateAchievements`** (lines 14-17) to also import `buildAchievementUnlockEvents`:

```ts
import {
	calculateAchievements,
	buildAchievementUnlockEvents,
	type AchievementQueueMessage,
} from "./services/achievement-calculation";
```

- [ ] **Step 4: Pass `leagueSlug`/`seasonSlug` in match-router queue sends**

Edit `apps/worker/src/trpc/router/match-router.ts`.

**4a.** In `finalizeMatchCreation`, replace the queue send (lines 164-166):

```ts
	await ctx.env.ACHIEVEMENT_QUEUE.send({
		seasonPlayerIds,
	} satisfies AchievementQueueMessage);
```

with:

```ts
	await ctx.env.ACHIEVEMENT_QUEUE.send({
		seasonPlayerIds,
		leagueSlug: ctx.organization.slug,
		seasonSlug,
	} satisfies AchievementQueueMessage);
```

**4b.** In `createFromFixture`, replace the queue send (lines 277-281):

```ts
			// Dispatch achievement calculation
			const seasonPlayerIds = [fixture.homePlayerId, fixture.awayPlayerId];
			await ctx.env.ACHIEVEMENT_QUEUE.send({
				seasonPlayerIds,
			} satisfies AchievementQueueMessage);
```

with:

```ts
			// Dispatch achievement calculation
			const seasonPlayerIds = [fixture.homePlayerId, fixture.awayPlayerId];
			await ctx.env.ACHIEVEMENT_QUEUE.send({
				seasonPlayerIds,
				leagueSlug: ctx.organization.slug,
				seasonSlug: input.seasonSlug,
			} satisfies AchievementQueueMessage);
```

- [ ] **Step 5: Pass `leagueSlug`/`seasonSlug` in session-router queue send**

Edit `apps/worker/src/trpc/router/session-router.ts` (lines 290-295):

```ts
			await ctx.env.ACHIEVEMENT_QUEUE.send({
				seasonPlayerIds: [
					...result.streakData.homeSeasonPlayerIds,
					...result.streakData.awaySeasonPlayerIds,
				],
			} satisfies AchievementQueueMessage);
```

to:

```ts
			await ctx.env.ACHIEVEMENT_QUEUE.send({
				seasonPlayerIds: [
					...result.streakData.homeSeasonPlayerIds,
					...result.streakData.awaySeasonPlayerIds,
				],
				leagueSlug: ctx.organization.slug,
				seasonSlug: sessionInfo.seasonSlug,
			} satisfies AchievementQueueMessage);
```

- [ ] **Step 6: Write test for `buildAchievementUnlockEvents`**

In `apps/worker/test/services/achievement-calculation.spec.ts`, add `buildAchievementUnlockEvents` to the import (line 6):

```ts
import {
	calculateAchievements,
	buildAchievementUnlockEvents,
} from "../../src/services/achievement-calculation";
```

Append inside the top-level describe:

```ts
	describe("buildAchievementUnlockEvents", () => {
		it("maps newly-earned achievements to unlock events", () => {
			const events = buildAchievementUnlockEvents([
				{ playerId: "p1", name: "Alice", image: null, type: "5_win_streak" },
			]);

			expect(events).toEqual([
				{
					type: "achievement:unlock",
					data: {
						player: { id: "p1", name: "Alice", image: null },
						type: "5_win_streak",
					},
				},
			]);
		});

		it("returns an empty array when there are no new achievements", () => {
			expect(buildAchievementUnlockEvents([])).toEqual([]);
		});
	});
```

- [ ] **Step 7: Run tests + typecheck**

Run: `bun run --cwd apps/worker test -- achievement-calculation.spec.ts`
Expected: PASS.

Run: `bun typecheck`
Expected: PASS (no type errors from the message/queue changes).

- [ ] **Step 8: Commit**

```bash
git add apps/worker/src/durable-objects/season-sse.ts apps/worker/src/services/achievement-calculation.ts apps/worker/src/trpc/router/match-router.ts apps/worker/src/trpc/router/session-router.ts apps/worker/src/index.ts apps/worker/test/services/achievement-calculation.spec.ts
git commit -m "feat: emit achievement:unlock SSE event from queue consumer"
```

---

## Task 3: `match:insert` payload enrichment

**Files:**
- Create: `apps/worker/src/services/match-events.ts`
- Modify: `apps/worker/src/trpc/router/match-router.ts`
- Test: `apps/worker/test/services/match-events.spec.ts`

- [ ] **Step 1: Write failing test**

Create `apps/worker/test/services/match-events.spec.ts`:

```ts
import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { getDb } from "../../src/db/index";
import * as seasonPlayerRepository from "../../src/repositories/season-player-repository";
import { buildMatchInsertData } from "../../src/services/match-events";
import { createAuthContext } from "../setup/auth-context-util";
import { createPlayers } from "../setup/season-context-util";
import { createTRPCTestClient } from "../trpc/trpc-test-client";

describe("buildMatchInsertData", () => {
	it("includes scoreType and player names for a 1v1 match", async () => {
		const ctx = await createAuthContext();
		const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });
		await createPlayers(ctx, 2);
		const season = await client.season.create.mutate({
			name: "Enrich Test Season",
			initialScore: 1000,
			scoreType: "elo",
			kFactor: 32,
			startDate: new Date(),
		});
		const seasonPlayers = await client.seasonPlayer.getAll.query({ seasonSlug: season.slug });
		const match = await client.match.create.mutate({
			seasonSlug: season.slug,
			homeScore: 2,
			awayScore: 1,
			homeTeamPlayerIds: [seasonPlayers[0].id],
			awayTeamPlayerIds: [seasonPlayers[1].id],
		});

		const db = getDb(env.DB);
		const standings = await seasonPlayerRepository.getStanding({ db, seasonId: season.id });
		const data = await buildMatchInsertData(db, {
			match,
			scoreType: "elo",
			standings,
		});

		expect(data.scoreType).toBe("elo");
		expect(data.players).toHaveLength(2);
		expect(data.players.every((p) => p.name.length > 0)).toBe(true);
		expect(data.match.id).toBe(match.id);
		expect(data.standings.length).toBe(2);
	});

	it("includes team names for a 2v2 match", async () => {
		const ctx = await createAuthContext();
		const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });
		await createPlayers(ctx, 4);
		const season = await client.season.create.mutate({
			name: "Enrich 2v2 Season",
			initialScore: 1000,
			scoreType: "elo",
			kFactor: 32,
			startDate: new Date(),
		});
		const seasonPlayers = await client.seasonPlayer.getAll.query({ seasonSlug: season.slug });
		const match = await client.match.create.mutate({
			seasonSlug: season.slug,
			homeScore: 3,
			awayScore: 2,
			homeTeamPlayerIds: [seasonPlayers[0].id, seasonPlayers[1].id],
			awayTeamPlayerIds: [seasonPlayers[2].id, seasonPlayers[3].id],
		});

		const db = getDb(env.DB);
		const standings = await seasonPlayerRepository.getStanding({ db, seasonId: season.id });
		const data = await buildMatchInsertData(db, {
			match,
			scoreType: "elo",
			standings,
		});

		const home = data.players.filter((p) => p.homeTeam);
		const away = data.players.filter((p) => !p.homeTeam);
		expect(home).toHaveLength(2);
		expect(away).toHaveLength(2);
		expect(home.every((p) => p.teamName !== null)).toBe(true);
		expect(away.every((p) => p.teamName !== null)).toBe(true);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run --cwd apps/worker test -- match-events.spec.ts`
Expected: FAIL — `Cannot find module '../../src/services/match-events'`.

- [ ] **Step 3: Implement `buildMatchInsertData`**

Create `apps/worker/src/services/match-events.ts`:

```ts
import type { DrizzleDB } from "../db";
import type { scoreType } from "../db/schema/league-schema";
import * as matchRepository from "../repositories/match-repository";
import * as seasonPlayerRepository from "../repositories/season-player-repository";

export type SeasonScoreType = (typeof scoreType)[number];

export type Standing = Awaited<ReturnType<typeof seasonPlayerRepository.getStanding>>;

export interface MatchDisplayPlayer {
	id: string;
	name: string;
	image: string | null;
	teamName: string | null;
	teamLogo: string | null;
	homeTeam: boolean;
}

export interface MatchInsertData {
	match: {
		id: string;
		seasonId: string;
		homeScore: number;
		awayScore: number;
		createdAt: Date;
	};
	scoreType: SeasonScoreType;
	players: MatchDisplayPlayer[];
	standings: Standing;
}

export async function buildMatchInsertData(
	db: DrizzleDB,
	opts: {
		match: MatchInsertData["match"];
		scoreType: SeasonScoreType;
		standings: Standing;
	}
): Promise<MatchInsertData> {
	const matchWithPlayers = await matchRepository.getMatchWithPlayers({ db, matchId: opts.match.id });
	return {
		match: opts.match,
		scoreType: opts.scoreType,
		players: matchWithPlayers?.players ?? [],
		standings: opts.standings,
	};
}
```

- [ ] **Step 4: Wire into `match-router.ts`**

Edit `apps/worker/src/trpc/router/match-router.ts`.

**4a. Add import** (after the existing `broadcastSeasonEvent` import, line 8):

```ts
import { broadcastSeasonEvent } from "../../routes/sse-router";
import type { AchievementQueueMessage } from "../../services/achievement-calculation";
import { buildMatchInsertData, type SeasonScoreType } from "../../services/match-events";
```

**4b. Replace `finalizeMatchCreation`** (lines 102-169) with the enriched version:

```ts
async function finalizeMatchCreation({
	ctx,
	seasonSlug,
	seasonId,
	createdMatch,
	seasonPlayerIds,
	scoreType,
}: {
	ctx: {
		db: Parameters<typeof seasonPlayerRepository.getStanding>[0]["db"];
		env: Pick<Env, "SEASON_SSE" | "ACHIEVEMENT_QUEUE">;
		waitUntil: (promise: Promise<unknown>) => void;
		organization: { slug: string };
		authentication: { user: { id: string; name: string } };
	};
	seasonSlug: string;
	seasonId: string;
	createdMatch: {
		id: string;
		seasonId: string;
		homeScore: number;
		awayScore: number;
		createdAt: Date;
	};
	seasonPlayerIds: string[];
	scoreType: SeasonScoreType;
}) {
	const standings = await seasonPlayerRepository.getStanding({
		db: ctx.db,
		seasonId,
	});

	const data = await buildMatchInsertData(ctx.db, {
		match: createdMatch,
		scoreType,
		standings,
	});

	ctx.waitUntil(
		broadcastSeasonEvent(ctx.env, ctx.organization.slug, seasonSlug, {
			type: "match:insert",
			data,
			user: {
				id: ctx.authentication.user.id,
				name: ctx.authentication.user.name,
			},
		})
	);

	const [streakPlayers, streakTeams] = await Promise.all([
		matchRepository.checkStreakThresholds({
			db: ctx.db,
			seasonPlayerIds,
		}),
		matchRepository.checkTeamStreakThresholds({
			db: ctx.db,
			matchId: createdMatch.id,
		}),
	]);

	broadcastStreakEvents(
		ctx.waitUntil.bind(ctx),
		ctx.env,
		ctx.organization.slug,
		seasonSlug,
		streakPlayers,
		streakTeams,
		{
			id: ctx.authentication.user.id,
			name: ctx.authentication.user.name,
		}
	);

	await ctx.env.ACHIEVEMENT_QUEUE.send({
		seasonPlayerIds,
		leagueSlug: ctx.organization.slug,
		seasonSlug,
	} satisfies AchievementQueueMessage);

	return createdMatch;
}
```

**4c. Refactor `createFromFixture`** — replace lines 234-283 (the inline standings/broadcast/streak/queue block) with a single call. The block to remove starts at:

```ts
			const standings = await seasonPlayerRepository.getStanding({
				db: ctx.db,
				seasonId: season.id,
			});

			ctx.waitUntil(
				broadcastSeasonEvent(ctx.env, ctx.organization.slug, input.seasonSlug, {
					type: "match:insert",
					data: {
						match: createdMatch,
						standings,
					},
					user: {
						id: ctx.authentication.user.id,
						name: ctx.authentication.user.name,
					},
				})
			);

			const [streakPlayers, streakTeams] = await Promise.all([
				matchRepository.checkStreakThresholds({
					db: ctx.db,
					seasonPlayerIds: [fixture.homePlayerId, fixture.awayPlayerId],
				}),
				matchRepository.checkTeamStreakThresholds({
					db: ctx.db,
					matchId: createdMatch.id,
				}),
			]);

			broadcastStreakEvents(
				ctx.waitUntil.bind(ctx),
				ctx.env,
				ctx.organization.slug,
				input.seasonSlug,
				streakPlayers,
				streakTeams,
				{
					id: ctx.authentication.user.id,
					name: ctx.authentication.user.name,
				}
			);

			// Dispatch achievement calculation
			const seasonPlayerIds = [fixture.homePlayerId, fixture.awayPlayerId];
			await ctx.env.ACHIEVEMENT_QUEUE.send({
				seasonPlayerIds,
				leagueSlug: ctx.organization.slug,
				seasonSlug: input.seasonSlug,
			} satisfies AchievementQueueMessage);

			return createdMatch;
```

Replace it with:

```ts
			return finalizeMatchCreation({
				ctx,
				seasonSlug: input.seasonSlug,
				seasonId: season.id,
				createdMatch,
				seasonPlayerIds: [fixture.homePlayerId, fixture.awayPlayerId],
				scoreType: season.scoreType,
			});
```

**4d. Add `scoreType` to the `create` call site** (lines 354-362):

```ts
				.then(async (createdMatch) =>
					finalizeMatchCreation({
						ctx,
						seasonSlug: input.seasonSlug,
						seasonId: comp.id,
						createdMatch,
						seasonPlayerIds: [...input.homeTeamPlayerIds, ...input.awayTeamPlayerIds],
						scoreType: comp.scoreType,
					})
				);
```

**4e. Add `scoreType` to the `createOneVn` call site** (lines 458-464):

```ts
			return finalizeMatchCreation({
				ctx,
				seasonSlug: input.seasonSlug,
				seasonId: comp.id,
				createdMatch,
				seasonPlayerIds: allIds,
				scoreType: comp.scoreType,
			});
```

- [ ] **Step 5: Run tests + typecheck**

Run: `bun run --cwd apps/worker test -- match-events.spec.ts`
Expected: PASS.

Run: `bun run --cwd apps/worker test -- match-router.spec.ts`
Expected: PASS (existing match-router behavior unchanged).

Run: `bun typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/worker/src/services/match-events.ts apps/worker/src/trpc/router/match-router.ts apps/worker/test/services/match-events.spec.ts
git commit -m "feat: enrich match:insert SSE payload with scoreType and players"
```

---

## Task 4: Frontend shared helpers + refactor

**Files:**
- Create: `apps/web/src/lib/achievements.ts`
- Create: `apps/web/src/lib/match-names.ts`
- Modify: `apps/web/src/routes/_authenticated/_sidebar/leagues/$slug/seasons/-components/match/match-score-display.tsx`
- Modify: `apps/web/src/routes/_authenticated/_sidebar/leagues/$slug/seasons/-components/match/match-row.tsx`
- Modify: `apps/web/src/routes/_authenticated/_sidebar/leagues/$slug/seasons/-components/match/remove-match-dialog.tsx`
- Modify: `apps/web/src/routes/_authenticated/_sidebar/leagues/$slug/players/$leaguePlayerId/index.tsx`

- [ ] **Step 1: Create `apps/web/src/lib/achievements.ts`**

```ts
export function formatAchievementName(type: string): string {
	return type.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}
```

- [ ] **Step 2: Create `apps/web/src/lib/match-names.ts`**

```ts
export interface MatchDisplayPlayer {
	id: string;
	name: string;
	image: string | null;
	teamName: string | null;
	teamLogo: string | null;
	homeTeam: boolean;
}

export function getTeamInfo(
	players: MatchDisplayPlayer[]
): { name: string; logo: string | null } | null {
	if (players.length <= 1) return null;
	const teamName = players[0]?.teamName;
	const teamLogo = players[0]?.teamLogo ?? null;
	if (teamName) return { name: teamName, logo: teamLogo };
	return { name: players.map((p) => p.name.split(" ")[0]).join(" & "), logo: teamLogo };
}

export function getSideLabel(players: MatchDisplayPlayer[]): string {
	if (players.length === 0) return "Unknown";
	const teamInfo = getTeamInfo(players);
	if (teamInfo) return teamInfo.name;
	return players.map((p) => p.name).join(", ");
}

export function buildMatchResultToast(opts: {
	scoreType: string;
	players: MatchDisplayPlayer[];
	homeScore: number;
	awayScore: number;
}): string {
	const home = opts.players.filter((p) => p.homeTeam);
	const away = opts.players.filter((p) => !p.homeTeam);

	if (opts.scoreType === "1-v-n-elo") {
		return `${getSideLabel(home)} won the match`;
	}

	return `${getSideLabel(home)} ${opts.homeScore}–${opts.awayScore} ${getSideLabel(away)}`;
}
```

- [ ] **Step 3: Refactor `match-score-display.tsx` to import shared helpers**

Edit `apps/web/src/routes/_authenticated/_sidebar/leagues/$slug/seasons/-components/match/match-score-display.tsx`:

**3a.** Add import at top (after the existing imports, line 5):

```ts
import { getTeamInfo, getSideLabel, type MatchDisplayPlayer } from "@/lib/match-names";
```

**3b.** Remove the local definitions of `MatchDisplayPlayer`, `getTeamInfo`, `getSideLabel` (lines 37-59):

```ts
export interface MatchDisplayPlayer {
	id: string;
	name: string;
	image: string | null;
	teamName: string | null;
	teamLogo: string | null;
	homeTeam: boolean;
}

function getTeamInfo(players: MatchDisplayPlayer[]): { name: string; logo: string | null } | null {
	if (players.length <= 1) return null;
	const teamName = players[0]?.teamName;
	const teamLogo = players[0]?.teamLogo ?? null;
	if (teamName) return { name: teamName, logo: teamLogo };
	return { name: players.map((p) => p.name.split(" ")[0]).join(" & "), logo: teamLogo };
}

function getSideLabel(players: MatchDisplayPlayer[]): string {
	if (players.length === 0) return "Unknown";
	const teamInfo = getTeamInfo(players);
	if (teamInfo) return teamInfo.name;
	return players.map((p) => p.name).join(", ");
}
```

**3c.** Add a re-export so the existing consumers keep working without further churn (optional but safe):

```ts
export type { MatchDisplayPlayer } from "@/lib/match-names";
```

- [ ] **Step 4: Update the two consumer imports**

Edit `apps/web/src/routes/_authenticated/_sidebar/leagues/$slug/seasons/-components/match/match-row.tsx` line 1, from:

```ts
import { MatchScoreDisplay, type MatchDisplayPlayer } from "./match-score-display";
```

to:

```ts
import { MatchScoreDisplay } from "./match-score-display";
import type { MatchDisplayPlayer } from "@/lib/match-names";
```

Edit `apps/web/src/routes/_authenticated/_sidebar/leagues/$slug/seasons/-components/match/remove-match-dialog.tsx` line 10, from:

```ts
import { MatchScoreDisplay, type MatchDisplayPlayer } from "./match-score-display";
```

to:

```ts
import { MatchScoreDisplay } from "./match-score-display";
import type { MatchDisplayPlayer } from "@/lib/match-names";
```

- [ ] **Step 5: Refactor player detail page to use shared `formatAchievementName`**

Edit `apps/web/src/routes/_authenticated/_sidebar/leagues/$slug/players/$leaguePlayerId/index.tsx`:

**5a.** Add import (after the existing `@/lib/utils` import, line 9):

```ts
import { truncateSlug } from "@/lib/utils";
import { formatAchievementName } from "@/lib/achievements";
```

**5b.** Remove the local function (lines 716-718):

```ts
function formatAchievementName(type: string): string {
	return type.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}
```

- [ ] **Step 6: Lint, format, typecheck**

Run: `bun oxc`
Run: `bun typecheck`
Expected: both PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/achievements.ts apps/web/src/lib/match-names.ts apps/web/src/routes/_authenticated/_sidebar/leagues/\$slug/seasons/-components/match/match-score-display.tsx apps/web/src/routes/_authenticated/_sidebar/leagues/\$slug/seasons/-components/match/match-row.tsx apps/web/src/routes/_authenticated/_sidebar/leagues/\$slug/seasons/-components/match/remove-match-dialog.tsx apps/web/src/routes/_authenticated/_sidebar/leagues/\$slug/players/\$leaguePlayerId/index.tsx
git commit -m "refactor: extract shared match naming and achievement helpers"
```

---

## Task 5: Frontend toast wiring in `use-season-sse.ts`

**Files:**
- Modify: `apps/web/src/hooks/use-season-sse.ts`

- [ ] **Step 1: Add imports**

Edit the imports at the top of `apps/web/src/hooks/use-season-sse.ts`:

```ts
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc";
import { buildMatchResultToast, type MatchDisplayPlayer } from "@/lib/match-names";
import { formatAchievementName } from "@/lib/achievements";
import { AvatarWithFallback } from "@/components/ui/avatar-with-fallback";
import "@/lib/event-types";
```

- [ ] **Step 2: Extend the `MatchData` type**

Replace the `MatchData` type (lines 21-46) with:

```ts
type MatchData = {
	match?: {
		id: string;
		seasonId: string;
		homeScore: number;
		awayScore: number;
		createdAt: Date;
	};
	matchId?: string;
	scoreType?: string;
	players?: MatchDisplayPlayer[];
	standings?: Array<{
		id: string;
		seasonId: string;
		playerId: string;
		score: number;
		name: string;
		image: string | null;
		userId: string;
		matchCount: number;
		winCount: number;
		lossCount: number;
		drawCount: number;
		rank: number;
		pointDiff: number;
		form: Array<"W" | "D" | "L">;
	}>;
};
```

- [ ] **Step 3: Extend the `SeasonSSEEvent` type**

Replace the `SeasonSSEEvent` type (lines 48-56) with:

```ts
export type SeasonSSEEvent =
	| { type: "connected"; user?: { id: string; name: string } }
	| { type: "streak"; user?: { id: string; name: string }; data: StreakData }
	| { type: "session:start"; user?: { id: string; name: string }; data: SessionData }
	| { type: "session:update"; user?: { id: string; name: string }; data: SessionData }
	| { type: "session:end"; user?: { id: string; name: string }; data: SessionData }
	| { type: "match:insert"; user?: { id: string; name: string }; data?: MatchData }
	| { type: "match:delete"; user?: { id: string; name: string }; data?: MatchData }
	| { type: "standings:update"; user?: { id: string; name: string }; data?: MatchData }
	| {
			type: "achievement:unlock";
			data?: {
				player?: { id: string; name: string; image: string | null };
				type?: string;
			};
	  };
```

- [ ] **Step 4: Add session start/end toasts**

In the session branch (lines 140-173), add toasts just before the `return`:

```ts
					if (
						parsed.type === "session:start" ||
						parsed.type === "session:update" ||
						parsed.type === "session:end"
					) {
						const sessionId = parsed.data?.sessionId ?? parsed.data?.session?.id;
						window.dispatchEvent(
							new CustomEvent("session-event", {
								detail: { type: parsed.type, sessionId, userName: parsed.user?.name },
							})
						);

						if (sessionId) {
							qc.invalidateQueries({
								queryKey: t.session.getById.queryKey({ sessionId }),
							});
						}
						qc.invalidateQueries({
							queryKey: t.session.getActive.queryKey({ seasonSlug }),
						});

						if (parsed.type === "session:update" || parsed.type === "session:end") {
							qc.invalidateQueries({
								queryKey: t.seasonPlayer.getStanding.queryKey({ seasonSlug }),
							});
							qc.invalidateQueries({
								queryKey: t.seasonTeam.getStanding.queryKey({ seasonSlug }),
							});
							qc.invalidateQueries({
								queryKey: t.match.getLatest.queryKey({ seasonSlug }),
							});
						}

						if (!isOwnEvent && parsed.user) {
							if (parsed.type === "session:start") {
								toast.info(`${parsed.user.name} started a session`);
							} else if (parsed.type === "session:end") {
								toast.info(`${parsed.user.name} ended a session`);
							}
						}
						return;
					}
```

- [ ] **Step 5: Add the `achievement:unlock` branch**

Add the following branch immediately after the streak branch's `return` (after line 138) and before the session branch:

```ts
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
						return;
					}
```

- [ ] **Step 6: Replace the match toast section**

Replace lines 202-208:

```ts
					if (parsed.user && parsed.user.id !== currentUserId) {
						if (parsed.type === "match:insert") {
							toast.info(`${parsed.user.name} registered a match`);
						} else if (parsed.type === "match:delete") {
							toast.info(`${parsed.user.name} deleted a match`);
						}
					}
```

with:

```ts
					if (parsed.user && parsed.user.id !== currentUserId) {
						if (parsed.type === "match:insert") {
							toast.info(
								buildMatchResultToast({
									scoreType: parsed.data?.scoreType ?? "",
									players: parsed.data?.players ?? [],
									homeScore: parsed.data?.match?.homeScore ?? 0,
									awayScore: parsed.data?.match?.awayScore ?? 0,
								})
							);
						} else if (parsed.type === "match:delete") {
							toast.info(`${parsed.user.name} deleted a match`);
						}
					}
```

- [ ] **Step 7: Lint, format, typecheck**

Run: `bun oxc`
Run: `bun typecheck`
Expected: both PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/hooks/use-season-sse.ts
git commit -m "feat: wire subtle toasts for match, session, and achievement events"
```

---

## Task 6: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Full check + tests**

Run: `bun check && bun run test`
Expected: typecheck, lint, format, and all worker vitest suites PASS.

- [ ] **Step 2: Manual UI verification (agent-browser)**

Use the `agent-browser` skill. App runs at `https://scorebrawl.localhost:1355`. Log in as `seed@scorebrawl.com`. Confirm acceptance criteria:
- Registering a match shows a result toast ("TeamA 3–2 TeamB", "Alice & Bob 3–2 Carol & Dan", or "Alice won the match" for 1-v-n) to other users viewing that league/season.
- A newly earned achievement triggers a toast with the player + achievement name.
- Session start/end show subtle toasts.
- StreakFlyout still fires on 5/10/15 streak crossings.
- Toasts never appear for users who don't have that league/season open.

- [ ] **Step 3: Final commit (if manual checks required edits)**

```bash
git add -A
git commit -m "chore: verification fixes"
```
