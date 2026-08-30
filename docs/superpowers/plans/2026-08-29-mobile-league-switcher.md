# Mobile League Switcher + Active League Home — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Slack-style league switching to the mobile app — avatar in a persistent top-left header, a left drawer with Profile settings + league list + Sign out, and a Home tab showing the active league's active season.

**Architecture:** Use Expo Router's bundled `Drawer` navigator (`expo-router/drawer`, SDK 57) wrapping the NativeTabs navigator, so the drawer header (avatar + active league name) is always visible. Add `organizationClient` to the mobile better-auth client for league list/setActive, and a new mobile tRPC client (`@trpc/client` + `@trpc/tanstack-react-query`) to fetch `season.findActive`, `season.getAll`, and `seasonPlayer.getStanding`. Active league is derived from `session.session.activeOrganizationId` with fallback to `organizations[0]`.

**Tech Stack:** Expo SDK 57 (expo-router Drawer, NativeTabs), React Native 0.86, better-auth (`organizationClient`, `expoClient`), tRPC v11, TanStack Query v5, superjson, TypeScript. Backend is the existing Cloudflare Worker (`apps/worker`) — no backend changes needed.

---

### Task 1: Add mobile dependencies

**Files:**
- Modify: `apps/mobile/package.json`

Add the tRPC/TanStack deps to `apps/mobile/package.json` dependencies (all exist in the root catalog):

```json
"@coding-cowboys/scorebrawl-worker": "workspace:*",
"@tanstack/react-query": "catalog:",
"@trpc/client": "catalog:",
"@trpc/tanstack-react-query": "catalog:",
"superjson": "catalog:",
```

- [ ] **Step 1: Edit package.json**

Add the five entries above to `apps/mobile/package.json` `dependencies`, alphabetically (place `@coding-cowboys/scorebrawl-worker` first under `@better-auth/expo`, keep the rest sorted).

- [ ] **Step 2: Install**

Run: `bun install`
Expected: succeeds, updates `bun.lock`. Do not commit `bun.lock` separately — it will be included in a later commit.

- [ ] **Step 3: Verify worker package is resolvable from mobile**

