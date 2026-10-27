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

## Pairing rule

- Each side has 1..n players; sides may differ in size (1v2, 1v3, 2v3, 2v2, …). Both sides need at least 1 player and a player cannot be on both sides.
- Expected score uses each side's average rating (same as `elo`).
- The side's rating change is `round(K × (actual − expected))`. `WEIGHTED_TEAMS` splits it per player as `round(change × teamSize × rating / teamTotalRating)`, so higher-rated members gain or lose more. A solo player gets the full change.
- 1v1 gives the same result as `elo`.
- Season teams (`seasonTeam`) are only scored when both sides have 2+ players, like `elo`.
- Sessions still use equal `teamSize` lineups; that is valid for this mode.

## Implementation

- `season.create` accepts the type; repository stores it with ELO settings (`initialScore`, `kFactor`, no rounds).
- `match.create` skips the equal-size check for this type and rejects duplicate players for all types.
- `getOrInsertTeam` now matches a league team only when its roster is exactly the side's players (before, a 2-player side could match a 3-player team that contained both).
- Web: create/edit season forms ("Solo vs Team ELO"), season list icon, season page shows the match dialog, match dialog allows uneven sides.
- Mobile: score type card, edit season modal, season list config, match modal allows uneven sides.
- Theme token `scoreType.individualVsTeamElo` (amber).
- Tests: `packages/util/src/elo-util/elo-util.spec.ts`, `apps/worker/test/trpc/elo-individual-vs-team-match-router.spec.ts`.
- No public REST / MCP season creation exists, so no change there.
