# League Activity Feed

## Summary

A "what happened" timeline per league/season showing recent matches, streaks, records, and milestones as they occur.

## Why / Goal

The app produces a huge amount of analytics but there is no single place to see league activity at a glance. An activity feed turns the stored match/streak data into a living story and gives the league dashboard a natural centerpiece.

## Scope

- Activity feed query aggregating recent events: matches recorded, streaks hit, achievements earned, sessions started/ended, records broken
- Feed timeline UI on the season dashboard (replacing/augmenting "Latest Match")
- Load more / pagination
- Optionally: activity feed page per league across all seasons
- Live updates via existing SSE

## Code map

- Match events: `apps/worker/src/trpc/router/match-router.ts` (+ `match-repository.ts` streak detection)
- Weekly/period stats already available: `seasonPlayer.getWeeklyStats`, `seasonTeam.getWeeklyStats`
- Season dashboard: `apps/web/src/routes/_authenticated/_sidebar/leagues/$slug/seasons/$seasonSlug/index.tsx` and `-components/season/*`
- Records/upsets logic exists in MCP tools: `apps/worker/src/services/mcp-tools/tool-executors.ts`

## Acceptance criteria

- Season dashboard shows a chronological activity feed
- Feed updates live via SSE (new match/streak/achievement appears without refresh)
- Feed is paginated and performant (single aggregate query, no N+1)
- Each feed item links to the relevant match/player/achievement

## Open questions / notes

- Which event types to include in v1 (start with match + streak)
- Whether to build a dedicated activity log table or derive from existing match/streak data
