# Manual Session Lineup Assist

## Summary

Make the `manual` rotation mode functional: it currently has no auto lineup — `computeManualLineup()` returns `null`, so the "Next Match" panel is empty.

## Why / Goal

The manual mode UI (team picker, live score sync) exists and works, but without a proposed lineup it's a weaker experience than winner-stays. This gives manual sessions a sensible default pairing while still allowing full manual override.

## Scope

- Implement lineup proposal for manual mode: pick next players who haven't played recently / haven't paired together (reuse diversity-shuffle heuristics)
- Respect team size, available (non-playing) players, queue state
- Keep the manual team picker override fully working
- Add tests for the strategy

## Code map

- Stub: `apps/worker/src/services/session/strategies/manual.ts` (`computeManualLineup` returns `null`)
- Working reference: `apps/worker/src/services/session/strategies/winner-stays.ts` + session queue logic in `apps/worker/src/services/session/session-service.ts`
- Manual UI: `apps/web/src/routes/_authenticated/_sidebar/leagues/$slug/seasons/$seasonSlug/session/$sessionId/-components/manual/manual-session.tsx` and `team-picker.tsx`
- Tests: `apps/worker/src/test/trpc/` (see session tests)

## Acceptance criteria

- Starting a manual session shows a proposed lineup when enough players are available
- Proposed lineup is editable before starting the match
- Lineup logic prefers diverse pairings (no repeat partners) when possible
- Existing manual team-picker behavior is unchanged

## Open questions / notes

- Should manual mode lineups auto-advance queue state, or purely be a suggestion? (Recommend: suggestion only, winner-stays keeps the queue rules)