Run: `bun --cwd apps/mobile add @coding-cowboys/scorebrawl-worker@workspace:*` (if Step 2 didn't link the workspace package) then confirm `bun --cwd apps/mobile ls @coding-cowboys/scorebrawl-worker` prints the workspace path `workspace:*` → `/Users/palmithor/git/palmithor/scorebrawl/apps/worker`.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/package.json bun.lock
git commit -m "feat(mobile): add tRPC + tanstack query deps"
```

---

### Task 2: Mobile auth client — add organizationClient

**Files:**
- Modify: `apps/mobile/src/lib/auth-client.ts`

The web client (`apps/web/src/lib/auth-client.ts`) uses `organizationClient({})` from `better-auth/client/plugins`. Mobile must match to get `authClient.organization.list`, `.setActive`, `useListOrganizations()`, `useActiveMember()`.

- [ ] **Step 1: Update the file to the exact content below**

```ts
import { expoClient } from "@better-auth/expo/client";
import { organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";

export const AUTH_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "https://scorebrawl.localhost:1355";

export const authClient = createAuthClient({
	baseURL: AUTH_BASE_URL,
	plugins: [
		expoClient({
			scheme: "scorebrawl",
			storagePrefix: "scorebrawl",
			storage: SecureStore,
		}),
		organizationClient({}),
	],
});
```

- [ ] **Step 2: Verify types**

Run: `bun --cwd apps/mobile tsc --noEmit` (if a `typecheck` script exists; otherwise `bun --cwd apps/mobile run expo customize` is not needed — use `bunx tsc --noEmit` from `apps/mobile`).
Expected: compiles. `authClient.useListOrganizations` and `authClient.organization.setActive` now exist on the client type.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/lib/auth-client.ts
git commit -m "feat(mobile): add organization client to better-auth"
```

---

### Task 3: Mobile tRPC client + query client + root providers

**Files:**
- Create: `apps/mobile/src/lib/query-client.ts`
- Create: `apps/mobile/src/lib/trpc.ts`
- Modify: `apps/mobile/src/app/_layout.tsx`

The mobile tRPC client mirrors the web one (`apps/web/src/lib/trpc.ts`) but with an absolute URL (the worker runs on `AUTH_BASE_URL`) and auth via the SecureStore session cookie exposed by the expo client's `authClient.getCookie()` (the worker's tRPC context reads cookies via `c.req.raw.headers`).

- [ ] **Step 1: Create `apps/mobile/src/lib/query-client.ts`**

```ts
import { QueryClient } from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";

export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 60 * 1000,
			refetchOnWindowFocus: false,
			retry: (failureCount, error) => {
				if (error instanceof TRPCClientError) {
					const httpStatus = error.data?.httpStatus;
					if (httpStatus && httpStatus >= 500 && httpStatus < 600) {
						return failureCount < 2;
					}
					return false;
				}
				return failureCount < 2;
			},
			retryDelay: (attemptIndex) => Math.min(2000 * 2 ** attemptIndex, 60000),
		},
		mutations: {
			retry: false,
		},
	},
});
```

- [ ] **Step 2: Create `apps/mobile/src/lib/trpc.ts`**

```ts
import type { TRPCRouter } from "@coding-cowboys/scorebrawl-worker/trpc";
import { createTRPCClient, httpLink } from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import superjson from "superjson";

import { AUTH_BASE_URL, authClient } from "./auth-client";

export const { TRPCProvider, useTRPC } = createTRPCContext<TRPCRouter>();

export const trpcClient = createTRPCClient<TRPCRouter>({
	links: [
		httpLink({
			transformer: superjson,
			url: `${AUTH_BASE_URL}/api/trpc`,
			headers: async () => {
				const cookie = await authClient.getCookie();
				return cookie ? { cookie } : {};
			},
		}),
	],
});
```

- [ ] **Step 3: Wrap root layout with providers**

Modify `apps/mobile/src/app/_layout.tsx`. The current file returns `<ThemeProvider><AnimatedSplashOverlay /><Stack ... /></ThemeProvider>`. Add the providers around the Stack (keeping `ThemeProvider` outer-most):

```tsx
import { QueryClientProvider } from "@tanstack/react-query";
...
import { TRPCProvider, trpcClient } from "@/lib/trpc";
import { queryClient } from "@/lib/query-client";
```

and inside the returned JSX:

```tsx
<ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
	<TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
		<QueryClientProvider client={queryClient}>
			<AnimatedSplashOverlay />
			<Stack screenOptions={{ headerShown: false }}>
				<Stack.Screen name="(drawer)" />
				<Stack.Screen name="sign-in" />
				<Stack.Screen name="sign-up" />
				<Stack.Screen name="profile" options={{ headerShown: true, title: "Profile" }} />
			</Stack>
		</QueryClientProvider>
	</TRPCProvider>
</ThemeProvider>
```

Note: the Stack screen name `(tabs)` becomes `(drawer)` (Task 4 moves routes). `profile` gets its own native header with a back button (pushed above the drawer).

- [ ] **Step 4: Typecheck**

Run: `bun --cwd apps/mobile tsc --noEmit` (or `bunx tsc --noEmit` in `apps/mobile`).
Expected: the `@/lib/trpc` import resolves; `TRPCProvider` accepts `trpcClient` + `queryClient`.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/lib/query-client.ts apps/mobile/src/lib/trpc.ts apps/mobile/src/app/_layout.tsx
git commit -m "feat(mobile): add tRPC client and query providers"
```

---

### Task 4: Restructure routes — drawer wrapping tabs

**Files:**
- Create: `apps/mobile/src/app/(drawer)/_layout.tsx`
- Create: `apps/mobile/src/app/(drawer)/(tabs)/_layout.tsx` (move from `(tabs)/_layout.tsx`)
- Move: `apps/mobile/src/app/(tabs)/index.tsx` → `apps/mobile/src/app/(drawer)/(tabs)/index.tsx`
- Move: `apps/mobile/src/app/(tabs)/explore.tsx` → delete (Explore tab is dropped)
- Modify: `apps/mobile/src/components/app-tabs.tsx` — tabs become Home + Seasons

New route tree:

```
app/
  _layout.tsx            # Stack (Task 3): (drawer), sign-in, sign-up, profile
  (drawer)/
    _layout.tsx          # <Drawer> with custom header + drawerContent
    (tabs)/
      _layout.tsx        # <AppTabs/>
      index.tsx          # Home
      seasons.tsx        # Seasons (new, Task 8)
  profile.tsx            # (new, Task 9)
  sign-in.tsx
  sign-up.tsx
```

- [ ] **Step 1: Move files**

```bash
mkdir -p "apps/mobile/src/app/(drawer)/(tabs)"
git mv "apps/mobile/src/app/(tabs)/index.tsx" "apps/mobile/src/app/(drawer)/(tabs)/index.tsx"
git mv "apps/mobile/src/app/(tabs)/_layout.tsx" "apps/mobile/src/app/(drawer)/(tabs)/_layout.tsx"
git rm "apps/mobile/src/app/(tabs)/explore.tsx"
```

- [ ] **Step 2: Update tab navigator** — modify `apps/mobile/src/components/app-tabs.tsx`

Current file has Home + Explore triggers. Change to Home + Seasons:

```tsx
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useColorScheme } from "react-native";

import { Colors } from "@/constants/theme";

