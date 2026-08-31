# Feature Backlog

Candidate features from a full app walkthrough + codebase triage (browser session + backend surface map). Each file is intentionally short — enough context to start work, not a spec.

**Priority ordering** (01 = highest) reflects estimated ROI: closes an obvious product gap, leverages infrastructure that already exists, and/or drives engagement. Order is a discussion starting point, not final.

Status reflects merged PRs as of 2026-08-28. **Done** = shipped in product; **Partial** = core slice shipped but feature not complete per its acceptance criteria.

| #   | Feature                                                            | Status                                                                              | Resolved by                                            |
| --- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------- | ------------------------------------------------------ |
| 01  | [In-app notifications](01-in-app-notifications.md)                 | Partial — SSE toasts for match/session/achievement; no inbox (bell, mark-read, table) | [#651](https://github.com/thor-coding-cowboys/scorebrawl/pull/651) |
| 02  | [Achievements showcase](02-achievements-showcase.md)               | Partial — player profile grid + unlock toast; no league-wide board                  | [#651](https://github.com/thor-coding-cowboys/scorebrawl/pull/651) |
| 03  | [Season close ceremony](03-season-close-ceremony.md)               | Not started — `season_winner` still never computed                                  |                                                        |
| 04  | [League activity feed](04-league-activity-feed.md)                 | Not started                                                                         |                                                        |
| 05  | [Team management CRUD](05-team-management-crud.md)                 | Partial — read/update only; no create or delete                                     |                                                        |
| 06  | [Manual session lineup](06-manual-session-lineup.md)               | Done — `manual` rotation mode with lineup picker                                   | [#608](https://github.com/thor-coding-cowboys/scorebrawl/pull/608) |
| 07  | [Fixtures / 3-1-0 UX](07-fixtures-points-season-ux.md)             | Done — round-robin fixtures + inline score entry                                   |                                                        |
| 08  | [Real-time standings SSE](08-standings-realtime-sse.md)            | Partial — standings refresh live via `match:insert`/`match:delete`; `standings:update` still never emitted |                                                        |
| 09  | [elo-individual-vs-team](09-elo-individual-vs-team.md)             | Partial — `1-v-n-elo` shipped; `elo-individual-vs-team` calc exists but not selectable | [#648](https://github.com/thor-coding-cowboys/scorebrawl/pull/648) |
| 10  | [Public shareable leaderboard](10-public-shareable-leaderboard.md) | Not started                                                                         |                                                        |
| 11  | [Head-to-head rivalries](11-head-to-head-rivalries.md)             | Done — player comparison page with head-to-head stats                              | [#630](https://github.com/thor-coding-cowboys/scorebrawl/pull/630) |
| 12  | [Guest player claiming](12-guest-player-claiming.md)               | Done — guest create + claim-on-signup via invite email                             | [#589](https://github.com/thor-coding-cowboys/scorebrawl/pull/589), [#597](https://github.com/thor-coding-cowboys/scorebrawl/pull/597) |
| 13  | [CSV export](13-csv-export.md)                                     | Not started                                                                         |                                                        |
| 14  | [Admin ban & impersonation](14-admin-ban-impersonation.md)         | Not started — admin panel is read-only; no ban/impersonate UI                      |                                                        |
| 15  | [PWA + push notifications](15-pwa-push-notifications.md)           | Partial — manifest only; no service worker, no push                                |                                                        |
| 16  | [Mobile polish](16-mobile-polish.md)                               | Partial — mobile sidebar/drawers; ongoing                                          |                                                        |
| 17  | [API key management UI](17-api-key-management.md)                  | Not started — API key feature removed in [#637](https://github.com/thor-coding-cowboys/scorebrawl/pull/637) |                                                        |
| 18  | [AI weekly recaps](18-ai-weekly-recaps.md)                         | Not started                                                                         |                                                        |

Suggested sequencing note: 01 → 02 → 03 form a coherent "engagement" slice and build on the same event/achievement plumbing. 05 and 06 are independent and cheap. 15 depends on 01.
