# Expiring share links for public standings

**Date:** 2026-10-30
**Status:** Ready for review (design)
**Feature:** backlog #10 — replaces the earlier "public league page" proposal

## Intent

League organizers want to show standings to people outside the league: a Slack
channel, a WhatsApp group, a screen at the office. A permanent public league page
exposes everything forever and cannot be withdrawn. Instead a share is an
explicit, named, revocable capability link that shows one season's standings and
expires on its own.

Success: an owner or editor can create a link in two clicks, paste it into chat,
and have a stranger see the standings on a phone without an account — and later
have that same link stop working, with the page clearly saying so.

## Goals

- Explicit creation from the season page; no league is ever public by default.
- Links scoped to exactly one season's standings.
- Expiry presets: `1h`, `24h`, `7d`, `30d`, `never`; default `7d`; immutable after
  creation (change = revoke + new link).
- Obvious expired / revoked / disabled states.
- League-level opt-in `allowPublicShares`, default off, owner-only; acts as a
  kill switch.
- Shared page is product-quality on phone and desktop: existing glow treatment,
  centred on desktop, the same paging as the season page for long standings.

## Non-goals (v1)

- Public league browsing, SEO, indexing, dynamic OG images.
- Sharing anything but a season's player standings (no matches page, teams,
  player profiles, session live view).
- Per-season setting (a link already names one season; expiry is per link).
- Signed/JWT links without a database row.

## Decisions already made

| Question                | Decision                                                                                      |
| ----------------------- | --------------------------------------------------------------------------------------------- |
| Expiry model            | Fixed presets `1h / 24h / 7d / 30d / never`; no custom picker, no cap                         |
| Mutation of expiry      | Not allowed; revoke and create a new link                                                     |
| Setting scope           | League only, owner only, default `false`                                                      |
| Turning the setting off | Revokes every active link for the league in the same write; re-enabling does not restore them |
| Token type              | Opaque 128-bit random, stored hashed, not a signed token                                      |
| Resolution transport    | Public REST `GET /api/share/links/:key`; management stays tRPC                                |
| Expiry enforcement      | Lazy check on read; no cron, no scheduled job                                                 |

## Flows

1. **Enable.** Owner opens league settings (edit-league dialog), turns on
   "Allow public share links". Off by default; confirmation states that turning
   it off later revokes every active link.
2. **Create.** Owner or editor opens a season, presses _Share standings_, picks a
   duration (`1h / 24h / 7d / 30d / never`, default `7d`). If sharing is still
   off, the dialog offers to enable it inline (owner only) instead of dead-ending.
3. **Share.** The link is shown once with copy-to-clipboard and a "anyone with
   this link can view" note.
4. **Manage.** The same dialog lists active, expired and revoked links for the
   season with creator, expiry, views and a revoke action.
5. **Expire.** Links stop resolving on their own; the page says when they expired.

## Data model

Two new tables in `apps/worker/src/db/schema/league-schema.ts`. The better-auth
`league` table (generated from the organization schema) is **not** touched.

### `share_link`

| column                     | type                                             | notes                        |
| -------------------------- | ------------------------------------------------ | ---------------------------- |
| `id`                       | text pk                                          |                              |
| `token_hash`               | text, unique, not null                           | SHA-256 hex of the raw token |
| `league_id`                | text, not null, FK `league.id` on delete cascade |                              |
| `season_id`                | text, not null, FK `season.id` on delete cascade |                              |
| `created_by`               | text, nullable, FK `user.id` on delete set null  | audit survives user deletion |
| `expires_at`               | integer timestamp, nullable                      | `null` = never               |
| `revoked_at`               | integer timestamp, nullable                      |                              |
| `revoked_by`               | text, nullable, FK `user.id`                     |                              |
| `view_count`               | integer, not null, default 0                     |                              |
| `last_viewed_at`           | integer timestamp, nullable                      |                              |
| `created_at`, `updated_at` | audit fields                                     | `timestampAuditFields`       |

Indexes: unique on `token_hash`; `(season_id, created_at)`; `(league_id)`.

### `league_setting`

| column                     | type                                      | notes              |
| -------------------------- | ----------------------------------------- | ------------------ |
| `league_id`                | text pk, FK `league.id` on delete cascade | one row per league |
| `allow_public_shares`      | integer boolean, not null, default false  |                    |
| `created_at`, `updated_at` | audit fields                              |                    |

A missing row means "all defaults", so no backfill is required. Reads use
`COALESCE(setting.allow_public_shares, 0)` via a left join — never a second
round trip.

Migration: `bun db:generate` then `bun db:migrate`; flatten as usual.

## Token design