export default function AppTabs() {
	const scheme = useColorScheme();
	const colors = Colors[scheme === "unspecified" ? "light" : scheme];

	return (
		<NativeTabs
			backgroundColor={colors.background}
			indicatorColor={colors.backgroundElement}
			labelStyle={{ selected: { color: colors.text } }}
		>
			<NativeTabs.Trigger name="index">
				<NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
				<NativeTabs.Trigger.Icon
					src={require("@/assets/images/tabIcons/home.png")}
					renderingMode="template"
				/>
			</NativeTabs.Trigger>

			<NativeTabs.Trigger name="seasons">
				<NativeTabs.Trigger.Label>Seasons</NativeTabs.Trigger.Label>
				<NativeTabs.Trigger.Icon
					src={require("@/assets/images/tabIcons/explore.png")}
					renderingMode="template"
				/>
			</NativeTabs.Trigger>
		</NativeTabs>
	);
}
```

(Reusing `explore.png` for the Seasons icon is a placeholder; a dedicated season icon can be added later.)

- [ ] **Step 3: Create `apps/mobile/src/app/(drawer)/_layout.tsx`**

```tsx
import { Drawer } from "expo-router/drawer";
import { useColorScheme } from "react-native";

import { LeagueDrawerContent } from "@/components/league-drawer";
import { AppHeaderLeft } from "@/components/app-header-left";
import { ActiveLeagueTitle } from "@/components/active-league-title";
import { Colors } from "@/constants/theme";

export default function DrawerLayout() {
	const scheme = useColorScheme();
	const colors = Colors[scheme === "unspecified" ? "light" : scheme];

	return (
		<Drawer
			screenOptions={{
				headerLeft: () => <AppHeaderLeft />,
				headerTitle: () => <ActiveLeagueTitle />,
				headerStyle: { backgroundColor: colors.background },
				headerTintColor: colors.text,
				drawerStyle: { backgroundColor: colors.background },
				headerShadowVisible: false,
			}}
			drawerContent={(props) => <LeagueDrawerContent {...props} />}
		>
			<Drawer.Screen name="(tabs)" options={{ title: "" }} />
		</Drawer>
	);
}
```

Components `LeagueDrawerContent`, `AppHeaderLeft`, `ActiveLeagueTitle` are created in Tasks 5–7; this file will not typecheck until those exist — create placeholder stubs in this step so the layout compiles, or defer typecheck to after Task 7.

- [ ] **Step 4: Stub the three components (minimal, replaced in Tasks 5–7)**

Create these three files with minimal exports so the drawer layout typechecks:

`apps/mobile/src/components/app-header-left.tsx`:
```tsx
import { Pressable } from "react-native";
import { Avatar } from "@/components/avatar";
import { useTheme } from "@/hooks/use-theme";

export function AppHeaderLeft() {
	const theme = useTheme();
	return (
		<Pressable onPress={() => {}} hitSlop={8}>
			<Avatar name="" size={32} />
		</Pressable>
	);
}
```

`apps/mobile/src/components/avatar.tsx` (this is the real component, Task 6 finalizes it):
```tsx
import { StyleSheet, View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
	const theme = useTheme();
	const initials = name
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((p) => p[0]?.toUpperCase())
		.join("");
	return (
		<View
			style={{
				width: size,
				height: size,
				borderRadius: size / 2,
				backgroundColor: theme.primary,
				alignItems: "center",
				justifyContent: "center",
			}}
		>
			<ThemedText type="smallBold" themeColor="primaryForeground">
				{initials || "?"}
			</ThemedText>
		</View>
	);
}
```

`apps/mobile/src/components/active-league-title.tsx`:
```tsx
import { ThemedText } from "@/components/themed-text";

export function ActiveLeagueTitle() {
	return <ThemedText type="subtitle">Scorebrawl</ThemedText>;
}
```

`apps/mobile/src/components/league-drawer.tsx`:
```tsx
import type { DrawerContentComponentProps } from "expo-router/drawer";
import { ThemedView } from "@/components/themed-view";

export function LeagueDrawerContent(_props: DrawerContentComponentProps) {
	return <ThemedView style={{ flex: 1 }} />;
}
```

- [ ] **Step 5: Typecheck**

Run: `bun --cwd apps/mobile tsc --noEmit` (or `bunx tsc --noEmit`).
Expected: compiles (note: `explore` route removed — ensure nothing references it).

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/app apps/mobile/src/components
git commit -m "feat(mobile): add drawer layout wrapping tabs"
```

---

### Task 5: Avatar + HeaderLeft (open drawer)

**Files:**
- Modify: `apps/mobile/src/components/avatar.tsx` — support user image + larger size
- Modify: `apps/mobile/src/components/app-header-left.tsx` — read session, open drawer on press

- [ ] **Step 1: Finalize `Avatar`** — replace the Task 4 stub with the full component

