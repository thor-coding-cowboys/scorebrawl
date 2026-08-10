# elo-individual-vs-team Score Type

## Summary

Wire up the `elo-individual-vs-team` score type end-to-end. The ELO engine and DB schema already support it (`WEIGHTED_TEAMS` strategy); season creation only offers `elo` or `3-1-0`.

## Why / Goal

This is the mode for games where an individual player can face a team (e.g. king of the hill, singles vs pairs, fighting games with tag formats). The heavy lifting is done — exposing it is low effort and unlocks a new game format.

## Scope

- Accept `elo-individual-vs-team` in `season.create` validation
- Team-size validation for this mode (one side size 1, other side 1..n, or defined rule)
- Verify ELO weighting math via `WEIGHTED_TEAMS` strategy and add tests
- UI: allow selecting the mode in the create-season dialog with an explanatory description
- Standings/profiles already derive from `seasonPlayer`/`seasonTeam` so should work once matches can be created

## Code map

- Engine strategy: `packages/util/src/elo-util` (`WEIGHTED_TEAMS`), used in `apps/worker/src/repositories/match-repository.ts`
- Schema enum: `apps/worker/src/db/schema/league-schema.ts` (`scoreType`)
- Validation gate: `apps/worker/src/trpc/router/season-router.ts` `create` (currently `"elo" | "3-1-0"`)
- Create-season UI: `apps/web/src/routes/_authenticated/_sidebar/leagues/$slug/seasons/-components/seasons/create-season-form.tsx`

## Acceptance criteria

- A season of type `elo-individual-vs-team` can be created and matches recorded
- ELO math produces expected outcomes in tests
- Create-season dialog exposes the mode

## Open questions / notes

- Define the exact pairing rule (fixed 1vN? any?) before implementing
- Confirm `getById`/profile pages that are ELO-only gate correctly for this type
