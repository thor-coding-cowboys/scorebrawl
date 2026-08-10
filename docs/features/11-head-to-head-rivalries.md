# Head-to-Head Rivalry Records on Player Profiles

## Summary

Show per-pair head-to-head records ("Emma vs Fatima: 5W–2L") on player profiles and a dedicated rivalry view.

## Why / Goal

Rivalries are the emotional core of a competition app. The data already exists (`comparePlayers`, per-opponent breakdown) but is only surfaced via the explicit compare page. Making it visible per-player turns passive stats into stories.

## Scope

- On player profile, list opponents ordered by matches played with W/D/L record
- Link each opponent row to the compare page
- Optional: "rival" highlight (most-played / most contentious opponent)
- Team equivalent (team vs team records already exist via `getRivalTeams`)

## Code map

- Per-opponent W/L breakdown: `apps/worker/src/trpc/router/player-router.ts` (`getPlayerStats`)
- Compare: `apps/worker/src/trpc/router/player-router.ts` (`comparePlayers`), UI at `apps/web/src/routes/_authenticated/_sidebar/leagues/$slug/players/compare.tsx`
- Team rivalries: `apps/worker/src/trpc/router/league-team-router.ts` (`getRivalTeams`)
- Player profile UI: `.../players/$leaguePlayerId/index.tsx`

## Acceptance criteria

- Player profile shows head-to-head list with W/D/L + link to compare
- Query is a single join (no N+1 per opponent)
- Works for ELO seasons (profile pages are ELO-gated today)

## Open questions / notes

- Where to place on profile (existing "Best/Worst Teammate" cards area or new tab)
- Pagination for opponents with many matches
