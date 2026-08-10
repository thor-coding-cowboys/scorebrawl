# 1-v-N ELO Darts Season Type Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `1-v-n-elo` season type so office darts games (301/501, Cricket, Shanghai, Gotcha) with a single winner among 2–6 players can be recorded and ranked with multiplayer ELO.

**Architecture:** Add `"1-v-n-elo"` to the `scoreType` enum and a nullable `gameType` column to `match`. Reuse the existing `match`/`matchPlayer` tables: a darts game is one `match` row + N `matchPlayer` rows (winner `result: "W"`, losers `"L"`), where the winner is the single home player and losers are away. A new `calculate1vN` util computes winner-vs-each-loser ELO with k scaled by `1/(n-1)` (n=2 is identical to standard 1v1). New tRPC procedure `match.createDarts` records games; new `CreateDartsGameDialog` drawer captures gameType + players + winner.

**Tech Stack:** TypeScript, Drizzle ORM (SQLite/D1), tRPC, Cloudflare Workers (Hono), TanStack Query + TanStack Router + shadcn/Tailwind (web), Vitest (util + worker), Playwright (e2e).

---

### Task 1: DB schema — scoreType value + gameType column

**Files:**
- Modify: `apps/worker/src/db/schema/league-schema.ts:41` (scoreType enum) and `:165-181` (match table)

- [ ] **Step 1: Add the enum values and column**

In `apps/worker/src/db/schema/league-schema.ts`, change line 41 to add the new score type, and add a `dartsGameType` enum const + `gameType` column on `match`:

```ts
export const scoreType = ["elo", "3-1-0", "elo-individual-vs-team", "1-v-n-elo"] as const;

export const dartsGameType = ["x01", "cricket", "shanghai", "gotcha"] as const;
```

In the `match` table definition (after the `awayExpectedElo` field, line 175), add:

```ts
gameType: text("game_type", { enum: dartsGameType }),
```

- [ ] **Step 2: Generate and apply the migration**

Run: `bun db:generate` (from `apps/worker`)
Expected: Drizzle writes a new migration (adds `game_type` column; the enum value is a TS-level-only change in SQLite, no DB constraint generated).

Run: `bun db:migrate`
Expected: migration applied to local D1 at `../../.db/local`.

- [ ] **Step 3: Verify the migration file**

Read the newest file in `apps/worker/migrations/`. Expected: an `ALTER TABLE \`match\` ADD \`game_type\` text;` statement.

- [ ] **Step 4: Commit**

```bash
git add apps/worker/src/db/schema/league-schema.ts apps/worker/migrations/
git commit -m "feat(db): add 1-v-n-elo score type and game_type column"
```

---

### Task 2: ELO util — `calculate1vN` + unit tests (TDD)

**Files:**
- Modify: `packages/util/src/elo-util/index.ts`
- Modify: `packages/util/src/elo-util/elo-util.spec.ts`

- [ ] **Step 1: Write the failing tests**

Append to `packages/util/src/elo-util/elo-util.spec.ts`:

```ts
import { calculate1vN } from "./index.js";

describe("calculate1vN", () => {
	it("n=2 matches standard 1v1 ELO", () => {
		const result = calculate1vN({
			kFactor: 32,
			winner: { id: "w", score: 1000 },
			losers: [{ id: "l1", score: 1000 }],
		});

		expect(result.winner.scoreAfter).toBe(1016);
		expect(result.losers[0].scoreAfter).toBe(984);
	});

	it("n=4 with equal ratings: winner gains k*(1/2) total, losers split", () => {
		const result = calculate1vN({
			kFactor: 32,
			winner: { id: "w", score: 1000 },
			losers: [
				{ id: "l1", score: 1000 },
				{ id: "l2", score: 1000 },
				{ id: "l3", score: 1000 },
			],
		});

		// scaledK = 32/3 ≈ 10.67; each pairing contributes 10.67 * (1 - 0.5)
		expect(result.winner.scoreAfter).toBeCloseTo(1016, 1);
		for (const loser of result.losers) {
			expect(loser.scoreAfter).toBeCloseTo(994.67, 1);
		}
	});

	it("rating changes sum to ~0 (zero-sum)", () => {
		const result = calculate1vN({
			kFactor: 32,
			winner: { id: "w", score: 1100 },
			losers: [
				{ id: "l1", score: 1000 },
				{ id: "l2", score: 900 },
				{ id: "l3", score: 1000 },
				{ id: "l4", score: 800 },
			],
		});

		const totalDelta =
			result.winner.scoreAfter -
			1100 +
			result.losers.reduce((sum, l) => sum + (l.scoreAfter - l.score), 0);
		expect(totalDelta).toBeCloseTo(0, 5);
	});

	it("higher-rated winner gains less than lower-rated winner", () => {
		const strong = calculate1vN({
			kFactor: 32,
			winner: { id: "w", score: 1500 },
			losers: [{ id: "l1", score: 1000 }],
		});
		const weak = calculate1vN({
			kFactor: 32,
			winner: { id: "w", score: 1000 },
			losers: [{ id: "l1", score: 1000 }],
		});

		expect(strong.winner.scoreAfter - 1500).toBeLessThan(weak.winner.scoreAfter - 1000);
		expect(strong.losers[0].scoreAfter - 1000).toBeLessThan(weak.losers[0].scoreAfter - 1000);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test` (from `packages/util`)
Expected: FAIL — `calculate1vN` is not exported.

- [ ] **Step 3: Implement `calculate1vN` and extend `ScoreType`**

In `packages/util/src/elo-util/index.ts`:

- Change the `ScoreType` union (line 8) to add `"1-v-n-elo"`:

```ts
export type ScoreType = "elo" | "3-1-0" | "elo-individual-vs-team" | "1-v-n-elo";
```

- Append the `calculate1vN` function after `calculate310` (before `determineMatchResult`):

```ts
export const calculate1vN = ({
	kFactor,
	winner,
	losers,
}: {
	kFactor: number;
	winner: EloPlayer;
	losers: EloPlayer[];
}): {
	winner: { id: string; scoreAfter: number };
	losers: { id: string; scoreAfter: number }[];
} => {
	const scaledK = kFactor / losers.length;
	let winnerScoreAfter = winner.score;

	const loserResults = losers.map((loser) => {
		const expectedWinner = calculateExpectedScore(winner.score, loser.score);
		const delta = scaledK * (1 - expectedWinner);
		winnerScoreAfter += delta;
		return { id: loser.id, scoreAfter: loser.score - delta };
	});

	return {
		winner: { id: winner.id, scoreAfter: winnerScoreAfter },
		losers: loserResults,
	};
};
```

