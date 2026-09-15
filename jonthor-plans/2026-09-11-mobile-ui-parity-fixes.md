# Mobile UI Parity Fixes — Plan

8 items. One commit per item. Order chosen to minimise file conflicts.

Notes: mobile icons = `expo-symbols` (`SymbolView`); mobile has no Hugeicons/recharts. Charts omitted or replaced with plain `View` bars.

---

## 1. League header icon not showing

**Files:** `components/active-league-title.tsx`, `components/league-switcher.tsx`, `hooks/use-active-league.ts`

- Confirm `activeLeague.logo` present; render `Avatar` with `image={getAvatarUri(logo)}` + `headers` (auth cookie) — asset endpoint requires cookie.
- Verify on simulator.

## 2. Remove gray box background (ContentPanel)

**Files:** delete `components/content-panel.tsx`; unwrap `ContentPanel` in: `(tabs)/index.tsx`, `seasons/[seasonSlug]/index.tsx`, `players.tsx`, `teams.tsx`, `members.tsx`, `invitations.tsx`, `seasons/index.tsx`.

- Restore content directly on the page background.

## 3. Redo headers (compact, shared)

**Files:** new `components/mobile-header.tsx`; edit the 7 list/season screens + `components/session/session-view.tsx`.

- `MobileHeader`: row, minHeight 44; back chevron (`chevron.left`), league `Avatar` 22 (optional), title `smallBold`/17px (`numberOfLines`), right action slot; margins 8/8.
- Replace `type="title"` (48px) blocks and the `← Back` text link.
- Session view header uses it with `End Session` in the right slot.

## 4. Profile page (mimic web)

**Files:** rewrite `app/profile.tsx`; new `components/profile/edit-profile-modal.tsx`; add `expo-image-picker` dep (catalog).

- Hero: Avatar 96, name, email, `Edit Profile`.
- Stats cards: Leagues (`league.list`), Matches (`user.getTotalMatches`).
- Sessions: `authClient.listSessions`, current badge, per-session sign out, Revoke Other / Revoke All (Alert confirm), plus profile sign out (`queryClient.clear()`).
- Edit modal: name (`authClient.updateUser`), email readonly, avatar upload (`expo-image-picker` base64 → `user.uploadAvatar`), remove avatar (`user.deleteAvatar`).
- Passkeys: Omit (no native WebAuthn). Note in code/PR.

## 5. Player info page

**Files:** move `players.tsx` → `players/index.tsx`; new `players/[playerId].tsx`; new `components/player/*` (header, stat cards, teammate card, achievements, season history list, recent matches); edit `components/standing-row.tsx` (optional `onPress`) + `season-standings.tsx` (navigate with `item.playerId`); `app-tabs.tsx` guard (`pathname.startsWith("/players/")` → no plus).

- Season derived via `season.findActive`; queries: `player.getById`, `getAllTimeStats`, `getBestSeason`, `getBestTeammate`, `getWorstTeammate`, `getSeasonHistory`, `getRecentMatchesWithTeams`, `achievement.getByPlayerId`.
- Charts omitted → per-season list + ELO delta.

## 6. Session summary (view old sessions)

**Files:** move `seasons/[seasonSlug]/session/[sessionId].tsx` → `.../[sessionId]/index.tsx`; new `.../[sessionId]/summary.tsx`; new `components/session/session-summary.tsx`; edit `components/session-history.tsx` (make `SessionRow` a `Pressable` → summary).

- `session.getSummary`: header, 4 cards (Session/Matches/MVP/Teams), player standings with W/L/D + ELO delta, match-by-match feed. Charts omitted (simple bars) — note.
- After `End Session` in `session-view.tsx`, route to summary.

## 7. Create-button slide-out (solid, from the button)

**Files:** `components/app-tabs.tsx`.

- Make the flyout a solid `background`/`card` panel anchored above the `+` (not translucent), with a clear origin/anchor; keep the Match/Session options.

## 8. Create match screen (reuse session look)

**Files:** rewrite `components/create-match-modal.tsx`.

- Use session-style section `Card`s (sharp borders), score steppers + roster cards + stacked full-width buttons + checkboxes, keeping match-relevant buttons (Select Players, Create Match, Keep open/Keep players). Reuse score-stepper/roster patterns from `session/next-match-tab.tsx`.

---

## Verify (each item)

`bun oxc` (lint+format) + `bun typecheck`; simulator screenshot via dev build for UI items.

## Commits

One commit per numbered block, message `feat(mobile): <item>`.
