# Mobile League Switcher + Active League Home — Design

Date: 2026-08-29
Status: Approved (brainstorming)

## Problem

The mobile app (`apps/mobile`, Expo SDK 57) is a minimal two-tab shell: a Home screen with a welcome message and a sign-out button, and an Explore template screen. It has no concept of leagues, no active-league state, and no way to switch between leagues. The web app already has full league/org selection: the active league lives server-side on the session (`session.activeOrganizationId`), persisted across sign-ins via `user_preference.lastActiveOrganizationId`, and switching is done through better-auth's `organization.setActive`.

Goal: bring Slack-style league/org selection to mobile.

- An avatar in the **top-left** of a header bar that is **always visible** (all tabs).
- Tapping the avatar opens a **left sidebar drawer** containing: a **Profile settings** item, a **scrollable list of leagues** the user belongs to, and **Sign out** pinned at the bottom.
- Next to the avatar in the header bar, show the **active league's name**.
- The Home tab shows the **active season of the active league** (the web app's default per-league screen), read-only.
- If the active league has **no active season**, Home routes to the **Seasons** bottom tab (season list).
- If the user has **no leagues**, show an empty screen pointing to create a league on `https://scorebrawl.com` (no in-app league creation).
- There is **always one active league**: fall back to `organizations[0]` and call `setActive` when the session has none.

## Decisions

- **Drawer**: Expo Router's bundled `Drawer` layout (`expo-router/drawer`), backed by `react-native-drawer-layout@4.2.2` (already in workspace root). It ships in SDK 57; `react-native-reanimated`, `react-native-worklets`, and `react-native-gesture-handler` are already installed. The hamburger is just the default `headerLeft` — we replace it with the avatar and open the drawer programmatically. `drawerContent` is a fully custom component holding Profile settings + league list + Sign out. No new native dependencies.
- **Backend access**: tRPC + better-auth only, mirroring the web app. No new transport or fetch wrappers.
  - League list + active league + switching: better-auth `organizationClient` (`useListOrganizations`, `organization.setActive`).
  - Season/standings data: tRPC (`season.findActive`, `season.getAll`, `seasonPlayer.getStanding`) via a new mobile tRPC client.
- **Active league rule** (mirror web): `activeOrgId = session.session?.activeOrganizationId ?? organizations[0]?.id`. If user has leagues but no `activeOrganizationId`, call `organization.setActive({ organizationId: organizations[0].id })` and invalidate queries.
- **Home screen**: read-only standings dashboard, "similar but not identical" to web. Shows league + season name and standings rows as mobile cards (rank, name/initials, score, W/L, today's +/-, last-5 form). No Start Session / Match actions.
- **No active season**: `season.findActive` returns null → `router.replace` to the Seasons tab.
- **No leagues**: Home renders an empty state "Create a league on https://scorebrawl.com", opening the URL via `expo-web-browser` (already installed).
- **Seasons tab**: lists `season.getAll` (name, status chip active/upcoming/ended/closed derived from dates + `closed`/`archived`, date range). Read-only for now.
- **Profile screen**: new route showing avatar/initials, name, email. Placeholder — no settings editing.

## Approach selected

**Expo Router `Drawer` wrapping the tabs navigator**, plus a mobile tRPC client and `organizationClient` on the mobile auth client.

Rejected alternatives:
- **A — Hand-rolled reanimated left drawer**: full control but significant custom animation/gesture/backdrop work. Rejected: "don't want too much custom stuff".
- **B — `react-native-drawer-layout` used directly**: same engine the bundled Drawer uses, but then we hand-wire the header/route mapping. Rejected: the Expo Router Drawer already integrates with the file-based router.

## Architecture

### Route tree

```
app/
  _layout.tsx            # Stack (auth guard) — mostly unchanged
  (drawer)/
    _layout.tsx          # <Drawer> with custom headerLeft + drawerContent
    (tabs)/
      _layout.tsx        # NativeTabs: index (Home), seasons
      index.tsx          # Home — active season dashboard (or empty state)
      seasons.tsx        # Seasons list
  profile.tsx            # New Profile settings screen
  sign-in.tsx / sign-up.tsx
```

- The `Drawer` wraps the tabs navigator as a single screen, so its header (avatar + active league name) is always visible across all tabs (Slack pattern).
- `headerLeft`: avatar button (initials circle, or user image if present) → `navigation.openDrawer()`.
- `headerTitle`: active league name, derived from session + `useListOrganizations`.
- `drawerContent`: custom component —
  - Profile settings row → `/profile`
  - Scrollable Leagues section: logo/initials + name + active checkmark; tap → `organization.setActive({ organizationId })`, invalidate tRPC queries, close drawer
  - Sign out pinned at bottom → `authClient.signOut()` then `router.replace("/sign-in")`

### Plumbing

- `apps/mobile/src/lib/trpc.ts` (new): `createTRPCClient<TRPCRouter>` with `httpLink` at `${AUTH_BASE_URL}/api/trpc`, superjson transformer, headers set from `authClient.getCookie()` (SecureStore session cookie; the worker's tRPC context already reads cookies). Type source: `@coding-cowboys/scorebrawl-worker/trpc`.
- Root layout wraps with `QueryClientProvider` + `TRPCProvider` (`@trpc/tanstack-react-query`) so screens can use `useTRPC()` + `useQuery` hooks.
- `apps/mobile/src/lib/auth-client.ts`: add `organizationClient({})` from `better-auth/client/plugins` (web parity). Keep `expoClient`.
- `apps/mobile/src/components/league-drawer.tsx` (new): the custom `drawerContent`.
- `apps/mobile/src/components/avatar.tsx` (new): initials/image circle (mirrors web `getInitials` + Avatar).
- `apps/mobile/src/components/app-header-left.tsx` (new): avatar button used as `headerLeft`.
- `apps/mobile/src/hooks/use-active-league.ts` (new): derives active league from session + organizations, returns `{ league, organizations, isLoading, switchLeague }`.

### Data flow

- League list & active id: better-auth (`useSession`, `useListOrganizations`).
- Home: `useTRPC().season.findActive.queryOptions()` (no input; scoped to active org server-side via `leagueProcedure`) → if null, `router.replace("/seasons")` tab.
- Home standings: `seasonPlayer.getStanding.queryOptions({ seasonSlug })` (from the found active season).
- Seasons tab: `season.getAll.queryOptions()` (no input; active-org scoped).
- Switching league: `organization.setActive({ organizationId })` → `queryClient.invalidateQueries()` → drawer closes, header + Home/Seasons refetch.

## UI / theme

- Use existing primitives: `ThemedView`, `ThemedText`, `Button`, `Card`, theme colors from `constants/theme.ts` (light/dark).
- Drawer/header colors follow `Colors[scheme]` (background, backgroundElement, border, primary).
- Icons via `expo-symbols` `SymbolView` (existing pattern in `ui/collapsible.tsx`), e.g. chevron, checkmark, user, logout.
- Avatar: initials circle with primary background; use user/league image (`expo-image`, installed) when present, else initials. League logos are R2 keys served via `/api/user-assets/{key}`.

## Dependencies (all in root catalog)

`@trpc/client`, `@trpc/tanstack-react-query`, `@tanstack/react-query`, `superjson`, `@coding-cowboys/scorebrawl-worker` (types), `better-auth` (client plugins). Drawer requires no new install.

## Error / edge handling

- tRPC failures → inline error state with retry.
- Active league missing from organizations (deleted) → fall back to `organizations[0]`, set active.
- Sign out clears session → auth guard routes to `/sign-in`.
- User with zero leagues → empty state (create on scorebrawl.com), drawer still shows Profile settings + Sign out.

## Verification

- `bun oxc` and `bun typecheck` after changes; `bun run check` for full verification.
- Test on the **iOS simulator** (`expo run:ios` / `bun ios`), verifying with **agent-browser** where possible (mobile web build via `expo start --web` for browser validation), logged in as `seed@scorebrawl.com`.
- Validate: header shows avatar + active league name; drawer opens with Profile settings, league list, sign out; tapping a league switches active league and updates header + Home; Home shows active season standings; no-active-season league routes to Seasons tab; user with no leagues sees the create-on-web empty state.