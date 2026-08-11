# 1-v-N ELO Darts Season Type — Design

Date: 2026-08-10
Status: Approved (brainstorming)

## Problem

The office darts group plays both classic x01 (301/501) and AutoDarts games (Cricket, Shanghai, Gotcha). Most games are multi-player with a single winner. Scorebrawl's season/match model is strictly two-sided (home vs away, W/D/L per player), which cannot represent "player X won a 5-person game of 501".

This design adds a new season type, `1-v-n-elo`, supporting 1v1 and 1-v-N darts games with winner-only results, manual entry, and multiplayer ELO scoring.

## Decisions

- **Scoring model**: Multiplayer ELO (named `1-v-n-elo`). Reuses existing ELO infra (initialScore, kFactor).
- **Finish granularity**: Winner-only for now. Full finishing order is explicitly deferred as a *separate future scoring type* (e.g. `finish-order-elo`), not a retrofit.
- **Result entry**: Manual entry in the web app. No AutoDarts API sync (noted as possible future work; data model shaped so it can slot in later).
- **Game type**: Strict enum on each match: `x01`, `cricket`, `shanghai`, `gotcha`.
- **Player count**: 2–6 per game. 2 players → plain 1v1 ELO; 3+ → scaled pairwise.
- **Season structure**: Open season, no fixtures. Games recorded as they happen; ranking = rating at season end.
- **Match storage**: Reuse `match` + `matchPlayer` tables; add nullable `gameType` column. No new tables.
- **ELO math**: Scaled pairwise k. Winner's rating moves as if beating each opponent pairwise, with k scaled by `1/(n-1)` so a 6-player win isn't worth 5× a 1v1 win.

## Approach selected

**Approach A — N-player match with winner flag.** Add `"1-v-n-elo"` to `scoreType`. A match row has N `matchPlayer` rows: winner marked `result: "W"`, everyone else `"L"`. Home/away split is structural only (winner = home, losers = away); the equal-team-size rule is relaxed for this type. Winner's ELO updates via scaled pairwise k vs each loser; each loser does one pairwise loss vs winner. Standings, W/L counts, recent form, ranking all work unchanged.

Rejected alternatives:
- **Approach B — Ranked finishes + dedicated result schema**: more future-proof for full order, but needs new result representation + new standing logic. Overkill for winner-only.
- **Approach C — Separate darts match table**: cleanest isolation but duplicates scoring/standings/achievements/SSE infra — highest effort, drift risk.

## Data model

- `apps/worker/src/db/schema/league-schema.ts:41` — add `"1-v-n-elo"` to `scoreType` enum.
- `match` table — add nullable `gameType` column (text enum: `x01`, `cricket`, `shanghai`, `gotcha`). Nullable so existing seasons/types are unaffected.
- `matchPlayer` rows — one `match` row + N `matchPlayer` rows. Winner `result: "W"`, others `"L"`. Identical shape to today's rows.
- `homeScore`/`awayScore` set to `1` / `n-1` (player counts) to satisfy existing non-null constraints and display code.
- Relax equal-team-size validation (`match-router.ts:229`) for this type: require ≥1 winner, ≥1 loser (2–6 players total).
- Player profiles keep working like `elo` (do not inherit the `3-1-0` block at `player-router.ts:38`).

## Scoring math

New branch in `packages/util/src/elo-util/index.ts` + `apps/worker/src/repositories/match-repository.ts` `calculateMatchResult`:

- **n = 2**: identical to current 1v1 ELO (winner vs loser, normal k-factor).
- **n ≥ 3**: winner's delta = sum over each loser of scaled pairwise, k scaled to `k/(n-1)`:
  - `Δwinner = (k/(n-1)) × (1 − E_w)` per pairing
  - `Δloser = (k/(n-1)) × (0 − E_l)` per pairing
  - Total rating change across all players ≈ 0.
- Expected score `E` reuses `@ihs7/ts-elo` `calculateExpectedScore` (same as 1v1).
- `determineMatchResult` stays W/D/L per player (winner W, rest L). No draws in this type.

Season defaults: `initialScore: 1200`, `kFactor: 32` (same as `elo`). `rounds` ignored — no fixtures.

## Worker routing

- `apps/worker/src/repositories/season-repository.ts:219-256` — add `"1-v-n-elo"` branch → `initialScore: 1200`, `kFactor: 32`, skip fixture generation.
- `apps/worker/src/trpc/router/season-router.ts:98` — widen zod enum; validate `rounds` null/omitted for this type.
- `apps/worker/src/trpc/router/match-router.ts` — for `1-v-n-elo` seasons accept payload: `gameType`, `winnerId`, `loserIds` (no home/away team arrays). Validate 2–6 players, winner ∈ group, all in season.
- `apps/worker/src/repositories/match-repository.ts` — parallel `create` path writing one match + N matchPlayer rows with single CASE-based score update (no N+1).
- `apps/worker/src/trpc/router/player-router.ts:38` — `3-1-0` block unchanged; `1-v-n-elo` gets profiles like `elo`.

## Frontend UI

- **Create season form** (`apps/web/src/routes/_authenticated/_sidebar/leagues/$slug/seasons/-components/seasons/create-season-form.tsx`): add `1-v-n-elo` card (Target01Icon). Selecting it hides `rounds`, shows ELO config (initialScore/kFactor). Icon/color switch in `seasons/index.tsx` gains the type.
- **Season dashboard** (`$seasonSlug/index.tsx`): extend `isEloSeason`-style helper so `1-v-n-elo` shows standings/ELO view, not fixture view. `dashboard-cards.tsx:455` `isFixtureSeason` stays false for it.
- **Record darts game drawer** (new, from season page):
  - Pick `gameType` via segmented control (`x01`, `cricket`, `shanghai`, `gotcha`)
  - Pick 2–6 players from season roster (multi-select chips)
  - Pick winner (radio on selected players; disabled until ≥2 selected)
  - Submit → `matchRouter.create` with `winnerId`/`loserIds`/`gameType`

## Edge cases

- 2 players → plain 1v1 ELO (no k-scaling); 3–6 → scaled pairwise.
- Duplicate/unknown `gameType` rejected by zod enum.
- Winner not in player list / player not in season → validation error.
- Season with `rounds` set → rejected at creation for this type.
- Existing seasons unaffected (`gameType` nullable; branch only fires on new seasons).

## Testing

Three layers:

1. **Unit** — new `calculate1vN` branch in `packages/util`: 1v1 equals current behavior; 3+ player deltas sum ≈ 0; winner gain scales by `1/(n-1)`; ties impossible.
2. **tRPC integration** (`apps/worker/src/test/trpc/`): season create `1-v-n-elo` with `rounds` rejection; match create 1v1 + 1-v-n; standings ordering; validation rejections. Reference pattern: `createTRPCTestClient({ sessionToken })` with helpers from `apps/worker/src/test/setup/`.
3. **Playwright e2e** (`apps/e2e/`): new `darts-match-crud.spec.ts` following the `seeded-match-crud` pattern (testid-based). Open season, record a darts game (pick gameType, select 4 players, pick winner), assert standings ELO move, remove, assert rollback. Run with `bun run test:e2e`.

## Future work (explicitly out of scope)

- Full finishing order (1st/2nd/3rd...) as a separate scoring type (`finish-order-elo`).
- AutoDarts API sync / import.