```tsx
import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { useTheme } from "@/hooks/use-theme";

function getInitials(name: string) {
	const parts = name.split(/\s+/).filter(Boolean);
	if (parts.length === 0) return "?";
	if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
	return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({
	name,
	image,
	size = 32,
}: {
	name: string;
	image?: string | null;
	size?: number;
}) {
	const theme = useTheme();
	const initials = getInitials(name);

	if (image) {
		return (
			<Image
				source={{ uri: image }}
				style={{ width: size, height: size, borderRadius: size / 2 }}
				contentFit="cover"
			/>
		);
	}

	return (
		<View
			style={{
				width: size,
				height: size,
				borderRadius: size / 2,
				backgroundColor: theme.primary,
				alignItems: "center",
				justifyContent: "center",
			}}
		>
			<ThemedText type="smallBold" themeColor="primaryForeground" style={{ fontSize: size * 0.4 }}>
				{initials}
			</ThemedText>
		</View>
	);
}
```

Note: `ThemedText` accepts a `style` prop that overrides/merges its own styles (verify in `components/themed-text.tsx` — it passes `style` to the underlying `Text`). If `type="smallBold"`'s own font size wins over `style`, drop `type` and set `style={{ fontSize, fontWeight: "600", color: theme.primaryForeground }}` directly.

- [ ] **Step 2: Finalize `AppHeaderLeft`** — replace stub

```tsx
import { useNavigation } from "expo-router";
import { Pressable } from "react-native";

import { Avatar } from "@/components/avatar";
import { authClient } from "@/lib/auth-client";

export function AppHeaderLeft() {
	const navigation = useNavigation();
	const { data } = authClient.useSession();
	const user = data?.user;

	const handlePress = () => {
		// Drawer navigation exposes openDrawer
		const drawerNav = navigation as unknown as { openDrawer?: () => void };
		drawerNav.openDrawer?.();
	};

	return (
		<Pressable onPress={handlePress} hitSlop={8} accessibilityLabel="Open league menu">
			<Avatar name={user?.name ?? ""} image={user?.image} size={32} />
		</Pressable>
	);
}
```

- [ ] **Step 3: Typecheck**

Run: `bun --cwd apps/mobile tsc --noEmit`.
Expected: compiles.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/components/avatar.tsx apps/mobile/src/components/app-header-left.tsx
git commit -m "feat(mobile): avatar header button opens drawer"
```

---

### Task 6: Active league hook

**Files:**
- Create: `apps/mobile/src/hooks/use-active-league.ts`

Mirrors the web derivation (`app-sidebar.tsx:78-80`): active org from `session.session.activeOrganizationId`, fallback to `organizations[0]`. Also exposes `switchLeague` which calls `authClient.organization.setActive` then invalidates all tRPC queries.

- [ ] **Step 1: Create the hook**

```ts
import { useQueryClient } from "@tanstack/react-query";

import { authClient } from "@/lib/auth-client";

export function useActiveLeague() {
	const queryClient = useQueryClient();
	const { data: session } = authClient.useSession();
	const { data: organizations = [], isPending } = authClient.useListOrganizations();

	const activeOrgId = session?.session?.activeOrganizationId;
	const activeLeague = activeOrgId
		? (organizations.find((org) => org.id === activeOrgId) ?? organizations[0])
		: organizations[0];

	const switchLeague = async (organizationId: string) => {
		const { error } = await authClient.organization.setActive({ organizationId });
		if (error) {
			console.error("Failed to set active league:", error);
			return false;
		}
		await queryClient.invalidateQueries();
		return true;
	};

	return {
		activeLeague,
		organizations,
		isLoading: isPending,
		switchLeague,
	};
}
```

- [ ] **Step 2: Typecheck**

Run: `bun --cwd apps/mobile tsc --noEmit`.
Expected: compiles; `useListOrganizations` and `organization.setActive` resolve from the Task 2 plugin.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/hooks/use-active-league.ts
git commit -m "feat(mobile): add useActiveLeague hook"
```

---

### Task 7: League drawer content

**Files:**
- Modify: `apps/mobile/src/components/league-drawer.tsx` — replace Task 4 stub

The drawer shows, top to bottom: user header (avatar + name/email), **Profile settings** row, scrollable **Leagues** list (initials/logo + name + checkmark on active), and **Sign out** pinned at the bottom. Tapping a league calls `switchLeague`, closes the drawer.

- [ ] **Step 1: Replace the stub with the full content**

