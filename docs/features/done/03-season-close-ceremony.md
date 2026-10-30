# Season Close Ceremony & Champion Crowning

## Status

Done — `season_winner` granted on close (#661); ceremony view with champion banner, player/team podium, biggest moments and "Start next season" CTA on web and mobile (#753). Plan: [`03-season-close-ceremony-plan.md`](03-season-close-ceremony-plan.md).

## Summary

A satisfying end-of-season flow: closing a season crowns the champion and shows a podium/ceremony view.

## Why / Goal

Seasons can currently be closed ("Lock Season") but nothing celebrates the result. This completes the core product loop (start season → compete → crown champion → repeat) and gives players a reason to return.

## Scope

- Compute and award `season_winner` achievement to the top player/team when a season closes
- Season champion banner/podium view (leader, final standings, stats)
- Season summary page showing final placements, champion, biggest moments
- "Start next season" CTA from the ceremony view
- Ensure awards are idempotent (no duplicate achievements if closed twice)

## Code map

- Season close: `apps/worker/src/trpc/router/season-router.ts` (`updateClosedStatus`), `season-repository.ts`
- Achievement engine: `apps/worker/src/services/achievement-calculation.ts` (add `season_winner` path)
- Season detail UI: `apps/web/src/routes/_authenticated/_sidebar/leagues/$slug/seasons/$seasonSlug/index.tsx`
- Close dialog: `apps/web/src/routes/_authenticated/_sidebar/leagues/$slug/seasons/-components/seasons/close-season-dialog.tsx`

## Acceptance criteria

- Closing a season awards `season_winner` exactly once to the champion
- Champion/ceremony view renders with final standings
- Re-opening a closed season and re-closing does not duplicate achievements
- Pairs with `done/02-achievements-showcase.md` for display

## Open questions / notes

- Champion for team-based (3-1-0) seasons: top player vs top team
- Should closing be irreversible (currently `closed` blocks match creation)? Keep existing behavior.