- 16 random bytes from `crypto.getRandomValues`, base64url encoded (22 chars).
- Only the SHA-256 hex digest is stored. A database leak does not grant access.
- Lookup is `WHERE token_hash = ?` (indexed); no timing-safe compare needed.
- The raw token is returned exactly once, at creation. It is never logged and
  never included in error payloads or `viewCount` updates.
- Tokens appear in Worker request URLs, so they appear in Cloudflare request
  logs for the duration of the link. Accepted: links are opt-in, revocable and
  short-lived. This is documented in the feature doc.
- One token = one season. The ids in the path are validated against the token
  row; a mismatch is a `404`, so a token cannot be repurposed by editing the URL.

## Management API (tRPC)

New `shareLinkRouter`, registered on the app router. `leagueEditorProcedure` and
`leagueOwnerProcedure` already exist in `apps/worker/src/trpc/trpc.ts`.

| procedure             | guard                                                                   | input                                                                  | output                                                                          |
| --------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `shareLink.create`    | `seasonProcedure` + `editorRoles` (`owner`, `editor`) + setting enabled | `{ seasonSlug, expiresIn: "1h" \| "24h" \| "7d" \| "30d" \| "never" }` | `{ id, url, expiresAt }`                                                        |
| `shareLink.list`      | `seasonProcedure` + `editorRoles`                                       | `{ seasonSlug }`                                                       | `[{ id, createdAt, createdBy, expiresAt, revokedAt, viewCount, lastViewedAt }]` |
| `shareLink.revoke`    | `seasonProcedure` + `editorRoles`                                       | `{ seasonSlug, id }`                                                   | `{ success: true }`                                                             |
| `shareSetting.get`    | `leagueEditorProcedure`                                                 | —                                                                      | `{ allowPublicShares }`                                                         |
| `shareSetting.update` | `leagueOwnerProcedure`                                                  | `{ allowPublicShares }`                                                | `{ allowPublicShares, revokedCount }`                                           |

Notes:

- `create` returns `SHARING_DISABLED` when the league setting is off.
- `create` computes `expiresAt = now + preset`; `never` stores `null`.
- The URL is built from `env.PROD_URL` when set, otherwise the request origin, so
  preview links point at the preview host.
- The raw link is returned by `create` exactly once and cannot be recovered later
  (only the hash is stored). `list` therefore returns metadata only; recovering a
  link means revoking and creating a new one. The create dialog must say this.
- `shareSetting.update(false)` revokes all links (`revoked_at`, `revoked_by`) and
  flips the flag in one transaction; it returns how many links were revoked.
- `list`/`revoke` are scoped by `seasonId` resolved from `seasonSlug` _and_
  `organizationId`, so an id from another league cannot be touched.

## Public resolve endpoint

`GET /api/share/links/:key` — Hono router in `apps/worker/src/routes/share-router.ts`,
mounted in `apps/worker/src/index.ts` **before** the catch-all `enforceAuthMiddleware`.
It is an app-host path, so `enforceHostScope` keeps it off `api.scorebrawl.com`
automatically.

Pipeline (no N+1; three queries max):

1. Hash the key, load `share_link` joined to `league` and left-joined to
   `league_setting`. Validate the path `leagueId`/`seasonId` against the token
   row and return `404` on any mismatch, so a token cannot be repurposed by
   editing the URL.
2. If not found → `404`. If `revoked_at` → `410 revoked`. If `expires_at <= now`
   → `410 expired`. If `allow_public_shares` is false → `403 sharing_disabled`.
3. `seasonPlayerRepository.getStanding({ seasonId })` for rows (existing single
   raw SQL query), sorted with `sortStandings` and ranked server-side.
4. `matchRepository.getBySeasonId({ seasonId, limit: 5, offset: 0 })` for recent
   results, mapped to display labels only (team side = joined names, truncated to
   two names plus `+n`).

Response `200`:

```json
{
	"link": { "createdAt": "...", "expiresAt": "..." },
	"league": { "name": "Office League", "logo": "https://..." },
	"season": { "name": "Autumn 2026", "startDate": "...", "closed": false },
	"standings": [
		{
			"id": "sp_...",
			"rank": 1,
			"name": "...",
			"image": null,
			"score": 1042,
			"matchCount": 12,
			"winCount": 9,
			"lossCount": 2,
			"drawCount": 1,
			"winPct": 75,
			"form": ["W", "L", "W"],
			"pointDiff": 0
		}
	],
	"recentMatches": [
		{
			"id": "m_...",
			"playedAt": "...",
			"home": { "label": "Ada & Bo", "score": 10 },
			"away": { "label": "Cy", "score": 7 }
		}
	],
	"generatedAt": "..."
}
```