Note: `calculateExpectedScore` is already imported at the top of the file. `EloPlayer` is already defined.

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test` (from `packages/util`)
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add packages/util/src/elo-util/index.ts packages/util/src/elo-util/elo-util.spec.ts
git commit -m "feat(util): add calculate1vN multiplayer ELO"
```

---

### Task 3: match-repository — 1-v-n scoring + gameType

**Files:**
- Modify: `apps/worker/src/repositories/match-repository.ts`

- [ ] **Step 1: Update imports and types**

In `apps/worker/src/repositories/match-repository.ts`:

- Line 3 import: add `calculate1vN`:

```ts
import { calculateElo, calculate1vN } from "@coding-cowboys/scorebrawl-util/elo-util";
```

- Extend `MatchCreateInput` (lines 24-32) with optional `gameType`:

```ts
export interface MatchCreateInput {
	id?: string;
	seasonId: string;
	homeScore: number;
	awayScore: number;
	homeTeamPlayerIds: string[];
	awayTeamPlayerIds: string[];
	userId: string;
	gameType?: "x01" | "cricket" | "shanghai" | "gotcha";
}
```

- Extend `SeasonData` (lines 39-43) to include `"1-v-n-elo"`:

```ts
type SeasonData = {
	scoreType: "elo" | "3-1-0" | "elo-individual-vs-team" | "1-v-n-elo";
	kFactor: number;
	initialScore: number;
};
```

- [ ] **Step 2: Add the 1-v-n scoring branch**

In `calculateMatchResult` (lines 45-77), add before the `throw`:

```ts
	if (seasonData.scoreType === "1-v-n-elo") {
		const result = calculate1vN({
			kFactor: seasonData.kFactor,
			winner: homePlayers[0],
			losers: awayPlayers,
		});
		return {
			homeTeam: { winningOdds: 0.5, players: [result.winner] },
			awayTeam: { winningOdds: 0.5, players: result.losers },
		};
	}
```

- [ ] **Step 3: Fix result determination for 1-v-n**

In `create()` (lines 257-270), the home/away result is derived from `homeScore` vs `awayScore`. For darts, the home side (winner) must always be `W` and the away side (losers) `L`. Replace the block with:

```ts
		let homeMatchResult: (typeof matchResult)[number];
		let awayMatchResult: (typeof matchResult)[number];

		if (seasonData.scoreType === "1-v-n-elo") {
			homeMatchResult = "W";
			awayMatchResult = "L";
		} else if (input.homeScore > input.awayScore) {
			homeMatchResult = "W";
			awayMatchResult = "L";
		} else if (input.homeScore < input.awayScore) {
			homeMatchResult = "L";
			awayMatchResult = "W";
		} else {
			homeMatchResult = "D";
			awayMatchResult = "D";
		}
```

- [ ] **Step 4: Persist gameType on the match insert**

In `create()` match insert (lines 244-255), add `gameType: input.gameType ?? null`:

```ts
		await tx.insert(match).values({
			id: matchId,
			seasonId: input.seasonId,
			homeScore: input.homeScore,
			awayScore: input.awayScore,
			homeExpectedElo: eloResult.homeTeam.winningOdds,
			awayExpectedElo: eloResult.awayTeam.winningOdds,
			gameType: input.gameType ?? null,
			createdBy: input.userId,
			updatedBy: input.userId,
			createdAt: now,
			updatedAt: now,
		});
```

- [ ] **Step 5: Expose gameType in list/detail queries**

In `getBySeasonId` (lines 716-736) add `gameType: match.gameType` to the select and to the returned object (lines 813-845):

```ts
	db
		.select({
			id: match.id,
			seasonId: match.seasonId,
			homeScore: match.homeScore,
			awayScore: match.awayScore,
			gameType: match.gameType,
			createdAt: match.createdAt,
		})
```

and in the `matches` map:

```ts
		return {
			id: m.id,
			seasonId: m.seasonId,
			homeScore: m.homeScore,
			awayScore: m.awayScore,
			gameType: m.gameType,
			createdAt: m.createdAt,
			...
		};
```

In `getMatchWithPlayers` (lines 854-868), add `gameType: match.gameType` to the `matchRows` select and spread it (line 920-923 `return { ...matchData, players: playersWithTeam }` already spreads `matchData`, so just add it to the select).

- [ ] **Step 6: Typecheck**

Run: `bun typecheck` (from `apps/worker`)
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/worker/src/repositories/match-repository.ts
git commit -m "feat(worker): support 1-v-n-elo scoring and game_type in match repository"
```

---

### Task 4: season-repository + season-router — create 1-v-n-elo seasons

**Files:**
- Modify: `apps/worker/src/repositories/season-repository.ts`
- Modify: `apps/worker/src/trpc/router/season-router.ts`

- [ ] **Step 1: Create branch in season-repository**

In `season-repository.ts` `create()` (lines 219-256), the values ternary branches on `input.scoreType === "elo"`. Change the condition to treat `1-v-n-elo` like `elo` (keeps `initialScore`/`kFactor`, sets `rounds: null`, no fixture generation), and set the persisted `scoreType` from `input.scoreType`:

```ts
		const isEloBased =
			input.scoreType === "elo" || input.scoreType === "1-v-n-elo";
		const values = isEloBased
			? {
					id: seasonId,
					name: input.name,
					slug,
					leagueId: input.leagueId,
					startDate: input.startDate,
					endDate: input.endDate ?? null,
					initialScore: input.initialScore,
					kFactor: input.kFactor,
					scoreType: input.scoreType as (typeof scoreType)[number],
					rounds: null,
					createdAt: now,
					updatedAt: now,
					createdBy: input.userId,
					updatedBy: input.userId,
					archived: false,
					closed: false,
				}
			: {
					id: seasonId,
					name: input.name,
					slug,
					leagueId: input.leagueId,
					startDate: input.startDate,
					endDate: input.endDate ?? null,
					initialScore: 0,
					kFactor: -1,
					rounds: input.rounds ?? null,
					scoreType: "3-1-0" as const,
					createdAt: now,
					updatedAt: now,
					createdBy: input.userId,
					updatedBy: input.userId,
					archived: false,
					closed: false,
				};
```

- [ ] **Step 2: Widen the create input enum + reject rounds**

In `season-router.ts` `create` (line 98), widen the enum:

```ts
				scoreType: z.enum(["elo", "3-1-0", "1-v-n-elo"]),