```tsx
import type { DrawerContentComponentProps } from "expo-router/drawer";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Avatar } from "@/components/avatar";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { Spacing } from "@/constants/theme";
import { useActiveLeague } from "@/hooks/use-active-league";
import { authClient } from "@/lib/auth-client";

export function LeagueDrawerContent({ navigation }: DrawerContentComponentProps) {
	const { activeLeague, organizations, switchLeague } = useActiveLeague();
	const { data } = authClient.useSession();
	const user = data?.user;

	const handleLeaguePress = async (organizationId: string) => {
		const ok = await switchLeague(organizationId);
		if (ok) {
			navigation.closeDrawer();
		}
	};

	const handleSignOut = async () => {
		await authClient.signOut();
		router.replace("/sign-in");
	};

	return (
		<ThemedView style={styles.container}>
			<View style={styles.userHeader}>
				<Avatar name={user?.name ?? ""} image={user?.image} size={40} />
				<View style={styles.userInfo}>
					<ThemedText type="subtitle">{user?.name}</ThemedText>
					<ThemedText type="small" themeColor="textSecondary">
						{user?.email}
					</ThemedText>
				</View>
			</View>

			<Pressable
				onPress={() => {
					navigation.closeDrawer();
					router.push("/profile");
				}}
				style={styles.menuItem}
			>
				<ThemedText>Profile settings</ThemedText>
			</Pressable>

			<ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
				Leagues
			</ThemedText>

			<ScrollView style={styles.leagueList}>
				{organizations.map((org) => {
					const isActive = org.id === activeLeague?.id;
					return (
						<Pressable
							key={org.id}
							onPress={() => handleLeaguePress(org.id)}
							style={[styles.leagueItem, isActive && styles.leagueItemActive]}
						>
							<Avatar name={org.name} size={28} />
							<ThemedText style={styles.leagueName} numberOfLines={1}>
								{org.name}
							</ThemedText>
							{isActive && <ThemedText themeColor="primary">✓</ThemedText>}
						</Pressable>
					);
				})}
			</ScrollView>

			<View style={styles.signOutContainer}>
				<Button variant="outline" fullWidth onPress={handleSignOut}>
					Sign out
				</Button>
			</View>
		</ThemedView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		paddingHorizontal: Spacing.three,
		paddingTop: Spacing.five,
		paddingBottom: Spacing.four,
	},
	userHeader: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.three,
		marginBottom: Spacing.four,
	},
	userInfo: {
		flex: 1,
	},
	menuItem: {
		paddingVertical: Spacing.three,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: "rgba(128,128,128,0.3)",
	},
	sectionLabel: {
		marginTop: Spacing.four,
		marginBottom: Spacing.two,
	},
	leagueList: {
		flex: 1,
	},
	leagueItem: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.two,
		paddingVertical: Spacing.two,
		paddingHorizontal: Spacing.two,
		borderRadius: 10,
	},
	leagueItemActive: {
		backgroundColor: "rgba(128,128,128,0.12)",
	},
	leagueName: {
		flex: 1,
	},
	signOutContainer: {
		marginTop: Spacing.three,
	},
});
```

- [ ] **Step 2: Fix the checkmark** — `✓` inside `<ThemedText themeColor="primary">` renders the raw character; if it looks off on a platform, swap to `expo-symbols` `SymbolView` with `name={{ ios: "checkmark", android: "check", web: "check" }}` (pattern from `ui/collapsible.tsx`).

- [ ] **Step 3: Typecheck**

Run: `bun --cwd apps/mobile tsc --noEmit`.
Expected: compiles. Verify `Button` supports `fullWidth` (it does per Task 7 web equivalent `components/ui/button.tsx`).

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/components/league-drawer.tsx
git commit -m "feat(mobile): league drawer content with profile, leagues, sign out"
```

---

### Task 8: Seasons tab + Home (active season) screens

**Files:**
- Create: `apps/mobile/src/app/(drawer)/(tabs)/seasons.tsx`
- Modify: `apps/mobile/src/app/(drawer)/(tabs)/index.tsx` (Home)
- Create: `apps/mobile/src/lib/collections/season.ts` (shared helpers: `getSeasonStatus`, `formatDate`)
- Create: `apps/mobile/src/components/standing-row.tsx`

- [ ] **Step 1: Create `apps/mobile/src/lib/collections/season.ts`**

```ts
import type { RouterOutput } from "@/lib/trpc";
import type { TRPCRouter } from "@coding-cowboys/scorebrawl-worker/trpc";
import { inferRouterOutputs } from "@trpc/server";

type Season = RouterOutput["season"]["getAll"][number];

export function getSeasonStatus(season: Season): "active" | "upcoming" | "ended" | "locked" | "archived" {
	if (season.archived) return "archived";
	if (season.closed) return "locked";

	const now = new Date();
	const startDate = new Date(season.startDate);
	const endDate = season.endDate ? new Date(season.endDate) : null;

	if (startDate > now) return "upcoming";
	if (endDate && endDate < now) return "ended";
	return "active";
}

export function formatDate(date: Date) {
	return new Date(date).toLocaleDateString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}
