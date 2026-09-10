# BullsAI ↔ ScoreBrawl Integration (result push)

## Status

Not started.

## Summary

Push match results from BullsAI (automatic computer-vision dart scoring) into ScoreBrawl (league/ELO/season platform) so league results stop being entered by hand. Start with **1-v-n games** — the `1-v-n-elo` season type ScoreBrawl already ships — because that is how the game is actually played on BullsAI boards. Later phases add league context back into BullsAI and full bidirectional sync.

## Why / Goal

People who play in dart leagues and use BullsAI currently do double entry: BullsAI scores the game automatically, then someone retypes the result into ScoreBrawl. That friction kills adoption on both sides. Pushing results automatically removes the biggest blocker for league organizers who want automatic tracking plus ELO rankings and season management. It also unlocks paid upsells (bridge premium tier, white-label, tournament hosting).

## Background — both platforms

Near-identical stack on both sides: **Cloudflare Workers + Hono + D1 + better-auth + React/TanStack**. The issue (#329) is filed on BullsAI; this doc captures the ScoreBrawl-side work.

- **BullsAI** (`github.com/ihs7/bullsai`): Hono API (no tRPC), games stored in `games` + `game_session`/`game_session_player` (seat, `won`, `finalScore`, `dartsThrown`). Game completion is a single choke point in `GameRoom.persistCommand`. No outbound webhooks, no public results API yet (planned in BullsAI issue #328), no account linking, no external-ID field on users. Auth: better-auth with GitHub/Google social, optional email+password, plugins `admin`, `organization`(+teams), `bearer`, `deviceAuthorization`, `passkey`.
- **ScoreBrawl**: Hono + tRPC, **no public write API** — every route is session-gated (MCP server included; `/api/version` and `/api/auth` are the only public paths). Match creation for 1-v-n lives in tRPC `match.createOneVn({ seasonSlug, winnerId, loserIds })` (1 winner → home, N losers → away; only valid in `1-v-n-elo` seasons). Players may be registered users or guests (guest has `displayName` + `email`). Auth: better-auth with email+password, GitHub/Google social, **account linking enabled** (`trustedProviders: ["google", "email-password", "github"]`), plugins `expo`, `admin`, `organization`(league), `passkey`, **`bearer`**, **`deviceAuthorization`** (RFC 8628, verification page already live at `/device`). API-key management was removed in #637.

## Scope (Phase 1 — ScoreBrawl side)

### 1. Receiving endpoint

Add a Hono route (outside tRPC, zod-validated per AGENTS.md) e.g. `POST /api/integrations/bullsai/matches`:

- Auth: BullsAI calls it with a ScoreBrawl **bearer token** obtained during account linking (better-auth `bearer()` plugin + `getSession` honors `Authorization: Bearer`).
- Payload: `gameId` (used as ScoreBrawl `match.id` for idempotency), game type, `winner`, `losers`, final scores, timestamp, per-player identities, optional stats (average, 180s, checkout, darts thrown).
- Internally map to the existing `match.createOneVn` flow (winner → home of 1, losers → away of N), which already handles ELO, standings, achievements, and SSE broadcast. Reuse `finalizeMatchCreation`.

### 2. Account linking

Two viable mechanisms; device flow is the recommended primary:

- **Device authorization (RFC 8628) — recommended.** Both platforms already run better-auth's `deviceAuthorization` plugin and ScoreBrawl's `/device` approval page is live. In BullsAI: "Connect ScoreBrawl" → call ScoreBrawl's device endpoint → user enters the code on scorebrawl.com → approve → BullsAI receives a ScoreBrawl bearer token scoped to the ScoreBrawl user. BullsAI stores the link (`bullsai_user_id` ↔ `scorebrawl_user_id` + token). This is a real "sign in with ScoreBrawl" with explicit consent (matches the privacy default of opt-in).
- **Email-based auto-linking — simpler fallback.** Both sides know each user's email. BullsAI sends participant emails; ScoreBrawl resolves each email → player/guest within the target league. Zero new linking UI, but weaker consent and ambiguous when a league has multiple players sharing an email.

Link storage: a ScoreBrawl `integration_link` table (league-scoped) or BullsAI-side — decide in Phase 1. Default to **opt-in** consent for sharing match data.

### 3. Player identity resolution

BullsAI game participants (users or seats) must resolve to ScoreBrawl **seasonPlayers** in the target season:

- Linked user → their `player` row in the league → that league's `seasonPlayer` in the target season.
- Email → `player` (via `user.email`) or `guest` (via `guest.email`) in the target league.
- Unresolved participants → fail the push with a clear error listing who couldn't be matched (no silent partial writes).

### 4. Season/league targeting

A pushed result must know which ScoreBrawl league + season to land in:

- BullsAI pushes `leagueSlug` + `seasonSlug` explicitly (config per board/lobby: "this board feeds league X season Y"), or
- Default to the target league's active season (`season.findActive`), or
- A per-venue mapping on the BullsAI side.

Recommend explicit slugs from BullsAI config for Phase 1.

## Out of scope (Phases 2–3, later)

- Pull league context into BullsAI (standings, fixtures, head-to-head, achievement milestones in the game UI).
- Bidirectional sync (ScoreBrawl schedule → BullsAI sessions; aggregated stats).
- Game types beyond 1-v-n (x01, cricket, around-the-world mapping to other score types).

## Code map

**ScoreBrawl:**

- `apps/worker/src/trpc/router/match-router.ts` — `createOneVn` (+ `create`), `finalizeMatchCreation`
- `apps/worker/src/lib/better-auth.ts` — `bearer()`, `deviceAuthorization()` (verificationUri `/device`), `accountLinking`
- `apps/worker/src/routes/` — new `integrations-router.ts`; mount in `apps/worker/src/index.ts`
- `apps/worker/src/db/schema/league-schema.ts` — `player`, `guest`, `seasonPlayer`, `achievementType`; new `integration_link` table (Drizzle, migrate via `bun db:generate` / `db:migrate`)
- Guest-claim precedent for email resolution: `apps/worker/src/lib/better-auth.ts` user-create hook

**BullsAI:**

- `apps/api/src/game-room.ts:489-544` — game-completion choke point (hook the push here)
- `apps/api/src/db/schema/game-sessions.ts` — `game_session_player` (result shape)
- `apps/api/src/features/auth/auth.ts` — better-auth config (add device linking client)
- BullsAI issue #328 — public API/webhook RFC this builds on

## Acceptance criteria (Phase 1)

- A user can link their BullsAI account to ScoreBrawl (device flow) or have their matches auto-resolved by email, with explicit opt-in.
- Completing a 1-v-n game on BullsAI creates a match in the configured ScoreBrawl season automatically — correct winner/losers, ELO + standings update, no manual entry.
- Idempotent: replaying a game push cannot duplicate the match (BullsAI `gameId` = ScoreBrawl `match.id`).
- Unresolved participants fail the push with a clear error; nothing is silently dropped.
- Integration tests (Vitest, `apps/worker/test/trpc/` pattern): linking, push→match mapping, idempotency, unauthenticated/bad-token rejection, unresolved-player rejection.

## Open questions

- Where does the link live — ScoreBrawl `integration_link` table vs BullsAI-side storage? (Drives who can revoke.)
- Payload format — JSON webhook; should it mirror the MCP tool schemas or BullsAI #328 RFC?
- Season targeting: explicit `leagueSlug`+`seasonSlug` from BullsAI vs active-season default vs per-board mapping.
- Game-type mapping beyond 1-v-n: x01/cricket → which ScoreBrawl score types?
- Authentication: rely on device-flow bearer tokens, or re-introduce API keys (removed in #637)?
- Who builds first: BullsAI outbound webhook (#328) or ScoreBrawl receiving endpoint — coordinate.