Stripped before serialisation: `userId`, `isGuest`, emails, guest ids, internal
`seasonPlayer` timestamps. Only display names are exposed.

Errors are shaped `{ error: { code, message }, expiresAt?, revokedAt? }` so the
page can render a date:

| status | code               | meaning                              |
| ------ | ------------------ | ------------------------------------ |
| 404    | `not_found`        | unknown or malformed key             |
| 410    | `expired`          | past `expires_at`                    |
| 410    | `revoked`          | the link was revoked                 |
| 403    | `sharing_disabled` | league kill switch is off            |
| 429    | `rate_limited`     | per-IP ceiling, `Retry-After` header |

Headers on every response: `Cache-Control: no-store`, `X-Robots-Tag: noindex`,
`Referrer-Policy: no-referrer`.

Rate limit: `env.PUBLIC_API_RATE_LIMITER` with key
`share:ip:<sha256(cf-connecting-ip || x-forwarded-for || "unknown")>`, ceiling
60/min. No IP is stored in plain text.

`view_count` / `last_viewed_at` update via `ctx.waitUntil` and a best-effort
write; a failed counter never fails the request.

## Shared page

Route: `apps/web/src/routes/_public/shared/leagues/$leagueId/seasons/$seasonId/standings/$key.tsx`
→ `/shared/leagues/:leagueId/seasons/:seasonId/standings/:key`. SPA fallback in
`wrangler.jsonc` already serves deep links; no Worker HTML handling.

The page must not import auth hooks or the org-scoped collections
(`useStandings` needs a session org). All data comes from the resolve endpoint via
`useQuery` with `retry: false`, keyed by the full path.

### Shell

- No sidebar, header, or user menu. A minimal top bar with the Scorebrawl
  wordmark linking to `/`, and no navigation.
- Title is set on mount (`<League> · <Season> standings`), and a
  `robots: noindex, nofollow` meta tag is injected for the lifetime of the page.
  The static shell stays the marketing one: share URLs are unlinked and
  JS-rendered, so there is no crawling path in v1 and no Worker HTML rewrite.
- Page container: `relative isolate mx-auto max-w-5xl px-4 py-6 md:py-12`.
  Below the shell: hero → main grid.

### Glow

- One ambient glow layer behind the whole stack:
  `<div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] page-glow" />`.
- New `@utility page-glow` next to the existing glow utilities in
  `apps/web/src/index.css`. The utility supplies only the gradient —
  `radial-gradient(circle at 50% 0%, color-mix(in oklab, var(--glow-purple-solid) 14%, transparent), transparent 65%)`
  — while the element carries the sizing (`mx-auto max-w-4xl`), so it is centred
  on desktop and reads as a single soft pool behind the hero on mobile.
- Cards keep the existing treatment: `card-glow-purple` (hero),
  `card-glow-emerald` (recent results), `card-glow-blue` (CTA) as an absolutely
  positioned inset layer, exactly like `DashboardCard`.
- Error states swap the hero to `card-glow-red`; the ambient layer stays neutral
  (no red wash) so the message stays the loudest thing on screen.
- The glow never animates. Page entrance is a single 150ms fade, disabled under
  `prefers-reduced-motion`.

### Layout

- `grid` with `lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-6`; single
  column on mobile.
- Hero card spans the full width in both: league avatar/logo, league name, season
  name, and status chips — `Shared link · expires in 6 days` or `Never expires`,
  plus `Updated 5 minutes ago`.
- Desktop: standings in the wide column; right column holds recent results (5)
  and the sign-up CTA. Mobile order is hero → standings → results → CTA.

### Standings card

- Card header carries the pager: ghost arrow buttons
  (`ArrowLeft01Icon` / `ArrowRight01Icon`), hidden when there is a single page,
  `aria-label="Previous page"` / `"Next page"`, ≥44px hit area on touch. This is
  the same pattern as `TeamStandingCard`.
- `PAGE_SIZE = 10`, local state starting at page 0, page count derived from the
  row count. All rows are already in the payload; paging is client-side.
- Rows keep the season page's visuals: `StreakAvatar`, `FormBar`, `FormDots`,
  `winPct` and `calculateStreak` from `core/presentation`; table on `md+`, card
  rows below `md`. Rank is rendered from the server-provided `rank`.
- Empty season: `No matches registered yet` inside the card, pager hidden.

### States

