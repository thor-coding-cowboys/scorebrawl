# Mobile Session Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Port the web session feature (configuration + live session view) to the Expo mobile app, with a 4-tab live view (Next Match, Players/Queue, Player Standings, Team Standings) and `+` = Add Player.

**Architecture:** Reuse the existing worker tRPC API unchanged. Add one full-screen config modal (`StartSessionModal`) triggered by the bottom-bar `+` → Session, a new session route, and a session view whose 4 sub-tabs are driven by the bottom `AppTabs` `view` param (like the season view). Session state is fetched via `session.getById` and mutated via existing `session.*` procedures; UI mirrors the web components cited below.

**Tech Stack:** Expo Router, React Native, TanStack Query, existing `trpcClient`/`useTRPC`, `@/components/ui` primitives, `expo-symbols`.

**Web sources of truth (do not deviate without reason):**

- Config: `apps/web/.../seasons/-components/session/start-session-dialog.tsx`
- Live: `apps/web/.../session/$sessionId/-components/winner-stays/winner-stays-session.tsx`, `queue-panel.tsx`, `coin-toss-dialog.tsx`, `score-stepper.tsx`, `session-dashboard-cards.tsx`, `session-utils.ts`, `session-types.ts`
- Manual: `.../-components/manual/manual-session.tsx`, `team-picker.tsx`
- Add player: `.../-components/add-player-dialog.tsx`
- Shell: `.../session/$sessionId/index.tsx`
- Standings gray-out: `.../session-standings.tsx`
- Router: `apps/worker/src/trpc/router/session-router.ts`

---

## API contracts (existing, unchanged)

- `session.getById({ sessionId })` → full session: `players[]` (`{id, seasonPlayerId, displayName, playerImage, score, status, queuePosition, gamesPlayedThisSession, consecutiveGames, userId}`), `matches[]` (`{id, matchNumber, homePlayerIds[], awayPlayerIds[], result, homeSessionScore, awaySessionScore, selectedHomePlayerIds[], selectedAwayPlayerIds[]}`), `proposedLineup`, `pendingCoinTosses[]`, `rotationMode`, `teamSize`, `status`, `modeSettings` (raw string).
- `session.create({ seasonSlug, rotationMode, teamSize, maxConsecutiveEnabled, maxConsecutiveGames, winnersTakePriority, seasonPlayerIds[], alwaysSplitConstraints[], autoRandomize, randomizerType?, autoCoinToss })` → `{ id }`.
- `session.addPlayer({ sessionId, seasonPlayerId })`.
- `session.removePlayer({ sessionId, sessionPlayerId })`.
- `session.startNextMatch({ sessionId, homeSeasonPlayerIds[], awaySeasonPlayerIds[] })`.
- `session.recordResult({ sessionId, sessionMatchId, homeScore, awayScore })`.
- `session.cancelMatch({ sessionId })`.
- `session.deleteLastMatch({ sessionId })`.
- `session.resolveCoinToss({ coinTossId, resolvedWinnerIds[] })`.
- `session.updateProposedLineup({ sessionId, proposedLineup })`.
- `session.updateTeamSelection({ sessionId, sessionMatchId, selectedHomePlayerIds[], selectedAwayPlayerIds[] })`.
- `session.updateMatchScore({ sessionId, sessionMatchId, homeScore, awayScore })`.
- `session.end({ sessionId })`.
- `seasonPlayer.getStanding({ seasonSlug })`, `seasonTeam.getStanding({ seasonSlug })`.

ID spaces: `sessionMatch.homePlayerIds/awayPlayerIds` and `startNextMatch` payload use **seasonPlayer ids**; `proposedLineup.*` and `sessionMatch.selected*` use **sessionPlayer ids**. `getById` player rows expose both (`id` = sessionPlayer id, `seasonPlayerId`).

Invalidation after session-mutating calls: `session.getById` query key; for `recordResult`/`deleteLastMatch` also `seasonPlayer.getStanding`, `seasonTeam.getStanding`, `match.getAll`.

---

## File map

New:

- `apps/mobile/src/components/session/types.ts`
- `apps/mobile/src/components/session/utils.ts`
- `apps/mobile/src/components/start-session-modal.tsx`
- `apps/mobile/src/components/session/session-view.tsx`
- `apps/mobile/src/components/session/next-match-tab.tsx`
- `apps/mobile/src/components/session/coin-toss-modal.tsx`
- `apps/mobile/src/components/session/queue-tab.tsx`
- `apps/mobile/src/components/session/standings-tab.tsx`
- `apps/mobile/src/components/session/add-player-modal.tsx`
- `apps/mobile/src/app/(drawer)/(tabs)/seasons/[seasonSlug]/session/[sessionId].tsx`

Modified:

- Move `apps/mobile/src/app/(drawer)/(tabs)/seasons/[seasonSlug].tsx` → `.../seasons/[seasonSlug]/index.tsx` (expo-router cannot have both `[seasonSlug].tsx` and `[seasonSlug]/`).
- `apps/mobile/src/components/app-tabs.tsx`: session-view mode (4 sub-tabs), `+` → add player; wire `Session` flyout action → `StartSessionModal`.
- `apps/mobile/src/components/create-match-flow.tsx` / `app-tabs.tsx`: mount `StartSessionModal`; on success `router.replace` to the session route.

---