```

Add to `apps/mobile/src/lib/trpc.ts`:
```ts
import type { inferRouterOutputs } from "@trpc/server";
export type RouterOutput = inferRouterOutputs<TRPCRouter>;
```

- [ ] **Step 2: Create `apps/mobile/src/components/standing-row.tsx`**

Mobile card for a standings row, mirroring web `MobileStandingRow` (`standing.tsx:23-92`) — avatar/initials, name, MP + W% + last-5 form + today's +/- (colored), score on the right.

```tsx
import { StyleSheet, View } from "react-native";

import { Avatar } from "@/components/avatar";
import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";

export type StandingItem = {
	id: string;
	name: string;
	image?: string | null;
	score: number;
	matchCount: number;
	winCount: number;
	pointDiff: number;
	form: ("W" | "D" | "L")[];
};

function winPct(item: StandingItem) {
	return item.matchCount > 0 ? Math.round((item.winCount / item.matchCount) * 100) : 0;
}

export function StandingRow({ item, rank }: { item: StandingItem; rank: number }) {
	const diffColor = item.pointDiff > 0 ? "#16a34a" : item.pointDiff < 0 ? "#dc2626" : undefined;
	return (
		<View style={styles.row}>
			<ThemedText type="small" themeColor="textSecondary" style={styles.rank}>
				{rank}
			</ThemedText>
			<Avatar name={item.name} image={item.image} size={32} />
			<View style={styles.info}>
				<ThemedText numberOfLines={1} style={styles.name}>
					{item.name}
				</ThemedText>
				<ThemedText type="small" themeColor="textSecondary">
					{item.matchCount} MP · {winPct(item)}% W
				</ThemedText>
			</View>
			<View style={styles.right}>
				<ThemedText type="subtitle" style={styles.score}>
					{item.score}
				</ThemedText>
				<ThemedText type="small" style={diffColor ? { color: diffColor } : undefined} themeColor="textSecondary">
					{item.pointDiff > 0 ? `+${item.pointDiff}` : item.pointDiff}
				</ThemedText>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.two,
		paddingVertical: Spacing.two,
	},
	rank: {
		width: 24,
		textAlign: "center",
	},
	info: {
		flex: 1,
	},
	name: {
		fontWeight: "600",
	},
	right: {
		alignItems: "flex-end",
	},
	score: {
		fontWeight: "700",
	},
});
```

Note: if `ThemedText` doesn't accept both `style` and `themeColor` together as expected, use plain `Text` with explicit color for the diff (keep `ThemedText` elsewhere). The last-5 form dots are omitted for brevity; add a row of small colored dots if desired (web `FormDots` renders W=green, D=gray, L=red).

- [ ] **Step 3: Rewrite `apps/mobile/src/app/(drawer)/(tabs)/index.tsx` (Home)**

Behavior:
- No leagues → empty state: "Create a league on scorebrawl.com" + `expo-web-browser.openBrowserAsync`.
- Leagues exist, `season.findActive` returns a season → header (league + season name) + `FlatList` of standings.
- `season.findActive` returns null → `router.replace("/seasons")` (Seasons tab).

```tsx
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import * as WebBrowser from "expo-web-browser";
import { useEffect } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { StandingRow, type StandingItem } from "@/components/standing-row";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/constants/theme";
import { useActiveLeague } from "@/hooks/use-active-league";
import { useTRPC } from "@/lib/trpc";