| state            | hero                                                    | body                   |
| ---------------- | ------------------------------------------------------- | ---------------------- |
| expired          | red glow, lock icon, `This link expired on 28 Oct 2026` | standings not rendered |
| revoked          | red glow, `This link was revoked`                       | standings not rendered |
| sharing disabled | red glow, `Sharing was disabled for this league`        | standings not rendered |
| not found        | neutral, `This link doesn't exist`                      | nothing, CTA to `/`    |
| rate limited     | neutral, `Too many requests — try again in a minute`    | retry button           |
| loading          | skeleton hero + skeleton rows matching the final layout | —                      |

Every error state ends with a link home and, where useful, "Ask a league admin for
a new link". No standings data is ever partially rendered in an error state.

### Accessibility

- Table semantics on desktop, list semantics on mobile; `<h1>` is the league name,
  `<h2>` the standings card title.
- Glow layers are `aria-hidden` and never carry contrast-critical text; body text
  sits on `bg-card`.
- Focus rings preserved on the pager and CTA; no scroll-jacking.

## Frontend refactor

`season/standing.tsx` currently mixes data fetching with presentation. Extract:

- `apps/web/src/routes/-components/standings/standings-table.tsx` — presentational,
  takes `rows` (already ranked), `onRowClick?`, `highlightPlayerIds?`, renders the
  mobile list and the desktop table exactly as today.
- `apps/web/src/routes/-components/standings/standings-pager.tsx` — the arrow
  header action, takes `page`, `pageCount`, `onPageChange`.

The season page's `Standing` becomes a thin wrapper: fetch via `useStandings`,
`sortStandings`, pass rows through. `data-testid` values (`standings-table`,
`standing-row-*`, `standing-name-*`, `standing-score-*`, `standings-empty`) are
preserved so the existing e2e suite keeps working.

The shared page consumes the same two components with server data and no
navigation.

## Permissions

| action                               | owner | editor | member | anonymous |
| ------------------------------------ | ----- | ------ | ------ | --------- |
| create / list / revoke a season link | ✓     | ✓      | ✗      | ✗         |
| toggle `allowPublicShares`           | ✓     | ✗      | ✗      | ✗         |
| view a valid link                    | ✓     | ✓      | ✓      | ✓         |

## Edge cases

- League or season deleted → links cascade away; the page resolves to `404`.
- Season archived/closed → still viewable. A closed season's standings are the
  useful artifact (ceremony, final table).
- Link creator leaves the league → link survives until expiry or revoke; the row
  keeps `created_by` for audit.
- Disabling sharing revokes every active link; re-enabling does not resurrect
  them. The toggle's confirm copy must say so.
- No standings yet → empty state, not an error.
- Very large seasons (100+ players) → single query, one payload, client paging at
  10 rows; payload is display fields only.
- Clock skew → expiry is decided server-side; the page treats the server response
  as truth and only formats dates locally.
- Double-submit on create → each call makes a new link; that is acceptable and
  visible in the list.

## Testing

Worker integration tests (`apps/worker/src/test/trpc/` pattern):

- create → resolve `200`, payload has no `userId`/`isGuest`/email, `viewCount`
  increments through the resolve path.
- created token is never stored raw (assert `token_hash !== token` and no column
  contains the token).
- `1h` link resolves before expiry and `410 expired` after (inject/freeze `now`
  rather than sleeping).
- revoke → `410 revoked`; other season's links unaffected.
- setting off → `403 sharing_disabled`, and every active link is revoked.
- non-member / member create → `FORBIDDEN`; editor/owner → allowed.
- unknown key, malformed key, and a key from another season → `404`.
- rate limiter rejects the 61st request in a window (mock binding).

Web e2e (`apps/e2e`):

- owner creates a `7d` link from the season page, copies the URL, opens it in a
  fresh context → hero, standings, pagination, CTA visible, no app chrome.
- seeded expired and revoked links → red state, no table in the DOM.
- mobile viewport (390px) and desktop (1440px): no horizontal scroll, pager
  reachable, glow present but not overlapping text.

Manual visual check with agent-browser at both widths before merge.

## Observability

- Structured logs: `share_link.created`, `share_link.revoked`,
  `share_setting.disabled` with `linkId`/`leagueId`/`seasonId`; never the token.
- `view_count` is the adoption metric; no analytics vendor needed.
- 5xx on resolve is a bug signal (should only be D1 failures).

## Rollout

One PR is fine but two commits keep it reviewable: (1) schema + router +
resolve endpoint + tests, (2) shared page + standings extraction + e2e. Backend
ships dark — links only exist if an owner creates one and turns the setting on.

## Documentation to update with the implementation

- `docs/features/10-public-shareable-leaderboard.md` — rewrite for this approach
  (done at spec time; keep the status line in sync as work lands).
- `docs/features/README.md` — status row for #10.
- Public API docs are unaffected; this endpoint is app-host and undocumented.
