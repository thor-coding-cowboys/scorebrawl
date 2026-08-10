# Public Shareable Leaderboard & Results Pages

## Summary

Read-only, publicly shareable league/season pages (standings, latest results) that non-members can view without signing up.

## Why / Goal

Office and friend leagues are social — people share results in chat and want to brag. Today everything requires an account + membership. A public URL per league/season is the cheapest virality + bragging-rights feature.

## Scope

- Opt-in "Make this league public" toggle in league settings (default off)
- Public route rendering standings + recent results without auth
- Share link (copy-to-clipboard) from the league page
- No mutation capabilities on public pages; strip all editing UI
- Optional: read-only "public only" exposure of a subset of analytics

## Code map

- Routes are under `_authenticated` today; a new public route tree is needed (e.g. `_public/leagues/$slug`), see `apps/web/src/routes/_public/home.tsx` for the public layout pattern
- Data sources already exist and are auth-scoped: `seasonPlayer.getStanding`, `match.getAll`
- League metadata/logo: `apps/worker/src/db/schema/league-schema.ts`

## Acceptance criteria

- Public toggle per league; when off, public URLs 404/redirect
- Public page shows standings + latest results for the active season
- Public page has no auth requirement and no write actions
- Share-link button on league page

## Open questions / notes

- Privacy: default-off; consider what data leaks via player names/ELO
- Cache-friendliness for public pages (edge caching opportunity)
