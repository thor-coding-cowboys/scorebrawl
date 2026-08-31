# Achievements Showcase & Celebration

## Summary

Surface the 13 achievement types already computed in the backend as visible, celebratory UI on profiles and league pages.

## Why / Goal

The achievement engine fully works but players never see it — profiles just say "No achievements yet". This makes progression tangible and drives engagement.

## Scope

- Achievement card grid on player profile (earned + locked states, date earned)
- League-wide achievements board (who has what, most decorated players)
- Toast/banner celebration when an achievement unlocks (leveraging `streak`/event infra)
- Achievement metadata (name, description, icon) centralized in one place
- Empty state improvements (show locked achievements so players know what to chase)

## Code map

- Engine: `apps/worker/src/services/achievement-calculation.ts`, `achievement-repository.ts`
- Router: `apps/worker/src/trpc/router/achievement-router.ts` (`getByPlayerId`)
- Profile UI: `apps/web/src/routes/_authenticated/_sidebar/leagues/$slug/players/$leaguePlayerId/index.tsx`
- Achievement types list is in `achievement-calculation.ts` (5/10/15 win streak, clean sheets, redemptions, goals, season winner)

## Acceptance criteria

- Player profile shows all 13 achievement types with earned/locked state
- League achievements board renders from a single query
- Unlock fires an in-app celebration (can depend on 01-notifications)
- Achievement metadata is defined once and reused

## Open questions / notes

- `season_winner` achievement is declared but never computed — see 03-season-close-ceremony
- Iconography: use Hugeicons; need a per-type icon mapping
