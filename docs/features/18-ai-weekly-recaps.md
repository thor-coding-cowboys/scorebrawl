# AI Weekly Recaps & Match Narratives

## Summary

Auto-generate narrative summaries — weekly league recaps and match highlights — using the rich analytics already available (upsets, streaks, records, win probability).

## Why / Goal

The data layer (tRPC + 34 MCP tools) is deep but static. AI-generated recaps turn raw numbers into shareable, delightful content that drives engagement and gives the league something to talk about.

## Scope

- Weekly recap: movers, upsets, streaks, record-breakers, standout performances (player/team)
- Match narrative: one-paragraph story per notable match (upset, comeback, blowout)
- Generation via an AI provider call (worker fetch to LLM) with structured inputs from existing stats
- Preview + publish flow; recap stored and shown on the season page / activity feed
- Reuse existing stats logic (upsets, biggest margins, most improved, streaks)

## Code map

- Analytics logic already in: `apps/worker/src/services/mcp-tools/tool-executors.ts` (get_upsets, get_biggest_margins, get_most_improved, get_streaks, get_win_probability, get_season_highlights)
- Weekly stats: `seasonPlayer.getWeeklyStats`, `seasonTeam.getWeeklyStats`
- LLM call: add a service in `apps/worker/src/services/` (Cloudflare Worker `fetch` to provider)
- Display: season dashboard `.../seasons/$seasonSlug/index.tsx` / `04-league-activity-feed.md`

## Acceptance criteria

- A weekly recap can be generated from a season's data and rendered on the season page
- Notable-match narrative generation works for flagged matches
- Generation is async/queued (not blocking match entry), with preview before publish
- Token/cost guardrails (rate-limit generation, cache per week)

## Open questions / notes

- Which AI provider/key to use in the worker (no provider wired yet in worker)
- Keep human-in-the-loop (preview) vs fully automatic
