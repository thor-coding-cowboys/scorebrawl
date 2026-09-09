# Achievements Showcase & Celebration

Date: 2026-09-09

## Status

Design approved. References `docs/features/02-achievements-showcase.md`.

## Goal

Make the achievement engine visible: player profiles show all 13 achievement types with earned/locked states, a league-wide achievements board shows "who has what" and most-decorated players, and unlocking an achievement triggers a confetti celebration for the player who earned it.

## Decisions

- **Metadata location (Approach A)**: frontend-only `achievementCatalog` module in `apps/web/src/lib/achievements.ts`. The `achievementType` enum remains the backend contract; display metadata (name, description, icon, requirement) lives once in the web app.
- **`season_winner`**: granted to all players tied at the top season score when a season is closed (`updateClosedStatus`). Remains excluded from `calculateAchievements` until story 03 computes it.
- **Board placement**: dedicated page `/leagues/$slug/achievements` with a sidebar entry.
- **Locked cards**: static requirement text (no live progress computation).
- **Celebration**: toast + full-screen confetti flyout for the current user's own unlock; toast only for everyone else.

## Backend (worker)

### 1. `apps/worker/src/repositories/achievement-repository.ts`

- `getAchievements`: add `createdAt` to the select. Returns `{ type, createdAt }[]`.
- New `getLeagueBoard({ db, leagueId })`: single query selecting all `playerAchievement` rows joined to `player` (with `name`, `image`) filtered by `player.leagueId = leagueId`. Returns `{ playerId, name, image, type, createdAt }[]`. Frontend groups into per-type holders and per-player counts.

### 2. `apps/worker/src/trpc/router/achievement-router.ts`

- New `getLeagueBoard: leagueProcedure.query` → repository call.

### 3. `season_winner` on season close

In `apps/worker/src/trpc/router/season-router.ts`, `updateClosedStatus`:

- When `input.closed === true`, determine the max season score and grant `season_winner` to all season players at that score via `achievementRepository.addAchievement` (idempotent via unique index + `onConflictDoNothing`).
- No SSE broadcast for `season_winner` in this story.
- Ties at the top score all receive the achievement.

## Frontend (web)

### 4. Metadata module — `apps/web/src/lib/achievements.ts`

- `achievementCatalog: Record<AchievementType, { name, description, icon, requirement }>` covering all 13 types.
- Icons: Hugeicons, per-type (fire/shield/comeback/goal families with escalating tiers; trophy/crown for `season_winner`).
- `requirement` is static text (e.g. "Win 5 matches in a row").
- Replaces/augments `formatAchievementName`.

### 5. Profile grid — `apps/web/src/routes/_authenticated/_sidebar/leagues/$slug/players/$leaguePlayerId/index.tsx`

- Render all 13 types from the catalog.
- Earned: colored icon + date earned (`createdAt`).
- Locked: dimmed icon + requirement text.
- Empty state shows locked cards instead of "No achievements yet".

### 6. League board page — `/leagues/$slug/achievements`

- New route file `apps/web/src/routes/_authenticated/_sidebar/leagues/$slug/achievements/index.tsx` (directory structure, not dot notation).
- Sidebar entry "Achievements" (trophy icon) in `apps/web/src/routes/-components/sidebar/app-sidebar.tsx`.
- Renders from the single `getLeagueBoard` query:
  - "Most decorated players": ranking by achievement count (avatar, count, unlocked types).
  - Grid of all 13 types: holders' avatars per type, or "nobody yet".
- Player click navigates to their profile.

### 7. Confetti celebration — `apps/web/src/routes/-components/achievement-flyout.tsx`

- Cloned structure from `streak-flyout.tsx`: full-screen overlay, event queue, enter/visible/exit phases, click-to-dismiss, sessionStorage dedupe.
- Confetti style: multicolor confetti particles + radial burst (no fire/ice gradients).
- Title "ACHIEVEMENT UNLOCKED", subtitle with player + achievement name, per-type achievement icon instead of streak avatar.
- Triggered in `apps/web/src/hooks/use-season-sse.tsx`: on `achievement:unlock` where `player.id === currentUserId` → toast + flyout; others → toast only.
- Mounted in `apps/web/src/routes/__root.tsx` next to `<StreakFlyout />`.

## Testing

- Worker integration tests (Vitest, `apps/worker/src/test/trpc/`, `createTRPCTestClient`):
  - `getLeagueBoard` returns league-scoped achievement rows with player info.
  - `updateClosedStatus` with `closed: true` grants `season_winner` to top-scoring player(s); idempotent on re-close.
- Frontend: verify via agent-browser at `https://scorebrawl.localhost:1355`, login `seed@scorebrawl.com`:
  - Profile grid shows earned + locked states with dates.
  - Board page renders from a single query with holders and most-decorated ranking.
  - Unlocking an achievement shows the confetti flyout for the owner.

## Out of scope

- `season_winner` computation in `calculateAchievements` (story 03-season-close-ceremony).
- Notification inbox (01-b) — the confetti flyout is standalone.
- Live progress indicators on locked cards.
- SSE broadcast for `season_winner` unlocks.