```

In the mutation, after `validateStartBeforeEnd(input);` (line 106), add:

```ts
			if (input.scoreType === "1-v-n-elo" && input.rounds) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "1-v-n-elo seasons do not use rounds",
				});
			}
```

- [ ] **Step 3: Typecheck**

Run: `bun typecheck` (from `apps/worker`)
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/worker/src/repositories/season-repository.ts apps/worker/src/trpc/router/season-router.ts
git commit -m "feat(worker): allow creating 1-v-n-elo seasons"
```

---

### Task 5: match-router — `createDarts` procedure

**Files:**
- Modify: `apps/worker/src/trpc/router/match-router.ts`

- [ ] **Step 1: Add the `createDarts` procedure**

Add a new procedure to `matchRouter` (after `create`, before `remove`). It maps `winnerId` + `loserIds` onto the existing repository `create` (winner → home, losers → away, `homeScore: 1`, `awayScore: loserIds.length`, `gameType`), then reuses the same SSE + streak + achievement post-processing:

```ts
	createDarts: leagueMemberProcedure
		.input(
			z.object({
				id: matchIdSchema,
				seasonSlug: z.string(),
				gameType: z.enum(["x01", "cricket", "shanghai", "gotcha"]),
				winnerId: z.string(),
				loserIds: z.array(z.string()).min(1).max(5),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const comp = await seasonRepository.getBySlug({
				db: ctx.db,
				seasonSlug: input.seasonSlug,
				leagueId: ctx.organizationId,
			});

			if (comp.closed) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "This season is closed",
				});
			}

			if (comp.scoreType !== "1-v-n-elo") {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Darts games can only be recorded in 1-v-n-elo seasons",
				});
			}

			const allIds = [input.winnerId, ...input.loserIds];
			if (allIds.length < 2 || allIds.length > 6) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "A darts game needs between 2 and 6 players",
				});
			}

			if (input.loserIds.includes(input.winnerId)) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Winner cannot also be a loser",
				});
			}

			if (new Set(allIds).size !== allIds.length) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Duplicate players in game",
				});
			}

			const seasonPlayers = await seasonPlayerRepository.findAll({
				db: ctx.db,
				seasonId: comp.id,
			});
			const validIds = new Set(seasonPlayers.map((p) => p.id));
			if (!allIds.every((id) => validIds.has(id))) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "All players must be in this season",
				});
			}

			const createdMatch = await matchRepository.create({
				db: ctx.db,
				input: {
					id: input.id,
					seasonId: comp.id,
					homeScore: 1,
					awayScore: input.loserIds.length,
					homeTeamPlayerIds: [input.winnerId],
					awayTeamPlayerIds: input.loserIds,
					gameType: input.gameType,
					userId: ctx.authentication.user.id,
				},
			});

			return finalizeMatchCreation({
				ctx,
				input,
				comp,
				createdMatch,
				seasonPlayerIds: allIds,
			});
		}),
```

- [ ] **Step 2: Extract the shared post-create helper**

Add a helper function at the bottom of `match-router.ts` that contains the SSE broadcast + streak + achievement logic currently duplicated inline in `create` and `createFromFixture`, and refactor `create`'s `.then(...)` block (lines 272-336) to use it. Define the helper:

```ts
async function finalizeMatchCreation({
	ctx,
	input,
	comp,
	createdMatch,
	seasonPlayerIds,
}: {
	ctx: {
		db: Parameters<typeof seasonPlayerRepository.getStanding>[0]["db"];
		env: Parameters<typeof broadcastSeasonEvent>[0] & { ACHIEVEMENT_QUEUE: { send: (m: AchievementQueueMessage) => Promise<unknown> } };
		waitUntil: (p: Promise<unknown>) => void;
		organization: { slug: string };
		authentication: { user: { id: string; name: string } };
	};
	input: { seasonSlug: string };
	comp: { id: string };
	createdMatch: { id: string };
	seasonPlayerIds: string[];
}) {
	const standings = await seasonPlayerRepository.getStanding({
		db: ctx.db,
		seasonId: comp.id,
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
		input.seasonSlug,
		streakPlayers,
		streakTeams,
		{
			id: ctx.authentication.user.id,
			name: ctx.authentication.user.name,
		}
	);

	await ctx.env.ACHIEVEMENT_QUEUE.send({
		seasonPlayerIds,
	} satisfies AchievementQueueMessage);

	return createdMatch;
}
```

Refactor `create`'s mutation to call the helper:

```ts
			return matchRepository
				.create({
					db: ctx.db,
					input: {
						id: input.id,
						seasonId: comp.id,
						homeScore: input.homeScore,
						awayScore: input.awayScore,
						homeTeamPlayerIds: input.homeTeamPlayerIds,
						awayTeamPlayerIds: input.awayTeamPlayerIds,
						userId: ctx.authentication.user.id,
					},
				})
				.then(async (createdMatch) =>
					finalizeMatchCreation({
						ctx,
						input,
						comp,
						createdMatch,
						seasonPlayerIds: [...input.homeTeamPlayerIds, ...input.awayTeamPlayerIds],
					})
				);
```

Verify the `broadcastStreakEvents` signature matches the existing usage (it is defined at lines 77-100 of the file). If `ctx`'s concrete type cannot be expressed this simply, use `Parameters<typeof broadcastSeasonEvent>[0]` for `env` as shown and keep `ctx` as the inferred router context by extracting the helper inside the `matchRouter` object scope — adjust the type annotations as needed to satisfy `tsgo`.

- [ ] **Step 3: Typecheck**

Run: `bun typecheck` (from `apps/worker`)
Expected: PASS. Fix any type mismatches in the `finalizeMatchCreation` context type (the tRPC ctx type is inferred; if needed, type the helper's `ctx` param with the router's real ctx type imported from `../trpc`).

- [ ] **Step 4: Commit**

```bash
git add apps/worker/src/trpc/router/match-router.ts
git commit -m "feat(worker): add match.createDarts procedure"
```

---

### Task 6: Worker integration tests for 1-v-n-elo

**Files:**
- Modify: `apps/worker/test/setup/season-context-util.ts`
- Create: `apps/worker/test/trpc/darts-match-router.spec.ts`

- [x] **Step 1: Add the new score type to the test helper union**

In `apps/worker/test/setup/season-context-util.ts` line 12, extend the union:

