# Feature Backlog

Candidate features from a full app walkthrough + codebase triage (browser session + backend surface map). Each file is intentionally short — enough context to start work, not a spec.

**Priority ordering** (01 = highest) reflects estimated ROI: closes an obvious product gap, leverages infrastructure that already exists, and/or drives engagement. Order is a discussion starting point, not final. Numbers are stable identifiers; shipped features move to [`done/`](done/) but keep their number for traceability.

Status reflects merged PRs as of 2026-09-10. **Done** = shipped in product; **Partial** = core slice shipped but feature not complete per its acceptance criteria. Done stories live in [`done/`](done/).

| #   | Feature                                                            | Status                                                                                                      | Resolved by                                                        |
| --- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 01  | [In-app notifications inbox](01-b-in-app-notifications.md)         | Partial — toast layer shipped (#651); persistent inbox (bell, unread badge, list, mark-read) remaining      | [#651](https://github.com/thor-coding-cowboys/scorebrawl/pull/651) |
| 03  | [Season close ceremony](03-season-close-ceremony.md)               | Partial — `season_winner` awarded on close (#661); ceremony/podium view not started                         | [#661](https://github.com/thor-coding-cowboys/scorebrawl/pull/661) |
| 04  | [League activity feed](04-league-activity-feed.md)                 | Not started                                                                                                 |                                                                    |
| 05  | [Team management CRUD](05-team-management-crud.md)                 | Partial — read/update only; no create or delete                                                             |                                                                    |
| 08  | [Real-time standings SSE](08-standings-realtime-sse.md)            | Partial — standings refresh live via `match:insert`/`match:delete`; `standings:update` still never emitted  |                                                                    |
| 09  | [elo-individual-vs-team](09-elo-individual-vs-team.md)             | Partial — `1-v-n-elo` shipped; `elo-individual-vs-team` calc exists but not selectable                      | [#648](https://github.com/thor-coding-cowboys/scorebrawl/pull/648) |
| 10  | [Public shareable leaderboard](10-public-shareable-leaderboard.md) | Not started                                                                                                 |                                                                    |
| 13  | [CSV export](13-csv-export.md)                                     | Not started                                                                                                 |                                                                    |
| 14  | [Admin ban & impersonation](14-admin-ban-impersonation.md)         | Not started — admin panel is read-only; no ban/impersonate UI                                               |                                                                    |
| 15  | [PWA + push notifications](15-pwa-push-notifications.md)           | Partial — manifest only; no service worker, no push                                                         |                                                                    |
| 16  | [Mobile polish](16-mobile-polish.md)                               | Partial — mobile sidebar/drawers; ongoing                                                                   |                                                                    |
| 17  | [API key management UI](17-api-key-management.md)                  | Not started — API key feature removed in [#637](https://github.com/thor-coding-cowboys/scorebrawl/pull/637) |                                                                    |
| 18  | [AI weekly recaps](18-ai-weekly-recaps.md)                         | Not started                                                                                                 |                                                                    |
| 19  | [BullsAI integration](19-bullsai-integration.md)                   | Not started — push BullsAI match results into ScoreBrawl; start with 1-v-n games                            |                                                                    |
| 20  | [MCP server OAuth](20-mcp-oauth-provider.md)                       | Not started — replace MCP session auth with better-auth `mcp()`; builds on 19; supports DCR                 |                                                                    |

## Done

Shipped stories, kept for reference in [`done/`](done/):

| #   | Feature                                                            | Resolved by                                                                                                                            |
| --- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| 01a | [In-app notifications (toasts)](done/01-a-in-app-notifications.md) | [#651](https://github.com/thor-coding-cowboys/scorebrawl/pull/651)                                                                     |
| 02  | [Achievements showcase](done/02-achievements-showcase.md)          | [#661](https://github.com/thor-coding-cowboys/scorebrawl/pull/661)                                                                     |
| 06  | [Manual session lineup](done/06-manual-session-lineup.md)          | [#608](https://github.com/thor-coding-cowboys/scorebrawl/pull/608)                                                                     |
| 07  | [Fixtures / 3-1-0 UX](done/07-fixtures-points-season-ux.md)        |                                                                                                                                        |
| 11  | [Head-to-head rivalries](done/11-head-to-head-rivalries.md)        | [#630](https://github.com/thor-coding-cowboys/scorebrawl/pull/630)                                                                     |
| 12  | [Guest player claiming](done/12-guest-player-claiming.md)          | [#589](https://github.com/thor-coding-cowboys/scorebrawl/pull/589), [#597](https://github.com/thor-coding-cowboys/scorebrawl/pull/597) |

Suggested sequencing note: 01 → 02 → 03 form a coherent "engagement" slice and build on the same event/achievement plumbing (01 toasts and 02 showcase now shipped; 03 ceremony remains). 05 is independent and cheap. 15 depends on 01.
