# Standings & Stats CSV Export

## Summary

Export standings, match lists, and player stats to CSV for league organizers.

## Why / Goal

Office leagues commonly need results for prizes, spreadsheets, or internal leaderboards. A one-click export is cheap and high-value for organizers.

## Scope

- Export buttons on: season standings, matches list, players list, team standings
- Server-side CSV generation (tRPC query returning CSV text) or client-side from fetched data
- Filename with league/season/date; proper UTF-8 + escaping
- Export respects current filters where feasible

## Code map

- Data already available via `seasonPlayer.getStanding`, `match.getAll`, `leagueTeam.list`, `player.getAll`
- Export actions: `apps/worker/src/trpc/router/` (or a small new `export` router)
- UI buttons: season dashboard `.../seasons/$seasonSlug/index.tsx`, matches page `.../matches.tsx`

## Acceptance criteria

- CSV downloads from the three primary lists (standings, matches, players)
- Exported file opens correctly in Excel/Numbers (BOM, comma handling)
- Matches existing pagination (export full dataset, not just current page)

## Open questions / notes

- Client vs server generation: server-side preferred for consistency with filters/permissions
- Include team standings too (low extra cost)