```ts
	scoreType?: "elo" | "3-1-0" | "elo-individual-vs-team" | "1-v-n-elo";
```

- [x] **Step 2: Write the integration spec**

Create `apps/worker/test/trpc/darts-match-router.spec.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createAuthContext } from "../setup/auth-context-util";
import { createPlayers } from "../setup/season-context-util";
import { createTRPCTestClient } from "./trpc-test-client";

describe("darts 1-v-n-elo", () => {
	async function createDartsSeason(ctx: Awaited<ReturnType<typeof createAuthContext>>) {
		const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });
		await createPlayers(ctx, 4);
		const season = await client.season.create.mutate({
			name: "Darts Season",
			initialScore: 1000,
			scoreType: "1-v-n-elo",
			kFactor: 32,
			startDate: new Date(),
		});
		const seasonPlayers = await client.seasonPlayer.getAll.query({
			seasonSlug: season.slug,
		});
		return { client, season, seasonPlayers };
	}

	it("creates a 1-v-n-elo season", async () => {
		const ctx = await createAuthContext();
		const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });
		await createPlayers(ctx, 2);
		const season = await client.season.create.mutate({
			name: "Darts Season",
			initialScore: 1000,
			scoreType: "1-v-n-elo",
			kFactor: 32,
			startDate: new Date(),
		});
		expect(season.scoreType).toBe("1-v-n-elo");
		expect(season.rounds).toBeNull();
	});

	it("rejects rounds for 1-v-n-elo seasons", async () => {
		const ctx = await createAuthContext();
		const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });
		await createPlayers(ctx, 2);
		await expect(
			client.season.create.mutate({
				name: "Darts Season",
				initialScore: 1000,
				scoreType: "1-v-n-elo",
				kFactor: 32,
				rounds: 2,
				startDate: new Date(),
			})
		).rejects.toThrow("1-v-n-elo seasons do not use rounds");
	});

	it("records a 1v1 darts game and updates ratings", async () => {
		const ctx = await createAuthContext();
		const { client, season, seasonPlayers } = await createDartsSeason(ctx);
		const [p0, p1] = seasonPlayers;

		const match = await client.match.createDarts.mutate({
			seasonSlug: season.slug,
			gameType: "x01",
			winnerId: p0.id,
			loserIds: [p1.id],
		});

		expect(match).toBeDefined();

		const standing = await client.seasonPlayer.getStanding.query({ seasonSlug: season.slug });
		const winner = standing.find((p) => p.id === p0.id);
		const loser = standing.find((p) => p.id === p1.id);
		expect(winner?.score).toBeGreaterThan(1000);
		expect(loser?.score).toBeLessThan(1000);
		expect(winner?.winCount).toBe(1);
		expect(loser?.lossCount).toBe(1);
	});

	it("records a 4-player game: winner up, all losers down", async () => {
		const ctx = await createAuthContext();
		const { client, season, seasonPlayers } = await createDartsSeason(ctx);
		const [p0, p1, p2, p3] = seasonPlayers;

		await client.match.createDarts.mutate({
			seasonSlug: season.slug,
			gameType: "cricket",
			winnerId: p0.id,
			loserIds: [p1.id, p2.id, p3.id],
		});

		const standing = await client.seasonPlayer.getStanding.query({ seasonSlug: season.slug });
		const winner = standing.find((p) => p.id === p0.id);
		for (const loser of [p1, p2, p3]) {
			const row = standing.find((p) => p.id === loser.id);
			expect(row?.score).toBeLessThan(1000);
		}
		expect(winner?.score).toBeGreaterThan(1000);
		expect(standing[0]?.id).toBe(p0.id); // winner tops standings
	});

	it("rejects invalid gameType", async () => {
		const ctx = await createAuthContext();
		const { client, season, seasonPlayers } = await createDartsSeason(ctx);
		const [p0, p1] = seasonPlayers;

		await expect(
			client.match.createDarts.mutate({
				seasonSlug: season.slug,
				gameType: "bogus" as never,
				winnerId: p0.id,
				loserIds: [p1.id],
			})
		).rejects.toThrow();
	});

	it("rejects winner also in losers", async () => {
		const ctx = await createAuthContext();
		const { client, season, seasonPlayers } = await createDartsSeason(ctx);
		const [p0, p1] = seasonPlayers;

		await expect(
			client.match.createDarts.mutate({
				seasonSlug: season.slug,
				gameType: "x01",
				winnerId: p0.id,
				loserIds: [p0.id, p1.id],
			})
		).rejects.toThrow("Winner cannot also be a loser");
	});

	it("rejects a player not in the season", async () => {
		const ctx = await createAuthContext();
		const { client, season, seasonPlayers } = await createDartsSeason(ctx);
		const [p0, p1] = seasonPlayers;

		await expect(
			client.match.createDarts.mutate({
				seasonSlug: season.slug,
				gameType: "x01",
				winnerId: p0.id,
				loserIds: [p1.id, "nonexistent-id"],
			})
		).rejects.toThrow("All players must be in this season");
	});

	it("lists a darts match with gameType", async () => {
		const ctx = await createAuthContext();
		const { client, season, seasonPlayers } = await createDartsSeason(ctx);
		const [p0, p1, p2] = seasonPlayers;

		await client.match.createDarts.mutate({
			seasonSlug: season.slug,
			gameType: "shanghai",
			winnerId: p0.id,
			loserIds: [p1.id, p2.id],
		});

		const result = await client.match.getAll.query({ seasonSlug: season.slug, limit: 10, offset: 0 });
		expect(result.matches[0]?.gameType).toBe("shanghai");
	});
});
```

Note: if `season.rounds` is not returned by `season.getBySlug` (it is, per `season-router.ts:31`), adjust the assertion accordingly.

- [x] **Step 3: Run the tests**

Run: `bun run test -- darts-match-router` (from `apps/worker`)
Expected: PASS.

- [x] **Step 4: Run the full worker test suite to catch regressions**

Run: `bun run test` (from `apps/worker`)
Expected: all existing tests still PASS (match-router, season-router specs exercise the refactored `create` path).

- [x] **Step 5: Commit**

```bash
git add apps/worker/test/setup/season-context-util.ts apps/worker/test/trpc/darts-match-router.spec.ts
git commit -m "test(worker): add 1-v-n-elo season and match integration tests"
```

