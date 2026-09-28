---
name: mobile-web-parity
description: >
  When building mobile app screens for Scorebrawl, ALWAYS consult this skill first.
  Use when the user asks to create, modify, or improve any mobile view, screen,
  component, or feature that also exists in the web app. This includes season views,
  match views, standings, dashboards, dialogs, forms, and any league/season/player UI.
  The web app has a polished, well-tested design — mobile should mimic it closely
  rather than reinventing layouts.
---

# Mobile-Web Parity

## Purpose

The Scorebrawl web app (`apps/web`) already has mature, user-tested UI for nearly
every feature. When building the equivalent in the mobile app (`apps/mobile`),
start from the web implementation and adapt it to mobile constraints rather than
designing from scratch.

## Workflow

1. **Identify the equivalent web route**
   - Search `apps/web/src/routes/` for the feature name (e.g., `seasons`, `matches`, `standings`)
   - Look in `_authenticated/_sidebar/leagues/$slug/seasons/` for season-related screens
   - Read the route file and its co-located `-components/` directory

2. **Study the web layout at mobile breakpoint**
   - The web app already has responsive designs — focus on the `md:hidden` or
     mobile-specific sections (dashboard cards carousel, stacked layouts, etc.)
   - Note the data fetching patterns (tRPC queries, loading states, error handling)
   - Note the component hierarchy and what sub-components exist

3. **Map to mobile patterns**
   - Replace web components with mobile equivalents:
     - `OverviewCard` / `Card` → native `View` containers with borders
     - `Button` (shadcn) → mobile `Button` component
     - `AvatarWithFallback` → mobile `Avatar` component
     - Tables / grids → `FlatList` with row components
     - Dialogs / drawers → screens or bottom sheets
   - Use existing mobile components from `apps/mobile/src/components/`
   - Follow existing mobile style patterns (max-width containers, safe areas, spacing constants)

4. **Reuse data layer**
   - Use the same tRPC procedures as the web app
   - Check `apps/worker/src/trpc/router/` for available endpoints
   - Mobile and web share the same API — no need for new endpoints

5. **Follow mobile file organization**
   - Screens go in `apps/mobile/src/app/(drawer)/(tabs)/<feature>/`
   - Use Expo Router file-based routing
   - Co-locate feature-specific components near their route
   - Shared UI components go in `apps/mobile/src/components/`

## Key Reference Locations

- **Web routes**: `apps/web/src/routes/_authenticated/_sidebar/leagues/$slug/`
- **Web components**: `apps/web/src/routes/_authenticated/_sidebar/leagues/$slug/seasons/-components/`
- **Mobile routes**: `apps/mobile/src/app/(drawer)/(tabs)/`
- **Mobile components**: `apps/mobile/src/components/`
- **tRPC routers**: `apps/worker/src/trpc/router/`
- **Theme constants**: `apps/mobile/src/constants/theme.ts`

## Anti-Patterns

- **Don't** design mobile screens from scratch without checking the web equivalent first
- **Don't** create new tRPC endpoints when the web app already fetches the same data
- **Don't** use different data shapes than the web app — the tRPC types are shared
- **Don't** ignore the existing mobile component library (StandingRow, Avatar, ThemedText, etc.)

## Example

User: "Create a season overview screen"

1. Find web equivalent: `apps/web/src/routes/_authenticated/_sidebar/leagues/$slug/seasons/$seasonSlug/index.tsx`
2. Study its mobile layout: `DashboardCards` carousel (mobile), `StandingTabs`, `LatestMatches`
3. Decide scope with user: which sections to include (all, standings only, etc.)
4. Build mobile screen using `StandingRow`, `FlatList`, same tRPC queries
5. Place route at `apps/mobile/src/app/(drawer)/(tabs)/seasons/[seasonSlug].tsx`
