# Expiring Share Links for Public Standings

## Summary

Share one season's standings with people outside the league via an explicit,
revocable capability link that expires on its own. Not a public league page:
nothing is public until an owner enables sharing and an editor creates a link.

## Status

Planned. Design written 2026-10-30: [`docs/specs/2026-10-30-expiring-share-links-design.md`](../../specs/2026-10-30-expiring-share-links-design.md).
Supersedes the earlier "public shareable leaderboard" idea (permanent public page
with an `isPublic` flag), which was never started.

## Why / Goal

Office and friend leagues are social: results get pasted into Slack and WhatsApp.
Today that means screenshots, because everything requires an account and
membership. A link that anyone can open — and that the league can take back —
turns bragging into a funnel without exposing a league forever.

## Scope

- `share_link` table: hashed 128-bit token, league + season scoped, `expires_at`
  (nullable = never), `revoked_at`, `created_by`, `view_count`, `last_viewed_at`
- `league_setting.allow_public_shares` — league-level, owner-only, default `false`;
  toggled in the season share dialog, and turning it off revokes every active link
- Explicit creation from the season page: `1h` / `24h` / `7d` / `30d` / `never`
  (default `7d`); duration is immutable, change = revoke + new link
- Link shown once at creation (only the hash is stored); per-season management
  list with creator, expiry, view count and revoke
- Public route
  `/shared/leagues/:leagueId/seasons/:seasonId/standings/:key` with no app chrome
- Unauthenticated resolve endpoint `GET /api/share/links/:key`: `404` unknown,
  `410` expired/revoked, `403` sharing disabled, `429` per-IP rate limited
- Shared page: hero card, ambient glow centred on desktop, standing rows matching
  the season page, pager at 10 rows, recent results, sign-up CTA
- Obvious expired/revoked/disabled states — no standings rendered in error states
- Only display data exposed: names, ELO/score, W/D/L, form, recent results

## Code map

- Schema: `apps/worker/src/db/schema/league-schema.ts` (`share_link`,
  `league_setting`); do not touch the generated better-auth `league` table
- Resolve endpoint: new `apps/worker/src/routes/share-router.ts`, mounted before
  the catch-all `enforceAuthMiddleware` in `apps/worker/src/index.ts`; app-host
  only via `enforceHostScope`
- Management tRPC: new `shareLinkRouter` using existing `seasonProcedure` +
  `editorRoles`, `leagueEditorProcedure` / `leagueOwnerProcedure` in
  `apps/worker/src/trpc/trpc.ts`
- Data: reuse `seasonPlayerRepository.getStanding` (single query) and
  `matchRepository.getBySeasonId`; sort/rank with `core/presentation`
- Web: `apps/web/src/routes/_public/shared/...`; extract standings rows from
  `seasons/-components/season/standing.tsx` into
  `routes/-components/standings/` so season and share pages share visuals and the
  `TeamStandingCard` pager pattern
- Glow: `card-glow-*` utilities and a new `page-glow` utility in
  `apps/web/src/index.css`, tokens from `packages/core/theme`

## Acceptance criteria

- Owner enables sharing; editor creates a `7d` link from the season page and gets
  a copyable URL exactly once
- A signed-out visitor opens the link on a phone and on desktop, sees the season
  standings with working pagination, and no app chrome
- Link stops resolving after its duration: `410` with an obvious "expired on …"
  page; revoke behaves the same with "revoked"
- Turning the league setting off immediately disables every existing link; failed
  creates return a clear "sharing disabled" error
- Tokens are stored hashed, never logged, and mismatch between URL ids and token
  is `404`
- Members cannot create or revoke links; non-owners cannot toggle the setting
- Worker integration tests cover create/resolve/expiry/revoke/disabled/rate-limit
  and payload privacy; e2e covers the shared page at 390px and 1440px

## Open questions / notes

- Housekeeping of expired links: keep rows for audit (current default); revisit a
  retention window once volume matters
- Team standings and last-match narratives are deliberately out of scope for v1
- Dynamic OG previews for shared links are out of scope; the page sets title and
  `noindex`, the static shell stays the marketing one
