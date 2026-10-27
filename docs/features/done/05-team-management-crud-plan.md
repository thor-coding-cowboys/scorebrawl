# Team Management CRUD Plan

**Goal:** Owners/editors can create, rename and delete teams and manage team rosters, on web and mobile.

**Spec:** `docs/features/done/05-team-management-crud.md`

**PR:** [#752](https://github.com/thor-coding-cowboys/scorebrawl/pull/752)

## Decisions

- New procedures use `leagueEditorProcedure` (owner/editor). Rename stays on `leagueTeam.edit` (owner/editor + team members).
- `create` takes `name` (trimmed, 1–100) and optional `imageData`. Logo upload shares one `storeTeamLogo` helper with `uploadLogo`.
- `delete` is blocked with `PRECONDITION_FAILED` ("This team has match history and cannot be deleted") when any `match_team` row points at the team's `season_team`. Otherwise hard delete; `league_team_player` and `season_team` rows cascade. Logo removed from R2. No soft-delete.
- `addPlayer` / `removePlayer` reuse `addPlayerToTeam` / `removePlayerFromTeam`. Team, player and membership are checked in one `db.batch` (no N+1). Duplicate add → `CONFLICT`; remove of non-member → `NOT_FOUND`; team/player from other league → `NOT_FOUND`.
- `getTeamPlayersWithDetails` left-joins `user` and `guest`, so guest players show on the roster.
- No schema change.

## Steps

1. **done** — Worker procedures in `apps/worker/src/trpc/router/league-team-router.ts`.
2. **done** — Integration tests `apps/worker/test/trpc/league-team-crud.spec.ts` (create, logo, editor/member permissions, roster add/remove/duplicate/cross-league, blocked delete, delete).
3. **done** — Web: create dialog on teams page (`teams/-components/create-team-dialog.tsx`); roster card with add/remove (`teams/$teamId/-components/team-roster-card.tsx`) and delete with confirm dialog on team page.
4. **done** — Mobile: `apps/mobile/src/app/(drawer)/(stack)/teams.tsx` — "Team" header button opens create modal; edit modal has roster add/remove and delete (Alert confirm). Mobile has no team detail screen.
5. **done** — UI check with agent-browser as `seed@example.com` on seeded data: create → team page, add 2 players, remove 1, delete with confirm, blocked delete toast on a team with 1 match. The shared portless proxy was HTTP only, so the emulator callback was replayed on `http://scorebrawl.localhost:1355`. Mobile checked by typecheck only (no simulator run).
6. **done** — Spec + plan moved to `docs/features/done/`, README row in Done with PR link.

## Key files

- `apps/worker/src/trpc/router/league-team-router.ts`
- `apps/worker/src/repositories/team-repository.ts`
- `apps/worker/test/trpc/league-team-crud.spec.ts`
- `apps/web/src/routes/_authenticated/_sidebar/leagues/$slug/teams/index.tsx`
- `apps/web/src/routes/_authenticated/_sidebar/leagues/$slug/teams/$teamId/index.tsx`
- `apps/mobile/src/app/(drawer)/(stack)/teams.tsx`

## Verify

- `bun --cwd apps/worker run test test/trpc/league-team-crud.spec.ts`
- `bun check && bun run test`
- Browser: teams page → "Team" → create → lands on team page → "Add player" → remove → delete (confirm) → back on list. Delete on a team with matches shows the error toast.

## Open questions

- Match lineups find a team by "team contains all lineup players" (`getOrInsertTeam` in `match-repository.ts`). With editable rosters, a lineup can match a larger team. The feature 09 branch changes this to exact-roster matching. Two teams can still share one roster; nothing blocks that.
- Pre-register teams for a season before matches start: not done.
- Merge auto-created teams into permanent teams: not done.