## Tasks

### Task 1: Route restructure + types/utils

- [ ] Move `[seasonSlug].tsx` to `[seasonSlug]/index.tsx`; verify imports unchanged (`expo-router` relative imports stay valid).
- [ ] Add `session/types.ts` porting `session-types.ts` (SessionPlayer, SessionMatch, CoinToss, ProposedLineup, GameSession, PlayerWithTeam).
- [ ] Add `session/utils.ts` porting `computeWinStreaks`, `fisherYatesShuffle`, `enforceAlwaysSplit`, `getPlayerById`, `getPlayerBySeasonId`, `formatDuration`, `rotationLabel`.
- [ ] Add route `[seasonSlug]/session/[sessionId].tsx` reading `{ seasonSlug, sessionId, view }`, fetching `session.getById`, rendering `SessionView`.
- [ ] `bun typecheck`.

### Task 2: Start Session config modal

- [ ] Port `start-session-dialog.tsx` to `start-session-modal.tsx` as a full-screen Modal (pattern from `create-match-modal.tsx`): header, Settings section, Players section (search + sorted by matchCount desc + toggle), Always Split (winner-stays, ≥2 selected), footer Cancel + Start Session.
- [ ] Fields/defaults/payload exactly per research (reducer state; `maxConsecutiveGames = enabled ? value : null`; `autoRandomize = randomizerType !== "off"`; omit `randomizerType` when off).
- [ ] Missing mobile primitives: implement inline segmented option pickers (Rotation Mode, Auto Randomize) and a toggle switch row (no Switch primitive). Team size + max-consecutive numeric steppers.
- [ ] Wire flyout `Session` action in `app-tabs.tsx` → open modal (gated: no active session, season not locked).
- [ ] On success: invalidate `session.getActive` + `session.listEnded`; `router.replace(`/seasons/${seasonSlug}/session/${id}?view=next`)`.
- [ ] `bun typecheck`.

### Task 3: Session view shell + bottom tabs

- [ ] `app-tabs.tsx`: detect `isSessionView` (pathname contains `/session/`); render 4 sub-tabs: Next / Players / Standings / Teams (2 left, 2 right); `goToView` sets `view` param; `+` opens `AddPlayerModal`; hide season flyout.
- [ ] `session-view.tsx`: fetch session; if missing show not-found; render header (season/session label + End Session button confirming via `Alert`), then the tab for `view`.
- [ ] `bun typecheck`.

### Task 4: Add Player modal

- [ ] Port `add-player-dialog.tsx`: query `seasonPlayer.getStanding`, exclude `session.players[].seasonPlayerId`, list rows; call `session.addPlayer`; invalidate `session.getById`.
- [ ] Mount in `app-tabs.tsx` for session view (needs sessionId/seasonSlug params; fetch session for exclusion set, dedup).

### Task 5: Next Match tab (winner-stays + manual)

- [ ] Port winner-stays live logic: hydrate `teamAssignment` (active match `selected*` → session ids; else proposedLineup session ids), score state seeded from match scores, `teamsBalanced`, start/record/cancel/undo handlers, coin toss trigger.
- [ ] Port manual `TeamPicker` behavior (home fills first, tap assigned removes, out players excluded).
- [ ] Team editor: reuse a nested modal (like `PlayerSelectionModal`) with Shuffle / Shuffle Selected / Even / Rotation actions mutating local state only; persist on close via `updateProposedLineup` (no active match) or `updateTeamSelection` (active match).
- [ ] Score steppers + Record Result + Cancel Match + Undo Last Match (Alert confirm).
- [ ] Coin toss modal port (pick → flip → result) calling `resolveCoinToss({ coinTossId, resolvedWinnerIds:[id] })`.
- [ ] `bun typecheck`.

### Task 6: Queue tab

- [ ] Port `queue-panel.tsx`: Playing / Queue (ranked) / Out sections; streak dots; `{games}g`, score; remove (only when active players > teamSize\*2), rejoin (on out). No dashboard cards (kept out of scope for the 4-tab layout).

### Task 7: Standings tab

- [ ] Player standings: `seasonPlayer.getStanding`, dim rows whose `id` not in `session.players[].seasonPlayerId` (opacity 0.4).
- [ ] Team standings: `seasonTeam.getStanding`, dim team unless every player id in the highlighted league-player set (derived by mapping session seasonPlayerIds → playerId from player standings).
- [ ] Segmented Player/Teams toggle inside the tab (or two separate bottom tabs per spec — spec says separate tabs: Standings tab = player standings, Teams tab = team standings). Implement as two tabs, each dimmed accordingly.

### Task 8: End session + verification

- [ ] End Session: `Alert` confirm → `session.end.mutate` → invalidate `session.getActive`/`listEnded` → `router.replace` back to season (`view=session`).
- [ ] `bun oxc`, `bun typecheck`, `bun format`; simulator verification of: config modal, create → session route, 4 tabs, `+` add player, winner-stays start/score/record, queue, dimmed standings.

---

## Open decisions / out of scope

- Session **summary** screen (web `summary.tsx`) is out of scope for this pass; End Session returns to the season, and the ended session appears in Session History.
- Web dashboard cards strip is omitted to match the user's explicit 4-tab spec.
- Web `useScoreSync` live score persistence is unwired in web; keep scores local + record on submit (parity).