export default function HomeScreen() {
	const trpc = useTRPC();
	const { activeLeague, organizations, isLoading } = useActiveLeague();

	// All hooks are declared unconditionally at the top (rules of hooks).
	const activeSeasonQuery = useQuery(
		trpc.season.findActive.queryOptions(undefined, { enabled: Boolean(activeLeague) })
	);
	const activeSeason = activeSeasonQuery.data;
	const standingsQuery = useQuery(
		trpc.seasonPlayer.getStanding.queryOptions(
			{ seasonSlug: activeSeason?.slug ?? "" },
			{ enabled: Boolean(activeSeason) }
		)
	);

	useEffect(() => {
		if (!isLoading && activeLeague && activeSeasonQuery.data === null) {
			router.replace("/seasons");
		}
	}, [isLoading, activeLeague, activeSeasonQuery.data]);

	if (isLoading) {
		return (
			<ThemedView style={styles.center}>
				<ThemedText>Loading…</ThemedText>
			</ThemedView>
		);
	}

	if (organizations.length === 0) {
		return (
			<ThemedView style={styles.center}>
				<ThemedText type="title" style={styles.centerText}>
					No league yet
				</ThemedText>
				<ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
					Create a league on scorebrawl.com to get started.
				</ThemedText>
				<View style={styles.centerButton}>
					<Button
						variant="outline"
						onPress={() => WebBrowser.openBrowserAsync("https://scorebrawl.com")}
					>
						Create a league
					</Button>
				</View>
			</ThemedView>
		);
	}

	if (!activeLeague) {
		return (
			<ThemedView style={styles.center}>
				<ThemedText>No active league</ThemedText>
			</ThemedView>
		);
	}

	return (
		<ThemedView style={styles.container}>
			<SafeAreaView edges={["bottom"]} style={styles.safeArea}>
				{activeSeason && (
					<View style={styles.header}>
						<ThemedText type="small" themeColor="textSecondary">
							{activeLeague.name}
						</ThemedText>
						<ThemedText type="title">{activeSeason.name}</ThemedText>
					</View>
				)}
				<FlatList
					data={standingsQuery.data ?? []}
					keyExtractor={(item) => item.id}
					renderItem={({ item, index }) => (
						<StandingRow item={item as unknown as StandingItem} rank={index + 1} />
					)}
					contentContainerStyle={styles.list}
				/>
			</SafeAreaView>
		</ThemedView>
	);
}
```

Important:
- All `useQuery`/`useEffect`/`useActiveLeague` calls must be **before any early return** (React rules of hooks) — the code above does this.
- The `styles` object must include `container` (row flex, justify center, max-width pattern from the current `index.tsx`), `safeArea` (flex 1, maxWidth, paddingHorizontal, paddingBottom, uses `BottomTabInset`), `center` (flex 1, alignItems/justifyContent center, gap), `centerText` (textAlign center), `centerButton` (marginTop `Spacing.four`), `header` (gap `Spacing.one`), `list` (paddingBottom `Spacing.four`). Reuse the existing style values from the current `apps/mobile/src/app/(tabs)/index.tsx` (now at `(drawer)/(tabs)/index.tsx`) for container/safeArea.
- `season.findActive` and `seasonPlayer.getStanding` are typed via the worker router; confirm the exact `queryOptions` call shape from `apps/web/src/lib/collections/standing-collection.ts` (`trpc.seasonPlayer.getStanding.queryOptions({ seasonSlug })`). For inputless procedures the web pattern is `trpc.season.findActive.queryOptions()` (no input argument) — if `queryOptions(undefined, {...})` doesn't typecheck, use `queryOptions({}, {...})` or check the generated signature. The `enabled` flag for `findActive` is `Boolean(activeLeague)`.
- `Button` may not accept a `style` prop — the code above wraps it in a `View` instead. Check `apps/mobile/src/components/ui/button.tsx`.

- [ ] **Step 4: Create `apps/mobile/src/app/(drawer)/(tabs)/seasons.tsx`**

```tsx
import { useQuery } from "@tanstack/react-query";
import { FlatList, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/constants/theme";
import { getSeasonStatus, formatDate } from "@/lib/collections/season";
import { useTRPC } from "@/lib/trpc";

export default function SeasonsScreen() {
	const trpc = useTRPC();
	const { data: seasons = [], isLoading } = useQuery(trpc.season.getAll.queryOptions());

	return (
		<ThemedView style={styles.container}>
			<SafeAreaView edges={["bottom"]} style={styles.safeArea}>
				<ThemedText type="title" style={styles.title}>
					Seasons
				</ThemedText>
				<FlatList
					data={seasons}
					keyExtractor={(item) => item.id}
					renderItem={({ item }) => {
						const status = getSeasonStatus(item);
						return (
							<View style={styles.row}>
								<View style={styles.rowInfo}>
									<ThemedText style={styles.rowName}>{item.name}</ThemedText>
									<ThemedText type="small" themeColor="textSecondary">
										{formatDate(item.startDate)}
										{item.endDate ? ` → ${formatDate(item.endDate)}` : ""}
									</ThemedText>
								</View>
								<ThemedText type="smallBold">{status}</ThemedText>
							</View>
						);
					}}
					contentContainerStyle={styles.list}
					ListEmptyComponent={
						isLoading ? (
							<ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
								Loading…
							</ThemedText>
						) : (
							<ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
								No seasons yet
							</ThemedText>
						)
					}
				/>
			</SafeAreaView>
		</ThemedView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		flexDirection: "row",
		justifyContent: "center",
	},
	safeArea: {
		flex: 1,
		maxWidth: MaxContentWidth,
		paddingHorizontal: Spacing.four,
		paddingBottom: BottomTabInset + Spacing.three,
	},
	title: {
		marginTop: Spacing.four,
		marginBottom: Spacing.three,
	},
	list: {
		paddingBottom: Spacing.four,
	},
	row: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingVertical: Spacing.three,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: "rgba(128,128,128,0.25)",
	},
	rowInfo: {
		flex: 1,
	},
	rowName: {
		fontWeight: "600",
	},
	empty: {
		textAlign: "center",
		marginTop: Spacing.five,
	},
});
```

- [ ] **Step 5: Typecheck**

Run: `bun --cwd apps/mobile tsc --noEmit`.
Expected: compiles. Watch for hook-ordering rule (all hooks at top), `StandingItem` shape compatibility with the actual `getStanding` return (extra fields are fine — the cast handles it), and `Button` style prop.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/lib/collections apps/mobile/src/components/standing-row.tsx apps/mobile/src/app
git commit -m "feat(mobile): home shows active season, add seasons tab"
```