> **Note (infra fix bundled in this commit):** all worker specs were failing with 401 before any test code ran. Root cause: `apps/worker/.env` sets `BETTER_AUTH_URL=https://scorebrawl.localhost`, which vitest-pool-workers loads into the worker env, so better-auth emits `__Secure-better-auth.session_token` cookies while the test helpers hardcode the unprefixed name → session lookup returned null. Fixed in `apps/worker/vitest.config.ts` by overriding `BETTER_AUTH_URL: "http://localhost"` in the test bindings so all auth instances (helpers + worker via `SELF.fetch`) use plain cookies. Verified: `test/trpc/match-router.spec.ts` (12 tests) and `test/trpc/darts-match-router.spec.ts` (8 tests) pass; full worker suite 174/174 pass.

---

### Task 7: Create season form — add 1-v-n-elo card

**Files:**
- Modify: `apps/web/src/routes/_authenticated/_sidebar/leagues/$slug/seasons/-components/seasons/create-season-form.tsx`
- Modify: `apps/web/src/routes/_authenticated/_sidebar/leagues/$slug/seasons/-components/seasons/edit-season-form.tsx`

- [ ] **Step 1: Add the score type + config in create form**

In `create-season-form.tsx`:

- Line 26: `const scoreTypes = ["elo", "3-1-0", "1-v-n-elo"] as const;`
- Import `DartIcon` from `@hugeicons/core-free-icons` (verify exact export name exists; fallback `DartFreeIcon`).
- Add to `scoreTypeConfig` (lines 64-77):

```ts
	"1-v-n-elo": {
		label: "1-v-N Darts ELO",
		icon: DartIcon,
		color: "purple",
		description: "Multiplayer darts — one winner, everyone else loses",
	},
```

- Add purple class entries to `selectedClasses`, `iconClasses`, `iconColorClasses`, `textColorClasses`, `topBorderClasses` (lines 248-271):

```ts
								const selectedClasses = {
									elo: "border-emerald-500 bg-emerald-500/10 shadow-lg shadow-emerald-500/20",
									"3-1-0": "border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/20",
									"1-v-n-elo": "border-purple-500 bg-purple-500/10 shadow-lg shadow-purple-500/20",
								};
								const iconClasses = {
									elo: "bg-emerald-500/20",
									"3-1-0": "bg-blue-500/20",
									"1-v-n-elo": "bg-purple-500/20",
								};
								const iconColorClasses = {
									elo: "text-emerald-400",
									"3-1-0": "text-blue-400",
									"1-v-n-elo": "text-purple-400",
								};
								const textColorClasses = {
									elo: "text-emerald-300 dark:text-emerald-300",
									"3-1-0": "text-blue-300 dark:text-blue-300",
									"1-v-n-elo": "text-purple-300 dark:text-purple-300",
								};
								const topBorderClasses = {
									elo: "from-emerald-400 to-emerald-600",
									"3-1-0": "from-blue-400 to-blue-600",
									"1-v-n-elo": "from-purple-400 to-purple-600",
								};
```

- Change `const isElo = scoreType === "elo";` (line 117) to include the darts type so the ELO config fields show and rounds stay hidden:

```ts
	const isElo = scoreType === "elo" || scoreType === "1-v-n-elo";
```

- Change the scoring card grid from `grid-cols-2` to `grid-cols-1 sm:grid-cols-3` (line 242) so the third card fits.

- [ ] **Step 2: Update the edit-season-form**

In `edit-season-form.tsx`:
- Line 26: `const scoreTypes = ["elo", "3-1-0", "1-v-n-elo"] as const;`
- Add `"1-v-n-elo"` to `scoreTypeConfig` (around line 85) with the same purple config.
- `const isElo = scoreType === "elo";` (line 167) → `const isElo = scoreType === "elo" || scoreType === "1-v-n-elo";`
- Add purple entries to the `selectedClasses`/`iconClasses`/`iconColorClasses`/`textColorClasses`/`topBorderClasses` maps (lines 314-334).
- Ensure the submit maps `initialScore`/`kFactor` for `1-v-n-elo` the same as `elo` (it already keys off `isElo`, so no change needed beyond the line 167 change).

- [ ] **Step 3: Typecheck**

Run: `bun typecheck` (from `apps/web`)
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/routes/_authenticated/_sidebar/leagues/$slug/seasons/-components/seasons/create-season-form.tsx apps/web/src/routes/_authenticated/_sidebar/leagues/$slug/seasons/-components/seasons/edit-season-form.tsx
git commit -m "feat(web): add 1-v-n-elo season type to create/edit forms"
```

---

### Task 8: Season list + dashboard — icons, ELO view, no fixtures

**Files:**
- Modify: `apps/web/src/routes/_authenticated/_sidebar/leagues/$slug/seasons/index.tsx`
- Modify: `apps/web/src/routes/_authenticated/_sidebar/leagues/$slug/seasons/$seasonSlug/index.tsx`

- [ ] **Step 1: Add icon/color cases in the season list**

In `seasons/index.tsx`, extend `getScoreTypeIcon`, `getScoreTypeColor`, `getScoreTypeBgColor` (lines 76-107) with `1-v-n-elo` cases (import `DartIcon`):

```ts
function getScoreTypeIcon(scoreType: string) {
	switch (scoreType) {
		case "elo":
			return Award01Icon;
		case "3-1-0":
			return Target01Icon;
		case "1-v-n-elo":
			return DartIcon;
		default:
			return AwardIcon;
	}
}
```

```ts
		case "1-v-n-elo":
			return "text-purple-500";
```

```ts
		case "1-v-n-elo":
			return "bg-purple-500/10";
```

- [ ] **Step 2: Extend isEloSeason in the season dashboard**

In `$seasonSlug/index.tsx` line 65, treat `1-v-n-elo` like `elo` so fixtures stay hidden and the ELO/standings view renders:

```ts
	const isEloSeason = season?.scoreType === "elo" || season?.scoreType === "1-v-n-elo";
```

- [ ] **Step 3: Typecheck**

Run: `bun typecheck` (from `apps/web`)
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/routes/_authenticated/_sidebar/leagues/$slug/seasons/index.tsx apps/web/src/routes/_authenticated/_sidebar/leagues/$slug/seasons/$seasonSlug/index.tsx
git commit -m "feat(web): show 1-v-n-elo as ELO season with dart icon"
```

---

### Task 9: CreateDartsGameDialog — record a darts game

**Files:**
- Create: `apps/web/src/routes/_authenticated/_sidebar/leagues/$slug/seasons/-components/match/create-darts-game-drawer.tsx`
- Modify: `apps/web/src/routes/_authenticated/_sidebar/leagues/$slug/seasons/$seasonSlug/index.tsx`
- Modify: `apps/web/src/routes/_authenticated/_sidebar/leagues/$slug/seasons/$seasonSlug/matches.tsx`

