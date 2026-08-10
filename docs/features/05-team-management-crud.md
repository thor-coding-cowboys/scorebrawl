# Team Management (Create / Edit / Roster)

## Summary

Full CRUD for teams. Today teams are only auto-created from match lineups; owners/editors cannot create named teams up front, manage rosters, or delete them.

## Why / Goal

Teams are a first-class concept (standings, profiles, rivalries) but management is invisible. Fixed teams (e.g. office pool pairs, real clubs) can't be pre-registered, and members can't be added/removed cleanly.

## Scope

- Create team with name + optional logo
- Edit team name/logo
- Add / remove players from a team roster (repo functions already exist)
- Delete team (with rules about teams that have season/match history)
- Optional: pre-register teams for a season before matches start
- Team list filters (already has "My teams" switch)

## Code map

- Router gap: `apps/worker/src/trpc/router/league-team-router.ts` (no create/delete/member procedures)
- Ready-to-use repo fns: `apps/worker/src/repositories/team-repository.ts` (`addPlayerToTeam`, `removePlayerFromTeam`)
- Teams page: `apps/web/src/routes/_authenticated/_sidebar/leagues/$slug/teams/index.tsx`
- Team detail: `apps/web/src/routes/_authenticated/_sidebar/leagues/$slug/teams/$teamId/index.tsx`

## Acceptance criteria

- Owner/editor can create, rename, and delete teams
- Roster add/remove works and reflects in team profile + standings
- Deleting a team with match history is blocked or shows a clear warning
- Permissions: only owner/editor (and team members for name) per existing `leagueTeam.edit` rule

## Open questions / notes

- Deleting a team that has matches: what happens to historical records (soft-delete vs block)?
- Should auto-created teams from lineups be mergeable/renamable into permanent teams?