---

### Task 9: Profile screen

**Files:**
- Create: `apps/mobile/src/app/profile.tsx`

Simple placeholder: avatar/initials, name, email. Pushed as a Stack screen with the native header (Task 3 registers `profile` with `title: "Profile"`).

- [ ] **Step 1: Create the screen**

```tsx
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Avatar } from "@/components/avatar";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { authClient } from "@/lib/auth-client";

export default function ProfileScreen() {
	const { data } = authClient.useSession();
	const user = data?.user;

	return (
		<ThemedView style={styles.container}>
			<SafeAreaView edges={["bottom"]} style={styles.safeArea}>
				<View style={styles.header}>
					<Avatar name={user?.name ?? ""} image={user?.image} size={64} />
					<ThemedText type="title">{user?.name}</ThemedText>
					<ThemedText type="small" themeColor="textSecondary">
						{user?.email}
					</ThemedText>
				</View>
			</SafeAreaView>
		</ThemedView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	safeArea: {
		flex: 1,
		alignItems: "center",
		paddingTop: Spacing.six,
	},
	header: {
		alignItems: "center",
		gap: Spacing.two,
	},
});
```

- [ ] **Step 2: Typecheck**

Run: `bun --cwd apps/mobile tsc --noEmit`.
Expected: compiles.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/app/profile.tsx
git commit -m "feat(mobile): add profile screen"
```

---

### Task 10: Full verification

- [ ] **Step 1: Lint + typecheck + format**

From repo root:
```bash
bun oxc
bun typecheck
bun run format
```
Expected: all pass with no errors. Fix any oxlint/oxfmt issues from the new files (`bun oxc` auto-fixes).

- [ ] **Step 2: Full check**

Run: `bun check && bun run test`
Expected: passes. (Worker tests unaffected — no backend changes.)

- [ ] **Step 3: Regenerate routes**

Run: `bun --cwd apps/mobile run expo start` briefly (or `bunx expo customize` not needed) so expo-router's typed-routes generator picks up the new `(drawer)`/`seasons`/`profile` routes. If the app is already running, the watcher regenerates automatically.

- [ ] **Step 4: Commit any generated route types**

```bash
git add -A apps/mobile/.expo apps/mobile/expo-env.d.ts apps/mobile/src
git status
```
Expected: if `.expo/types` or `expo-env.d.ts` changed, include them; otherwise no commit needed.

---

### Task 11: Simulator + browser validation

**Requirements:** worker running at `https://scorebrawl.localhost:1355` (portless) with `seed@scorebrawl.com` / `Test.1234` (seed user). If the worker isn't running, start it from repo root: `bun dev` (turbo dev) — or `bun --cwd apps/worker dev`.

- [ ] **Step 1: Run the app on the iOS simulator**

```bash
bun --cwd apps/mobile run ios
```
Expected: Expo dev build launches on the iOS simulator. Sign in as `seed@scorebrawl.com` / `Test.1234`.

- [ ] **Step 2: Validate with agent-browser (mobile web build)**

The mobile app also builds for web (`expo start --web`). Run the web build and drive it with agent-browser:

```bash
bun --cwd apps/mobile run web
```

Then use agent-browser to navigate to the mobile web URL, sign in as seed, and assert:
- Header shows avatar (top-left) + active league name (next to it).
- Clicking the avatar opens the left drawer: user info, **Profile settings**, **Leagues** list with active league checked, **Sign out** at bottom.
- Tapping a different league switches the active league; header + Home update.
- Home shows the active season standings (rows with rank, name, MP/W%, score).
- A league with no active season routes Home to the Seasons tab.
- Profile settings opens `/profile` (avatar, name, email).

Reference pattern for driving agent-browser: the `agent-browser` skill (`agent-browser open <url>`, `snapshot -i`, `click @ref`, `fill @ref`, `get text body`, `screenshot <path>`). Login: fill email `seed@scorebrawl.com`, password `Test.1234`, click Sign In.

- [ ] **Step 3: Confirm simulator parity**

After the web validation passes, re-check the native simulator run (Task 11 Step 1): the drawer, switching, and Home standings behave the same on native (the Drawer and NativeTabs are native components; the web build exercises the same code paths for data + state, not native headers).

- [ ] **Step 4: Report**

Summarize what was validated and note any deviations from the spec (e.g. Seasons icon placeholder, last-5 form dots omitted).