- [ ] **Step 1: Create the dialog component**

Create `create-darts-game-drawer.tsx`. It is a Dialog (mirroring `create-match-drawer.tsx` styling) with three steps: pick gameType, pick 2–6 players (chips), pick winner (radio among selected). Uses `seasonPlayer.getStanding` for the roster and `match.createDarts` mutation.

```tsx
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { GlowButton, glowColors } from "@/components/ui/glow-button";
import { AvatarWithFallback } from "@/components/ui/avatar-with-fallback";
import { HugeiconsIcon } from "@hugeicons/react";
import { DartIcon, Alert01Icon } from "@hugeicons/core-free-icons";

const dartsGameTypes = ["x01", "cricket", "shanghai", "gotcha"] as const;

const createDartsSchema = z.object({
	gameType: z.enum(dartsGameTypes),
	winnerId: z.string().min(1, "Select the winner"),
	playerIds: z.array(z.string()).min(2, "Select at least 2 players").max(6, "At most 6 players"),
});

type CreateDartsFormValues = z.infer<typeof createDartsSchema>;

interface StandingPlayer {
	id: string;
	seasonId: string;
	playerId: string;
	score: number;
	name: string;
	image: string | null;
}

interface CreateDartsGameDialogProps {
	isOpen: boolean;
	onClose: () => void;
	seasonId: string;
	seasonSlug: string;
}

export function CreateDartsGameDialog({
	isOpen,
	onClose,
	seasonId,
	seasonSlug,
}: CreateDartsGameDialogProps) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	const { data: seasonPlayers } = useQuery(
		trpc.seasonPlayer.getStanding.queryOptions({ seasonSlug })
	);

	const { register, handleSubmit, setValue, watch, reset, formState: { errors } } =
		useForm<CreateDartsFormValues>({
			resolver: zodResolver(createDartsSchema),
			defaultValues: {
				gameType: "x01",
				winnerId: "",
				playerIds: [],
			},
		});

	const gameType = watch("gameType");
	const playerIds = watch("playerIds");
	const winnerId = watch("winnerId");

	const createMutation = useMutation(
		trpc.match.createDarts.mutationOptions({
			onSuccess: () => {
				toast.success("Darts game recorded");
				queryClient.invalidateQueries({ queryKey: ["matches", seasonId] });
				queryClient.invalidateQueries({
					queryKey: trpc.seasonPlayer.getStanding.queryKey({ seasonSlug }),
				});
				queryClient.invalidateQueries({ queryKey: trpc.match.getLatest.queryKey({ seasonSlug }) });
				reset();
				onClose();
			},
			onError: (err) => {
				toast.error(err instanceof Error ? err.message : "Failed to record darts game");
			},
		})
	);

	const togglePlayer = (id: string) => {
		const next = playerIds.includes(id)
			? playerIds.filter((p) => p !== id)
			: [...playerIds, id];
		setValue("playerIds", next);
		if (winnerId === id) setValue("winnerId", "");
	};

	const onSubmit = (values: CreateDartsFormValues) => {
		const loserIds = values.playerIds.filter((id) => id !== values.winnerId);
		createMutation.mutate({
			seasonSlug,
			gameType: values.gameType,
			winnerId: values.winnerId,
			loserIds,
		});
	};

	const selectedPlayers = (seasonPlayers ?? []).filter((p) => playerIds.includes(p.id));

	return (
		<Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
			<DialogContent
				className="sm:max-w-lg max-h-[95vh] overflow-hidden p-0"
				data-testid="create-darts-dialog"
			>
				<DialogHeader className="relative z-10 p-4 pb-3 border-b border-border">
					<div className="flex items-center gap-3">
						<div className="w-1.5 h-5 bg-purple-500" />
						<DialogTitle className="text-base font-bold font-mono tracking-tight">
							Record Darts Game
						</DialogTitle>
					</div>
				</DialogHeader>

				<div className="relative z-10 overflow-y-auto max-h-[calc(95vh-80px)] p-4">
					<form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
						{/* Game type */}
						<div>
							<span className="text-xs font-mono font-medium uppercase tracking-wider text-muted-foreground">
								Game
							</span>
							<div className="grid grid-cols-4 gap-2 mt-1.5">
								{dartsGameTypes.map((type) => (
									<button
										key={type}
										type="button"
										onClick={() => setValue("gameType", type)}
										data-testid={`darts-game-type-${type}`}
										className={cn(
											"py-1.5 text-xs font-mono rounded-md border transition-colors",
											gameType === type
												? "border-purple-500 bg-purple-500/10 text-purple-400"
												: "border-border text-muted-foreground"
										)}
									>
										{type === "x01" ? "x01" : type}
									</button>
								))}
							</div>
						</div>

						{/* Players */}
						<div>
							<span className="text-xs font-mono font-medium uppercase tracking-wider text-muted-foreground">
								Players ({playerIds.length})
							</span>
							<div className="flex flex-wrap gap-2 mt-1.5 max-h-40 overflow-y-auto">
								{(seasonPlayers ?? []).map((p) => (
									<button
										key={p.id}
										type="button"
										onClick={() => togglePlayer(p.id)}
										data-testid={`darts-player-${p.id}`}
										className={cn(
											"flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs transition-colors",
											playerIds.includes(p.id)
												? "border-purple-500 bg-purple-500/10"
												: "border-border text-muted-foreground"
										)}
									>
										<AvatarWithFallback src={p.image} name={p.name} size="xs" />
										<span className="truncate">{p.name}</span>
									</button>
								))}
							</div>
						</div>

						{/* Winner */}
						<div>
							<span className="text-xs font-mono font-medium uppercase tracking-wider text-muted-foreground">
								Winner
							</span>
							<div className="flex flex-col gap-1.5 mt-1.5">
								{selectedPlayers.map((p) => (
									<label
										key={p.id}
										className={cn(
											"flex items-center gap-2 px-2 py-1.5 rounded-md border cursor-pointer text-sm",
											winnerId === p.id
												? "border-purple-500 bg-purple-500/10"
												: "border-border"
										)}
									>
										<input
											type="radio"
											name="winner"
											value={p.id}
											checked={winnerId === p.id}
											onChange={() => setValue("winnerId", p.id)}
											data-testid={`darts-winner-${p.id}`}
										/>
										<AvatarWithFallback src={p.image} name={p.name} size="sm" />
										<span>{p.name}</span>
									</label>
								))}
								{selectedPlayers.length === 0 && (
									<p className="text-xs text-muted-foreground">Select players first</p>
								)}
							</div>
						</div>

						{/* Errors */}
						<div className="min-h-[1.25rem] flex flex-col gap-1">
							{errors.playerIds?.message && (
								<p className="text-destructive text-xs font-mono">{errors.playerIds.message}</p>
							)}
							{errors.winnerId?.message && (
								<p className="text-destructive text-xs font-mono">{errors.winnerId.message}</p>
							)}
							{playerIds.length >= 2 && !winnerId && (
								<div className="flex items-center gap-1.5 text-xs text-amber-600">
									<HugeiconsIcon icon={Alert01Icon} className="size-3.5" />
									Select a winner
								</div>
							)}
						</div>

						<div className="flex gap-4 pt-4 border-t border-border">
							<Button type="button" variant="outline" className="font-mono" onClick={onClose}>
								Cancel
							</Button>
							<GlowButton
								type="submit"
								glowColor={glowColors.blue}
								className="flex-1 font-mono"
								disabled={createMutation.isPending || selectedPlayers.length < 2 || !winnerId}
								data-testid="darts-submit-button"
							>
								{createMutation.isPending ? "Recording..." : "Record Game"}
							</GlowButton>
						</div>
					</form>
				</div>
			</DialogContent>
		</Dialog>
	);
}
```

