# Feature Backlog

Candidate features from a full app walkthrough + codebase triage (browser session + backend surface map). Each file is intentionally short — enough context to start work, not a spec.

**Priority ordering** (01 = highest) reflects estimated ROI: closes an obvious product gap, leverages infrastructure that already exists, and/or drives engagement. Order is a discussion starting point, not final.

| #   | Feature                                                            | Rationale for priority                                                             |
| --- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| 01  | [In-app notifications](01-in-app-notifications.md)                 | Foundations for streaks/achievements/sessions; all event infra exists              |
| 02  | [Achievements showcase](02-achievements-showcase.md)               | Engine fully built, invisible in UI; pure win                                      |
| 03  | [Season close ceremony](03-season-close-ceremony.md)               | Completes the core season loop; awards declared-but-never-computed `season_winner` |
| 04  | [League activity feed](04-league-activity-feed.md)                 | Surfaces all existing analytics as a living timeline                               |
| 05  | [Team management CRUD](05-team-management-crud.md)                 | Obvious gap; repo functions already exist                                          |
| 06  | [Manual session lineup](06-manual-session-lineup.md)               | `manual` rotation mode is a stub                                                   |
| 07  | [Fixtures / 3-1-0 UX](07-fixtures-points-season-ux.md)             | Points seasons generate fixtures with minimal UI                                   |
| 08  | [Real-time standings SSE](08-standings-realtime-sse.md)            | Declared event never emitted; tiny change, big polish                              |
| 09  | [elo-individual-vs-team](09-elo-individual-vs-team.md)             | Engine + schema ready; just not exposed                                            |
| 10  | [Public shareable leaderboard](10-public-shareable-leaderboard.md) | Social sharing / virality for office leagues                                       |
| 11  | [Head-to-head rivalries](11-head-to-head-rivalries.md)             | Rivalries are the emotional core; data exists                                      |
| 12  | [Guest player claiming](12-guest-player-claiming.md)               | Converts guests to active accounts                                                 |
| 13  | [CSV export](13-csv-export.md)                                     | Cheap organizer utility                                                            |
| 14  | [Admin ban & impersonation](14-admin-ban-impersonation.md)         | Moderation; schema-ready                                                           |
| 15  | [PWA + push notifications](15-pwa-push-notifications.md)           | Depends on 01; retention loop                                                      |
| 16  | [Mobile polish](16-mobile-polish.md)                               | Bug-hunt + fixes pass                                                              |
| 17  | [API key management UI](17-api-key-management.md)                  | Enables integrations                                                               |
| 18  | [AI weekly recaps](18-ai-weekly-recaps.md)                         | Bigger bet; needs AI provider wiring                                               |

Suggested sequencing note: 01 → 02 → 03 form a coherent "engagement" slice and build on the same event/achievement plumbing. 05 and 06 are independent and cheap. 15 depends on 01.
