# BullsAI ↔ ScoreBrawl Integration (result push)

## Status

Phase 1 (ScoreBrawl side) implemented on `feat/bullsai-oauth-integration`. Remaining: BullsAI-side work (#328) and Phase 2–3.

## Summary

Push match results from BullsAI (automatic computer-vision dart scoring) into ScoreBrawl (league/ELO/season platform) so league results stop being entered by hand. Start with **1-v-n games** — the `1-v-n-elo` season type ScoreBrawl already ships — because that is how the game is actually played on BullsAI boards. Later phases add league context back into BullsAI and full bidirectional sync.

## Why / Goal

People who play in dart leagues and use BullsAI currently do double entry: BullsAI scores the game automatically, then someone retypes the result into ScoreBrawl. That friction kills adoption on both sides. Pushing results automatically removes the biggest blocker for league organizers who want automatic tracking plus ELO rankings and season management. It also unlocks paid upsells (bridge premium tier, white-label, tournament hosting).

## Approach

**ScoreBrawl becomes an OAuth2/OIDC resource server.** BullsAI users link their ScoreBrawl account from their BullsAI profile ("Link Scorebrawl") via a standard authorization-code + PKCE flow. BullsAI then holds access/refresh tokens and calls a new public ScoreBrawl API on the user's behalf. In the BullsAI lobby, a linked account enables "automatically register games in \<season selection\> Scorebrawl league".

This is an OAuth **server** on ScoreBrawl, not device flow: the lobby owner is already authenticated in BullsAI, so linking happens from their BullsAI profile, and the resulting tokens are long-lived (refreshable) API credentials rather than a one-shot device grant.

## Background — both platforms

Near-identical stack on both sides: **Cloudflare Workers + Hono + D1 + better-auth + React/TanStack**. The issue (#329) is filed on BullsAI; this doc captures the ScoreBrawl-side work.

- **BullsAI** (`github.com/ihs7/bullsai`): Hono API (no tRPC), games stored in `games` + `game_session`/`game_session_player` (seat, `won`, `finalScore`, `dartsThrown`). Game completion is a single choke point in `GameRoom.persistCommand`. No outbound webhooks, no public results API yet (planned in BullsAI issue #328), no account linking, no external-ID field on users. Auth: better-auth with GitHub/Google social, optional email+password, plugins `admin`, `organization`(+teams), `bearer`, `deviceAuthorization`, `passkey`.
- **ScoreBrawl**: Hono + tRPC, **no public API** — every route is session-gated (MCP server included; `/api/version` and `/api/auth` are the only public paths). Match creation for 1-v-n lives in tRPC `match.createOneVn({ seasonSlug, winnerId, loserIds })` (1 winner → home, N losers → away; only valid in `1-v-n-elo` seasons). Players may be registered users or guests (guest has `displayName` + `email`). Auth: better-auth **1.7.2** with email+password, GitHub/Google social, account linking enabled, plugins `expo`, `admin`, `organization`(league), `passkey`, `bearer`, `deviceAuthorization`. API-key management was removed in #637.

## Scope (Phase 1 — ScoreBrawl side)

### 1. ScoreBrawl as OAuth provider

- Add the **OAuth Provider plugin** — `@better-auth/oauth-provider` (`oauthProvider()`), the better-auth 1.7 successor to the removed `oidcProvider`. It provides authorization-code flow, PKCE, public + confidential clients, refresh tokens, an OAuth consent screen, UserInfo, and JWKS for token verification.
- Scopes: `create:matches` and `read:matches` (Phase 1); future Phase 2 reads add e.g. `leagues:read`, `standings:read`.
- Client registration: support **dynamic client registration (DCR)** (`allowDynamicClientRegistration`, `allowUnauthenticatedClientRegistration`) in addition to a trusted BullsAI client.
- Configure the login page (ScoreBrawl's `/auth/sign-in`) and consent UI.
- Access tokens are JWTs signed by ScoreBrawl; `sub` = ScoreBrawl user id, `scope` = granted scopes.

### 2. Public matches API

Native **Hono** endpoints (zod-validated with `@hono/zod-validator` per AGENTS.md, not tRPC). League and season are in the URL path, so the target is explicit:

```
POST /api/v1/leagues/:leagueId/seasons/:seasonId/matches   (scope: create:matches)
GET  /api/v1/leagues/:leagueId/seasons/:seasonId/matches   (scope: read:matches)
```

- Auth: `Authorization: Bearer <OAuth access token>` — ScoreBrawl validates the JWT (its own JWKS), checks the required scope, and resolves `sub` → user → league membership. No session cookie needed.
- POST body: `gameId` (used as ScoreBrawl `match.id` for idempotency), game type, `winner`, `losers`, final scores, timestamp, per-player identities, optional stats (average, 180s, checkout, darts thrown).
- Internally map to the existing `match.createOneVn` flow (winner → home of 1, losers → away of N), which already handles ELO, standings, achievements, and SSE broadcast. Reuse `finalizeMatchCreation`.
- GET returns matches for the season (read side feeds BullsAI lobby/Phase 2 context).

### 3. Player identity resolution

BullsAI game participants (users or seats) must resolve to ScoreBrawl **seasonPlayers** in the target season:

- Linked user → their `player` row in the league → that league's `seasonPlayer` in the target season.
- Email → `player` (via `user.email`) or `guest` (via `guest.email`) in the target league.
- Unresolved participants → fail the push with a clear error listing who couldn't be matched (no silent partial writes).

### 4. Season/league targeting

League and season are in the URL path (`/api/leagues/:leagueId/seasons/:seasonId/matches/v1`), so the result lands in an explicit target. The BullsAI link/lobby flow selects a league + season and stores their **ids** (`leagueId`, `seasonId`) per board/lobby config. No slug guessing or active-season fallback on the receiving side.

## BullsAI side (coordinated with #328)

- **Profile:** "Link Scorebrawl" → authorization-code + PKCE redirect to ScoreBrawl → sign-in/consent → callback → BullsAI exchanges code for access + refresh token (scopes `create:matches`, `read:matches`). Store link (`bullsai_user_id` ↔ ScoreBrawl token pair) + a link-idempotency key per game.
- **Lobby:** if the lobby owner (or board) has a linked ScoreBrawl account, show a league/season selector (resolves to `leagueId` + `seasonId`) + "automatically register games" toggle. On game completion (`GameRoom.persistCommand`), push the result to `POST /api/v1/leagues/:leagueId/seasons/:seasonId/matches` with the stored access token; refresh the token on 401 and retry.
- Storage: an `integration_link` table on the BullsAI side (owns the tokens, can revoke). Optionally mirror the link id in ScoreBrawl for display.

## Out of scope (Phases 2–3, later)

- Pull league context into BullsAI (standings, fixtures, head-to-head, achievement milestones in the game UI).
- Bidirectional sync (ScoreBrawl schedule → BullsAI sessions; aggregated stats).
- Game types beyond 1-v-n (x01, cricket, around-the-world mapping to other score types).

## Code map

**ScoreBrawl:**

- `apps/worker/src/lib/better-auth.ts` — add `oauthProvider()` from `@better-auth/oauth-provider`; scopes `create:matches`/`read:matches`; DCR enabled; consent/login page wiring
- `apps/worker/src/trpc/router/match-router.ts` — `createOneVn` (+ `create`), `finalizeMatchCreation`
- `apps/worker/src/routes/` — new `matches-v1.ts` Hono router (bearer + scope auth); mounted at `/api/v1/leagues/:leagueId/seasons/:seasonId/matches` in `apps/worker/src/index.ts`
- `apps/worker/src/db/schema/league-schema.ts` — `player`, `guest`, `seasonPlayer`; OAuth client/token tables come from the plugin migration (`bun db:generate` / `db:migrate`)
- Guest-claim precedent for email resolution: `apps/worker/src/lib/better-auth.ts` user-create hook

**BullsAI:**

- `apps/api/src/game-room.ts:489-544` — game-completion choke point (hook the push here)
- `apps/api/src/db/schema/game-sessions.ts` — `game_session_player` (result shape)
- `apps/api/src/features/auth/auth.ts` — better-auth config (OAuth client side); new profile + lobby UI
- BullsAI issue #328 — public API/webhook RFC this builds on

## Acceptance criteria (Phase 1)

- A BullsAI user can link their ScoreBrawl account from their BullsAI profile via authorization-code + PKCE OAuth (scopes `create:matches`, `read:matches`), with an explicit consent screen; tokens refresh automatically.
- Completing a 1-v-n game on BullsAI creates a match in the configured ScoreBrawl season automatically — correct winner/losers, ELO + standings update, no manual entry.
- Idempotent: replaying a game push cannot duplicate the match (BullsAI `gameId` = ScoreBrawl `match.id`).
- Unresolved participants fail the push with a clear error; nothing is silently dropped.
- `POST` requires `create:matches`, `GET` requires `read:matches`; missing scope → `403 insufficient_scope`; missing/expired/invalid bearer token → `401` with `WWW-Authenticate`; JWKS verification works.
- Integration tests (Vitest, `apps/worker/test/trpc/` pattern): OAuth link/consent, push→match mapping, idempotency, bearer + scope validation, unresolved-player rejection.

## Open questions

- ~~Verify `@better-auth/oauth-provider` compatibility with the pinned better-auth catalog version (1.7.2)~~ — **done**: both bumped to 1.7.3. The 1.7.3 schema generator emits `relations()`-style relations incompatible with the pinned drizzle-orm RC; the generated relations wrapper was stripped (relations are defined via `defineRelations(schema)` in `db/index.ts`).
- ~~DCR: accept fully unauthenticated registration...~~ — **decided**: DCR disabled; OAuth clients are created admin-only via the `/admin/oauth-clients` UI (better-auth `adminCreateOAuthClient`).
- Which scopes beyond `create:matches`/`read:matches` for Phase 2 reads (e.g. `leagues:read`, `standings:read`)?
- ~~Where does the link live~~ — **decided**: BullsAI-side. The OAuth grant is the link; BullsAI stores `bullsaiUserId ↔ scorebrawlUserId` (from token `sub`) and sends `scorebrawlUserId`/`email` per participant. No link table on ScoreBrawl.
- ~~Payload format~~ — **decided**: `POST /api/v1/leagues/:leagueId/seasons/:seasonId/matches` with `{ gameId, gameType, playedAt?, winner, losers, ... }`. Unknown emails auto-create a claimable guest + player + seasonPlayer.
- Game-type mapping beyond 1-v-n: x01/cricket → which ScoreBrawl score types?
- ~~Who builds first~~ — **decided**: ScoreBrawl OAuth provider + receiving endpoint first (done); BullsAI side coordinated in #328.