Note: verify `AvatarWithFallback` supports `size="xs"`; if not, use `size="sm"`.

- [ ] **Step 2: Wire into the season dashboard**

In `$seasonSlug/index.tsx`:
- Import the dialog.
- Change the dialog render block (lines 191-198) to render the darts dialog for `1-v-n-elo` seasons and the standard dialog for `elo`:

```tsx
			{season?.scoreType === "1-v-n-elo" && seasonId && (
				<CreateDartsGameDialog
					isOpen={isCreateMatchOpen}
					onClose={() => setIsCreateMatchOpen(false)}
					seasonId={seasonId}
					seasonSlug={seasonSlug}
				/>
			)}
			{season?.scoreType === "elo" && seasonId && (
				<CreateMatchDialog
					isOpen={isCreateMatchOpen}
					onClose={() => setIsCreateMatchOpen(false)}
					seasonId={seasonId}
					seasonSlug={seasonSlug}
				/>
			)}
```

The existing `addMatch` search param + "Match" header button already drive `isCreateMatchOpen`, so no button change is needed (optionally rename the header button label to "Game" for darts seasons — keep it "Match" to minimize scope).

- [ ] **Step 3: Wire into the matches page**

In `matches.tsx`:
- Import `CreateDartsGameDialog`.
- Replace the single `CreateMatchDialog` render (lines 253-260) with a scoreType branch (read `season` from the existing `useQuery`):

```tsx
			{seasonId && season?.scoreType === "1-v-n-elo" && (
				<CreateDartsGameDialog
					isOpen={isCreateMatchOpen}
					onClose={() => setIsCreateMatchOpen(false)}
					seasonId={seasonId}
					seasonSlug={seasonSlug}
				/>
			)}
			{seasonId && season?.scoreType !== "1-v-n-elo" && (
				<CreateMatchDialog
					isOpen={isCreateMatchOpen}
					onClose={() => setIsCreateMatchOpen(false)}
					seasonId={seasonId}
					seasonSlug={seasonSlug}
				/>
			)}
```

- [ ] **Step 4: Typecheck + run the dev server for route generation**

Run: `bun typecheck` (from `apps/web`)
Expected: PASS.

Run: `bun dev` (from `apps/web`) once to let TanStack Router regenerate route types for the new file.

- [x] **Step 5: Commit**

```bash
git add apps/web/src/routes/_authenticated/_sidebar/leagues/$slug/seasons/-components/match/create-darts-game-drawer.tsx apps/web/src/routes/_authenticated/_sidebar/leagues/$slug/seasons/$seasonSlug/index.tsx apps/web/src/routes/_authenticated/_sidebar/leagues/$slug/seasons/$seasonSlug/matches.tsx
git commit -m "feat(web): add darts game recording dialog"
```

---

### Task 10: Seed a darts season for e2e + local dev

**Files:**
- Modify: `apps/worker/scripts/seed.ts`

- [ ] **Step 1: Add a darts season to the seed**

Add a constant after `SEED_SEASON` (line 43-49):

```ts
const SEED_DARTS_SEASON = {
	name: "Darts Season",
	slug: "darts-1",
	initialScore: 1000,
	scoreType: "1-v-n-elo" as const,
	kFactor: 32,
};
```

In the season-creation block (after the existing `seasonId` handling, around line 839), add a second season for darts. The seed creates season players for `seasonId` in a loop; the darts season needs its own `seasonPlayer` rows. Insert the darts season and, right after the member loop inserts season players, mirror those rows for the darts season. Concretely:

After the existing `if (existingSeason) {...} else {...}` block, add:

```ts
		// Create the darts (1-v-n-elo) season
		const [existingDartsSeason] = await db
			.select({ id: season.id })
			.from(season)
			.where(eq(season.slug, SEED_DARTS_SEASON.slug));
		if (existingDartsSeason) {
			console.log(dim(`  ○ Darts season already exists: ${SEED_DARTS_SEASON.name}`));
		} else {
			await db.insert(season).values({
				id: createId(),
				name: SEED_DARTS_SEASON.name,
				slug: SEED_DARTS_SEASON.slug,
				initialScore: SEED_DARTS_SEASON.initialScore,
				scoreType: SEED_DARTS_SEASON.scoreType,
				kFactor: SEED_DARTS_SEASON.kFactor,
				startDate: new Date(),
				endDate: null,
				leagueId: leagueId,
				archived: false,
				closed: false,
				createdBy: SEED_USER.id,
				updatedBy: SEED_USER.id,
				createdAt: new Date(),
				updatedAt: new Date(),
			});
			console.log(
				green(`  ✓ Darts season created: ${SEED_DARTS_SEASON.name} (slug: ${SEED_DARTS_SEASON.slug})`)
			);
		}
```

Then, wherever the seed inserts `seasonPlayer` rows for the main season (both the owner at lines 826-837 and each member at lines 904-913), insert a parallel `seasonPlayer` row for the darts season. Use the darts season id (look it up by slug if the block above only logs; simplest is to query `season.id` by slug after the block). Update the member loop to insert into both seasons:

