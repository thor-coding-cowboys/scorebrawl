# Session UX Improvements — Post-Commit Review & Fix Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix bugs, security gaps, and missing tests from commit e54260b (session UX improvements).

**Architecture:** Patch the existing `joinSelf` route, complete the incomplete session-end navigation, add integration tests, and clean up type safety + style issues.

**Tech Stack:** tRPC, Drizzle, Cloudflare Workers (D1), Vitest, TanStack Router, React

---

## Review Summary

Commit `e54260b` implements 4 features from `session-ux-improvements.md`. This plan addresses issues found in post-commit review, ordered by severity.

---

## Task 1: Fix `broadcastSeasonEvent` in `joinSelf` — SSE broken (BUG, HIGH)

**Problem:** `joinSelf` passes `sessionInfo.leagueId` (UUID) as second arg to `broadcastSeasonEvent`, but every other call in the file passes `ctx.organization.slug` (string slug). The function constructs a Durable Object ID from `${leagueSlug}/${seasonSlug}`, so the broadcast goes to a nonexistent DO. No client receives the event.

**Root cause:** `joinSelf` uses `protectedProcedure` so `ctx.organization` is unavailable. `getSessionWithSeason` only returns `leagueId`, not the org slug.

**Fix options:**

1. **Switch `joinSelf` to `leagueMemberProcedure`** — gives `ctx.organization.slug`. Requires adding `seasonSlug` to input or deriving it. Also fixes the auth gap (Task 2). _Preferred._
2. **Join `organization` table in `getSessionWithSeason`** to also return slug. Keeps `protectedProcedure`.

**Recommended:** Option 1. Aligns with every other mutation in the router + fixes auth.

**Files:**

- Modify: `apps/worker/src/trpc/router/session-router.ts:108-175`

**Step 1:** Change `joinSelf` from `protectedProcedure` to `leagueMemberProcedure`.

```typescript
joinSelf: leagueMemberProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
```

**Step 2:** Replace `sessionInfo.leagueId` with `ctx.organization.slug` in the broadcast call:

```typescript
await broadcastSeasonEvent(ctx.env, ctx.organization.slug, sessionInfo.seasonSlug, {
```

**Step 3:** Remove unused `leagueMemberProcedure` → already imported (was added in this commit alongside `protectedProcedure`). Remove `protectedProcedure` import if no longer used.

**Step 4:** Run `bun typecheck` — verify no errors.

---

## Task 2: Add session status check to `joinSelf` (BUG, MEDIUM)

**Problem:** `joinSelf` never checks `session.status === "active"`. Users can join ended sessions.

**Files:**

- Modify: `apps/worker/src/repositories/session-repository.ts:1140-1160` — add `status` to `getSessionWithSeason` select
- Modify: `apps/worker/src/trpc/router/session-router.ts` — add status guard after fetching session

**Step 1:** Add `sessionStatus: gameSession.status` to the select in `getSessionWithSeason`.

**Step 2:** After the NOT_FOUND check in `joinSelf`, add:

```typescript
if (sessionInfo.sessionStatus !== "active") {
	throw new TRPCError({ code: "BAD_REQUEST", message: "Session is not active" });
}
```

---

## Task 3: Complete Phase 3 — session-end navigation + toast (INCOMPLETE FEATURE)

**Problem:** Commit message claims "SSE session-end navigation with toast notification" but only the data plumbing was done (`userName` added to event detail). No handler consumes `userName` or navigates on `session:end`.

**Files:**

- Modify: `apps/web/src/routes/_authenticated/_sidebar/leagues/$slug/seasons/$seasonSlug/session/$sessionId/index.tsx:79-91`

**Step 1:** In the `session-event` listener, handle `session:end` with navigation + toast:

```typescript
if (detail.type === "session:end" && detail.sessionId === sessionId) {
	if (detail.userName) {
		toast.info(`Session ended by ${detail.userName}`);
	}
	navigate({ to: "../../", replace: true });
	return;
}
```

Note: `navigate({ to: "../../" })` goes up from `/session/$sessionId` to the season page. Verify the correct relative path. May need to navigate to a summary route instead — check if a summary route exists.

**Step 2:** Ensure `navigate` is available (from `useNavigate()` or route context). Check if it's already imported/used in the component.

---

## Task 4: Merge `joinSelf` DB queries (PERFORMANCE)

**Problem:** 3 sequential queries: session lookup, season player lookup, existing player check. Cloudflare Workers have strict CPU limits.

**Files:**

- Modify: `apps/worker/src/trpc/router/session-router.ts`

**Step 1:** Combine season player lookup + existing player check into one query:

```typescript
const [seasonPlayerRecord] = await ctx.db
	.select({
		id: seasonPlayer.id,
		alreadyInSession: sql<boolean>`EXISTS(
            SELECT 1 FROM ${sessionPlayer}
            WHERE ${sessionPlayer.sessionId} = ${input.sessionId}
            AND ${sessionPlayer.seasonPlayerId} = ${seasonPlayer.id}
        )`.as("already_in_session"),
	})
	.from(seasonPlayer)
	.innerJoin(player, eq(seasonPlayer.playerId, player.id))
	.where(
		and(
			eq(seasonPlayer.seasonId, sessionInfo.sessionSeasonId),
			eq(player.userId, ctx.authentication.user.id)
		)
	)
	.limit(1);
```

Then check `seasonPlayerRecord.alreadyInSession` instead of a separate query. Reduces from 3 queries to 2.

---

## Task 5: Remove redundant type assertion (TYPE SAFETY)

**Problem:** `session/index.tsx:246` has `as ((home: number, away: number) => void) & { cancel: () => void }` — the `debounce` utility already returns this type.

**Files:**

- Modify: `apps/web/src/routes/.../session/$sessionId/index.tsx:246`

**Step 1:** Remove the `as` cast. If TS still complains, type the callback parameter explicitly instead.

**Step 2:** Run `bun typecheck`.

---

## Task 6: Add `useRef` cleanup for shuffle timeout (UX ROBUSTNESS)

**Problem:** `triggerShuffleAnimation` uses `setTimeout(600)` with no cleanup. If component unmounts or multiple rapid calls happen, callbacks fire on stale/unmounted state.

**Files:**

- Modify: `apps/web/src/routes/.../session/$sessionId/index.tsx`

**Step 1:** Add a ref to track the timeout:

```typescript
const shuffleTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
```

**Step 2:** Clear previous timeout in `triggerShuffleAnimation`:

```typescript
const triggerShuffleAnimation = (onComplete: () => void) => {
	if (shuffleTimeoutRef.current) clearTimeout(shuffleTimeoutRef.current);
	setIsShuffling(true);
	setTeamAssignment((prev) => prev.map((p) => ({ ...p, team: undefined })));
	shuffleTimeoutRef.current = setTimeout(() => {
		setIsShuffling(false);
		onComplete();
	}, 600);
};
```

**Step 3:** Add cleanup in a `useEffect`:

```typescript
useEffect(() => {
	return () => {
		if (shuffleTimeoutRef.current) clearTimeout(shuffleTimeoutRef.current);
	};
}, []);
```

---

## Task 7: Remove redundant comments (STYLE)

**Problem:** Two comments in `joinSelf` violate "No redundant comments" repo standard.

**Files:**

- Modify: `apps/worker/src/trpc/router/session-router.ts`

**Step 1:** Remove:

- `// Look up seasonPlayer for this user in the session's season` (line ~123)
- `// Check if already in session` (line ~143)

---

## Task 8: Write integration tests for `joinSelf` (TESTS)

**Files:**

- Modify or create: `apps/worker/src/test/trpc/session-router.spec.ts`

**Test cases:**

1. **Happy path** — authenticated user who is a season player joins active session → returns player data, player appears in session
2. **Not a season player** — user not in the season → NOT_FOUND error
3. **Already in session** — user calls joinSelf twice → CONFLICT error on second call
4. **Session not found** — invalid sessionId → NOT_FOUND error
5. **Session ended** — try to join ended session → BAD_REQUEST error (after Task 2)

Use existing test patterns: `createTRPCTestClient`, seed helpers from `apps/worker/src/test/setup/`.

**Step 1:** Write failing tests.
**Step 2:** Verify tests pass after Tasks 1-4 are applied.
**Step 3:** Run `bun run test`.

---

## Task 9: Run full verification

**Step 1:** `bun oxc` — lint + format
**Step 2:** `bun typecheck` — type check
**Step 3:** `bun run test` — all tests pass
**Step 4:** `bun check` — full check if available

---

## Execution Order

Tasks 1-2 are critical bugs — do first. Task 3 completes an advertised feature. Tasks 4-7 are improvements. Task 8 validates everything. Task 9 is final verification.

Dependency graph:

```
Task 1 (SSE fix) ─┐
Task 2 (status)  ─┤
Task 3 (nav)     ─┤
Task 4 (perf)    ─┼─→ Task 8 (tests) → Task 9 (verify)
Task 5 (types)   ─┤
Task 6 (cleanup) ─┤
Task 7 (style)   ─┘
```

Tasks 1-7 can be done in parallel. Task 8 depends on all. Task 9 is final.
