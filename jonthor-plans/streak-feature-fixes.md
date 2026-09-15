# Streak Feature Fix Plan

Fixes for commit `5603daa` (streak flyout + streak avatar effects).

## Critical

### 1. N+1 query: `checkStreakThresholds` (match-repository.ts:402-457)

- Queries DB per-player in a loop
- Fix: batch all player streak checks into single query using `inArray` + window functions or subquery
- Fetch all recent matches for all players at once, group by player, compute streaks in JS

### 2. N+1 query: `checkTeamStreakThresholds` (match-repository.ts:489-537)

- Same pattern for teams
- Fix: same approach — single batch query

### 3. `await` in loop: broadcast streak events in `createFromFixture` (match-router.ts:117-128)

- Fix: collect all broadcast promises, `Promise.all`

### 4. `await` in loop: broadcast streak events in `create` (match-router.ts:253-277)

- Two separate loops (players + teams)
- Fix: collect all promises from both loops, single `Promise.all`

## High

### 5. Duplicate `calculateStreak` (standing.tsx:13, team-standing.tsx:16)

- Extract to shared util, e.g. `apps/web/src/lib/streak.ts`

### 6. Duplicate `FormBar` component (standing.tsx:34-83, team-standing.tsx:37-86)

- Extract to `apps/web/src/components/season/form-bar.tsx`

### 7. Broken JSDoc double `/**` (match-repository.ts:380-381)

- Remove duplicate opening

### 8. Missing team streak check in `createFromFixture` (match-router.ts:109-129)

- `create` calls both `checkStreakThresholds` + `checkTeamStreakThresholds`
- `createFromFixture` only calls `checkStreakThresholds`
- Fix: add `checkTeamStreakThresholds` call to `createFromFixture`

### 9. Streak events lack `user` field (match-router.ts:118-128, 253-277)

- Add `user` to streak broadcast events for consistency

## Medium

### 10. Remove `"use client"` directive (streak-avatar.tsx:1)

- Not Next.js, directive has no effect

### 11. `streak-burst` CSS bug (index.css:335-348, streak-flyout.tsx:222)

- `--angle` CSS var never set on burst line elements
- All lines animate from 0deg instead of their individual angles
- Fix: set `style={{ '--angle': `${l.angle}deg` }}` on each element

### 12. Remove debug `console.log` (match-router.ts:219, 236)

### 13. Remove excessive comments

- match-repository.ts, match-router.ts, streak-avatar.tsx
- Per convention: "No redundant comments"

### 14. Self-triggered streak flyout (use-season-sse.ts:105-118)

- User who registers match sees full-screen overlay
- Decide: intentional or skip own events?

### 15. Duplicate threshold logic (match-repository.ts:419-456 vs 503-536)

- Extract shared helper for threshold checking

### 16. Duplicate broadcast construction (match-router.ts:117-128 vs 253-264)

- Extract helper for building streak broadcast events

## Execution Order

1. Fix N+1 queries (#1, #2) — rewrite to batch queries
2. Parallelize broadcasts (#3, #4) + extract broadcast helper (#16)
3. Add team streak to `createFromFixture` (#8) + add `user` field (#9)
4. Extract shared frontend utils (#5, #6)
5. Fix CSS burst bug (#11)
6. Cleanup: remove `"use client"` (#10), console.logs (#12), broken JSDoc (#7), comments (#13)
7. Dedupe threshold logic (#15)
8. Decide on self-triggered flyout (#14)

## Unresolved Questions

- Is the self-triggered flyout intentional? Should the user who registers the match see their own streak flyout?