```ts
				await db.insert(seasonPlayer).values({
					id: createId(),
					seasonId: seasonId,
					playerId: newPlayerId,
					score: SEED_SEASON.initialScore,
					disabled: false,
					createdAt: now,
					updatedAt: now,
				});
				await db.insert(seasonPlayer).values({
					id: createId(),
					seasonId: dartsSeasonId,
					playerId: newPlayerId,
					score: SEED_DARTS_SEASON.initialScore,
					disabled: false,
					createdAt: now,
					updatedAt: now,
				});
```

where `dartsSeasonId` is fetched after the darts season insert:

```ts
		const [dartsSeasonRow] = await db
			.select({ id: season.id })
			.from(season)
			.where(eq(season.slug, SEED_DARTS_SEASON.slug));
		const dartsSeasonId = dartsSeasonRow?.id;
```

Do the same for the owner player insert. If `dartsSeasonId` is undefined (season insert failed), skip the parallel inserts.

- [ ] **Step 2: Verify the seed runs**

Run: `bun run db:seed` (from `apps/worker`)
Expected: seed completes; logs show both `Season 1` and `Darts Season` created; `Darts Season` has season players.

- [ ] **Step 3: Commit**

```bash
git add apps/worker/scripts/seed.ts
git commit -m "feat(seed): add seeded 1-v-n-elo darts season"
```

---

### Task 11: E2E — darts match CRUD

**Files:**
- Create: `apps/e2e/tests/darts-match-crud.spec.ts`

- [ ] **Step 1: Write the spec**

Create `apps/e2e/tests/darts-match-crud.spec.ts`, mirroring `seeded-match-crud.spec.ts` but for the seeded `Darts Season`:

```ts
import { test, expect, signIn, SEED_USER, SEED_LEAGUE } from "./fixtures/auth";

test.describe("Darts Match CRUD", () => {
	test.beforeEach(async ({ page }) => {
		await signIn(page, SEED_USER.email, SEED_USER.password);
	});

	test("records a darts game, verifies ELO change, then removes it", async ({ page }) => {
		await page.goto(`/leagues/${SEED_LEAGUE.slug}/seasons/darts-1`);

		await expect(page.locator('[data-testid="standings-table"]:visible')).toBeVisible({
			timeout: 10000,
		});

		// Capture initial standings for the top 4 players
		const standingsTable = page.locator('[data-testid="standings-table"]:visible');
		const standingRows = standingsTable.locator('[data-testid^="standing-row-"]:visible');
		const rows = await standingRows.all();
		const initialScores: Record<string, number> = {};
		for (const row of rows.slice(0, 4)) {
			const testId = await row.getAttribute("data-testid");
			if (testId) {
				const playerId = testId.replace("standing-row-", "");
				const scoreText = await row
					.locator(`[data-testid="standing-score-${playerId}"]:visible`)
					.textContent();
				initialScores[playerId] = Number.parseInt(scoreText || "0", 10);
			}
		}

		// Open darts dialog
		await page.getByTestId("create-match-button").click();
		await expect(page.getByTestId("create-darts-dialog")).toBeVisible();

		// Select game type
		await page.getByTestId("darts-game-type-cricket").click();

		// Select 4 players
		const playerButtons = page.locator('[data-testid^="darts-player-"]');
		const firstFour = await playerButtons.all();
		for (const btn of firstFour.slice(0, 4)) {
			await btn.click();
		}

		// Pick winner = first selected player
		const firstPlayerTestId = await firstFour[0].getAttribute("data-testid");
		const firstPlayerId = firstPlayerTestId?.replace("darts-player-", "");
		if (firstPlayerId) {
			await page.getByTestId(`darts-winner-${firstPlayerId}`).check();
		}

		await page.getByTestId("darts-submit-button").click();
		await expect(page.getByTestId("create-darts-dialog")).not.toBeVisible();

		// Winner's standings score should have increased
		await expect(page.getByTestId("standings-table").first()).toBeVisible();
		if (firstPlayerId) {
			const winnerScoreEl = page
				.locator(`[data-testid="standing-score-${firstPlayerId}"]:visible`)
				.first();
			await expect
				.poll(async () => Number.parseInt((await winnerScoreEl.textContent()) || "0", 10))
				.toBeGreaterThan(initialScores[firstPlayerId] ?? 0);
		}

		// Remove the match via the matches page
		await page.goto(`/leagues/${SEED_LEAGUE.slug}/seasons/darts-1/matches`);
		await expect(page.getByText("Remove Latest")).toBeVisible();
		await page.getByText("Remove Latest").click();
		await expect(page.getByTestId("remove-match-dialog")).toBeVisible();
		await page.getByTestId("remove-match-confirm-button").click();

		// Winner's score should be rolled back
		await page.goto(`/leagues/${SEED_LEAGUE.slug}/seasons/darts-1`);
		if (firstPlayerId) {
			await expect
				.poll(async () => {
					const el = page
						.locator(`[data-testid="standing-score-${firstPlayerId}"]:visible`)
						.first();
					return Number.parseInt((await el.textContent()) || "0", 10);
				})
				.toBe(initialScores[firstPlayerId] ?? 0);
		}
	});
});
```

Note: verify the actual testids used by `RemoveMatchDialog` (`remove-match-dialog`, `remove-match-confirm-button`) by reading `remove-match-dialog.tsx` before finalizing. The `remove` path already reverts per-player scores in `matchRepository.remove`, so rollback works for darts matches unchanged.

- [ ] **Step 2: Run the e2e test**

Run: `bun run test:e2e -- darts-match-crud` (from `apps/e2e`)
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/e2e/tests/darts-match-crud.spec.ts
git commit -m "test(e2e): add darts match CRUD e2e"
```

---

### Task 12: Post-change verification

- [ ] **Step 1: Full check + tests**

Run from repo root: `bun check && bun run test`
Expected: all pass (worker unit + integration, util, lint, format).

- [ ] **Step 2: Typecheck both apps explicitly**

Run: `bun typecheck` (from `apps/web`) and `bun typecheck` (from `apps/worker`)
Expected: PASS.

- [ ] **Step 3: Manual UI verification**

Run `bun dev` and open `http://scorebrawl.localhost:1355`. Log in as `seed@scorebrawl.com`. Create a `1-v-N Darts ELO` season, then record a 4-player game via the darts dialog and confirm the standings update and match row shows the game type. Use the **agent-browser** skill if browser automation is desired.
