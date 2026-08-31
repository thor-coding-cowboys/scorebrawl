# Fixtures & Points-Season (3-1-0) UX

## Summary

Polish the round-robin / scheduled-match experience for 3-1-0 points seasons. Fixtures are auto-generated but have minimal UI and no easy way to enter results.

## Why / Goal

3-1-0 seasons (league-style, e.g. office football) generate a full fixture schedule on creation, but users can only see a basic fixtures list and enter results one-by-one. A proper fixture UI makes points seasons competitive and easy to run.

## Scope

- Fixtures overview page: rounds, date, home/away, result state (played/pending)
- Enter/edit result directly from a fixture row (`createFromFixture` exists)
- Per-round grouping + round navigation
- Standings that update with fixture results (3-1-0 standings already exist via `seasonPlayer.getStanding`)
- Fixture re-schedule/swap (optional, stretch)

## Code map

- Fixture generation: `apps/worker/src/repositories/season-repository.ts` (circle method), triggered in `season-router.ts` `create`
- Fixture result entry: `apps/worker/src/trpc/router/match-router.ts` (`createFromFixture`)
- Fixtures component: `apps/web/src/routes/_authenticated/_sidebar/leagues/$slug/seasons/-components/season/fixtures.tsx`
- Season page tabs already switch views; add fixtures tab

## Acceptance criteria

- Fixtures render grouped by round with played/pending state
- Clicking an unplayed fixture opens the score entry for that fixture
- Entering a result updates standings immediately
- Works for single-player 3-1-0 seasons (that's the mode fixtures are generated for)

## Open questions / notes

- Should fixtures be supported for ELO seasons too, or keep 3-1-0 only for now?
- Re-scheduling fixtures is likely a later iteration
