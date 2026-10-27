# Season Close Ceremony Implementation Plan

**Goal:** On a closed season, show a champion banner, player/team podiums and "biggest moments", plus a "Start next season" CTA, on web and mobile.

**Spec:** `docs/features/done/03-season-close-ceremony.md`

## Decisions

- One new tRPC procedure `season.getSummary` (`seasonProcedure`). It runs four queries in parallel (player standings, team standings, highlights, counts). No N+1.
- Highlights come from existing data only:
  - Longest win streak: gaps-and-islands window query over `match_player`, ordered by `created_at, rowid`.
  - Biggest upset: decisive match with the lowest winner `*_expected_elo` (elo seasons only; null odds are skipped).
  - Biggest gain: max `score_after - score_before` in one match.
  - Most matches: derived from player standings in memory.
- Champions = all players tied at the top score (same rule as `awardSeasonWinner`). Empty when the season has no matches.
- Team-based seasons: player podium always; team podium only when team standings with matches exist.
- Ceremony shows above the normal dashboard when `season.closed`. The dashboard stays below.
- "Start next season" (owner/editor) opens the existing create-season dialog and navigates to the new season. Mobile `CreateSeasonForm` got an optional `onSuccess(slug)`.
- `season_winner` stays as is (unique per player + type, `onConflictDoNothing`).

## Steps

1. Done: `seasonRepository.getHighlights` + `season.getSummary`.
2. Done: integration tests in `apps/worker/test/trpc/season-router.spec.ts` (`getSummary` empty/elo/team cases; close → reopen → close does not duplicate `season_winner`).
3. Done: web `season-ceremony.tsx` (banner, podiums, highlights, CTA) wired into the season page.
4. Done: mobile `components/season/season-ceremony.tsx` wired into `SeasonDashboard`.
5. Done: UI check with agent-browser (desktop 1440 px and phone 390 px) as `seed@example.com` after locking `season-1`.
6. Done: mobile web smoke suite, `bun check && bun run test`.
7. Done: spec + plan moved to `docs/features/done/`, README updated.

## Key files

- `apps/worker/src/repositories/season-repository.ts` (`getHighlights`)
- `apps/worker/src/trpc/router/season-router.ts` (`getSummary`)
- `apps/worker/test/trpc/season-router.spec.ts`
- `apps/web/src/routes/_authenticated/_sidebar/leagues/$slug/seasons/-components/season/season-ceremony.tsx`
- `apps/web/src/routes/_authenticated/_sidebar/leagues/$slug/seasons/$seasonSlug/index.tsx`
- `apps/mobile/src/components/season/season-ceremony.tsx`, `season-dashboard.tsx`, `create-season-form.tsx`

## Verify

- `bun --cwd apps/worker run test test/trpc/season-router.spec.ts`
- `bun dev`, sign in as `seed@example.com`, Seasons → Lock Season on "Season 1", open the season.

## Open questions

- Biggest upset for `1-v-n-elo` and `3-1-0` seasons is empty when expected odds are null. Fine for now.
- `season_winner` is one achievement per player, not per season, so a repeat champion does not get a second badge.
