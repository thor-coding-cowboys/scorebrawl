# 09 elo-individual-vs-team — Plan

Feature doc: [done/09-elo-individual-vs-team.md](done/09-elo-individual-vs-team.md). PR: [#750](https://github.com/thor-coding-cowboys/scorebrawl/pull/750).

## Decisions

- **Differs from `1-v-n-elo`**: `1-v-n-elo` is free-for-all (one winner vs N losers, `createOneVn`, `calculate1vN`, no draws). `elo-individual-vs-team` is a normal home/away match with scores and draws, using `calculateElo` with `CalculationStrategy.WEIGHTED_TEAMS`.
- **Pairing rule**: each side has 1..n players; sides may differ in size. At least 1 player per side; no player on both sides.
- **Math**: expected score from side average rating. Side change `round(K × (actual − expected))`, split per player as `round(change × teamSize × rating / teamTotal)`. Solo player gets the full change. 1v1 equals `elo`.
- Season teams scored only when both sides have 2+ players (same as `elo`).
- Sessions keep equal `teamSize` lineups (valid for this mode). No change.
- No REST / MCP season creation exists, so nothing to gate there.

## Steps

| #   | Step                                                                                           | Status  |
| --- | ---------------------------------------------------------------------------------------------- | ------- |
| 1   | Accept type in `season.create`; store with ELO settings in `season-repository.create`          | done    |
| 2   | `match.create`: skip equal-size check for this type; reject duplicate players (all types)      | done    |
| 3   | `getOrInsertTeam`: exact-roster team match (superset bug exposed by uneven sides)              | done    |
| 4   | `WEIGHTED_TEAMS` unit tests (`packages/util`)                                                  | done    |
| 5   | Worker integration tests (`elo-individual-vs-team-match-router.spec.ts`)                       | done    |
| 6   | Web: create/edit season forms, season list icon, season page dialog, match dialog uneven sides | done    |
| 7   | Mobile: score type card, season list/edit config, match modal uneven sides                     | done    |
| 8   | Core theme token `scoreType.individualVsTeamElo`                                               | done    |
| 9   | `bun check && bun run test`                                                                    | done    |
| 10  | UI verification with agent-browser (`https://scorebrawl.localhost:1355`, `seed@example.com`)   | blocked |
| 11  | Move this plan to `done/`, README row to Done                                                  | todo    |

## Key files

- `apps/worker/src/trpc/router/season-router.ts`, `apps/worker/src/repositories/season-repository.ts`
- `apps/worker/src/trpc/router/match-router.ts`, `apps/worker/src/repositories/match-repository.ts`
- `packages/util/src/elo-util/` (engine + spec)
- `apps/worker/test/trpc/elo-individual-vs-team-match-router.spec.ts`
- Web: `apps/web/src/routes/_authenticated/_sidebar/leagues/$slug/seasons/` (`index.tsx`, `$seasonSlug/index.tsx`, `-components/seasons/{create,edit}-season-form.tsx`, `-components/match/create-match-drawer.tsx`)
- Mobile: `apps/mobile/src/components/{score-type-card,create-season-form,create-match-modal}.tsx`, `apps/mobile/src/app/(drawer)/(stack)/seasons/index.tsx`
- `packages/core/src/theme/tokens.ts`

## Verify

- `bun --cwd packages/util run test`; `bun --cwd apps/worker run test test/trpc/elo-individual-vs-team-match-router.spec.ts`
- `bun check && bun run test`
- UI: create season "Solo vs Team ELO", record 1v2 match on season page, check standings (solo +16, team −16 each at 1000/K32).

## UI verification blocker

`bun dev` from this worktree registers with the shared portless proxy (PID 63205) and serves this code at `http://scorebrawl.localhost:1355`. The proxy serves HTTP only. `BETTER_AUTH_URL` and the Google emulator redirect use `https://scorebrawl.localhost:1355`, so the OAuth callback fails:

- Browser: `chrome-error://chromewebdata/` after picking `seed@example.com`
- curl: `LibreSSL/3.3.6: error:1404B42E:SSL routines:ST_CONNECT:tlsv1 alert protocol version`

The proxy was not changed. To finish: run the proxy with HTTPS (or restart it from this repo), then sign in and run the UI check in "Verify".

## Open questions

- Should sessions support uneven lineups for this mode? Not in scope.
