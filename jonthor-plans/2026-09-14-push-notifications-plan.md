# Push Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add iOS push notifications for session started, match recorded, achievement unlocked, and streak reached events via Expo Push Service.

**Architecture:** New `push_token` table + preference columns on `user_preference`. Worker stores tokens, resolves recipients per event, sends via Expo Push API. Mobile registers device, handles permission/settings, routes deep links.

**Tech Stack:** Drizzle (SQLite), tRPC, Expo Notifications, Expo Device, Expo SecureStore

---

## Task 1: DB Schema — push_token table + preference columns

**Files:**
- Modify: `apps/worker/src/db/schema/user-preferences-schema.ts`
- Modify: `apps/worker/src/db/schema/index.ts` (re-export if new file)

- [ ] **Step 1: Add push_token table and preference columns to user-preferences-schema.ts**

```typescript
// apps/worker/src/db/schema/user-preferences-schema.ts
import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";
import { user } from "./auth-schema";
import { timestampAuditFields } from "./common";

export const userPreference = sqliteTable("user_preference", {
	userId: text("user_id")
		.primaryKey()
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	defaultOrganizationId: text("default_organization_id"),
	lastActiveOrganizationId: text("last_active_organization_id"),
	pushEnabled: integer("push_enabled", { mode: "boolean" }).notNull().default(true),
	notifySessionStarted: integer("notify_session_started", { mode: "boolean" }).notNull().default(true),
	notifyMatchRecorded: integer("notify_match_recorded", { mode: "boolean" }).notNull().default(true),
	notifyAchievementUnlocked: integer("notify_achievement_unlocked", { mode: "boolean" }).notNull().default(true),
	notifyStreakReached: integer("notify_streak_reached", { mode: "boolean" }).notNull().default(true),
	...timestampAuditFields,
});

export const pushToken = sqliteTable(
	"push_token",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		token: text("token").notNull(),
		platform: text("platform").notNull().default("ios"),
		deviceName: text("device_name"),
		...timestampAuditFields,
		lastSeenAt: integer("last_seen_at", { mode: "timestamp" }),
	},
	(table) => [
		uniqueIndex("push_token_token_uidx").on(table.token),
		index("push_token_userId_idx").on(table.userId),
	]
);
```

- [ ] **Step 2: Generate and apply migration**

Run: `bun db:generate`
Expected: New migration file created with `push_token` table and `user_preference` columns.

Run: `bun db:migrate`
Expected: Migration applied locally.

- [ ] **Step 3: Commit**

```bash
git add apps/worker/src/db/schema/
git commit -m "feat(worker): add push_token table and notification preference columns"
```

---

## Task 2: Worker — notification router (register/unregister/settings)

**Files:**
- Create: `apps/worker/src/trpc/router/notification-router.ts`
- Modify: `apps/worker/src/trpc/trpc-router.ts` (register router)

- [ ] **Step 1: Create notification-router.ts**

```typescript
// apps/worker/src/trpc/router/notification-router.ts
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { pushToken, userPreference } from "../../db/schema";
import { protectedProcedure, createTRPCRouter } from "../trpc";

export const notificationRouter = createTRPCRouter({
	registerToken: protectedProcedure
		.input(
			z.object({
				token: z.string(),
				platform: z.enum(["ios", "android"]),
				deviceName: z.string().optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.authentication.user.id;
			const now = new Date();

			await ctx.db
				.insert(pushToken)
				.values({
					id: crypto.randomUUID(),
					userId,
					token: input.token,
					platform: input.platform,
					deviceName: input.deviceName ?? null,
					createdAt: now,
					updatedAt: now,
					lastSeenAt: now,
				})
				.onConflictDoUpdate({
					target: pushToken.token,
					set: {
						userId,
						platform: input.platform,
						deviceName: input.deviceName ?? null,
						updatedAt: now,
						lastSeenAt: now,
					},
				});

			return { success: true };
		}),

	unregisterToken: protectedProcedure
		.input(z.object({ token: z.string() }))
		.mutation(async ({ ctx, input }) => {
			await ctx.db
				.delete(pushToken)
				.where(
					and(
						eq(pushToken.token, input.token),
						eq(pushToken.userId, ctx.authentication.user.id)
					)
				);

			return { success: true };
		}),

	getSettings: protectedProcedure.query(async ({ ctx }) => {
		const [prefs] = await ctx.db
			.select({
				pushEnabled: userPreference.pushEnabled,
				notifySessionStarted: userPreference.notifySessionStarted,
				notifyMatchRecorded: userPreference.notifyMatchRecorded,
				notifyAchievementUnlocked: userPreference.notifyAchievementUnlocked,
				notifyStreakReached: userPreference.notifyStreakReached,
			})
			.from(userPreference)
			.where(eq(userPreference.userId, ctx.authentication.user.id))
			.limit(1);

		if (!prefs) {
			return {
				pushEnabled: true,
				notifySessionStarted: true,
				notifyMatchRecorded: true,
				notifyAchievementUnlocked: true,
				notifyStreakReached: true,
			};
		}

		return prefs;
	}),

	updateSettings: protectedProcedure
		.input(
			z.object({
				pushEnabled: z.boolean().optional(),
				notifySessionStarted: z.boolean().optional(),
				notifyMatchRecorded: z.boolean().optional(),
				notifyAchievementUnlocked: z.boolean().optional(),
				notifyStreakReached: z.boolean().optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.authentication.user.id;
			const now = new Date();

			await ctx.db
				.insert(userPreference)
				.values({
					userId,
					...input,
					createdAt: now,
					updatedAt: now,
				})
				.onConflictDoUpdate({
					target: userPreference.userId,
					set: { ...input, updatedAt: now },
				});

			return { success: true };
		}),
});
```

- [ ] **Step 2: Register in trpc-router.ts**

Add import and entry to `apps/worker/src/trpc/trpc-router.ts`:

```typescript
import { notificationRouter } from "./router/notification-router";
// ... existing imports ...

export const trpcRouter = createTRPCRouter({
	// ... existing routers ...
	notification: notificationRouter,
});
```

- [ ] **Step 3: Typecheck and lint**

Run: `bun typecheck && bunx oxlint apps/worker/src/trpc/router/notification-router.ts`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add apps/worker/src/trpc/router/notification-router.ts apps/worker/src/trpc/trpc-router.ts
git commit -m "feat(worker): add notification router (register/unregister/settings)"
```

---

## Task 3: Worker — push send service

**Files:**
- Create: `apps/worker/src/services/push-notification.ts`

- [ ] **Step 1: Create push-notification.ts**

```typescript
// apps/worker/src/services/push-notification.ts
import { eq, and, inArray } from "drizzle-orm";
import { pushToken, userPreference, member } from "../db/schema";
import type { DrizzleDB } from "../db";

type PushEvent = {
	type: string;
	title: string;
	body: string;
	data: Record<string, string>;
};

type SendLeaguePushArgs = {
	db: DrizzleDB;
	organizationId: string;
	excludeUserId?: string;
	events: PushEvent[];
};

export async function sendLeaguePush({
	db,
	organizationId,
	excludeUserId,
	events,
}: SendLeaguePushArgs): Promise<void> {
	if (events.length === 0) return;

	// 1. Get all member userIds for this league
	const members = await db
		.select({ userId: member.userId })
		.from(member)
		.where(eq(member.organizationId, organizationId));

	let recipientIds = members.map((m) => m.userId);

	// 2. Exclude actor if specified
	if (excludeUserId) {
		recipientIds = recipientIds.filter((id) => id !== excludeUserId);
	}

	if (recipientIds.length === 0) return;

	// 3. Filter to users with push enabled + per-event preferences
	const prefs = await db
		.select({
			userId: userPreference.userId,
			pushEnabled: userPreference.pushEnabled,
			notifySessionStarted: userPreference.notifySessionStarted,
			notifyMatchRecorded: userPreference.notifyMatchRecorded,
			notifyAchievementUnlocked: userPreference.notifyAchievementUnlocked,
			notifyStreakReached: userPreference.notifyStreakReached,
		})
		.from(userPreference)
		.where(inArray(userPreference.userId, recipientIds));

	const prefsMap = new Map(prefs.map((p) => [p.userId, p]));

	const eligibleUserIds = recipientIds.filter((userId) => {
		const p = prefsMap.get(userId);
		if (!p || !p.pushEnabled) return false;
		return events.some((e) => {
			if (e.type === "session:start") return p.notifySessionStarted;
			if (e.type === "match:recorded") return p.notifyMatchRecorded;
			if (e.type === "achievement:unlock") return p.notifyAchievementUnlocked;
			if (e.type === "streak") return p.notifyStreakReached;
			return false;
		});
	});

	if (eligibleUserIds.length === 0) return;

	// 4. Get push tokens for eligible users
	const tokens = await db
		.select({ token: pushToken.token, userId: pushToken.userId })
		.from(pushToken)
		.where(inArray(pushToken.userId, eligibleUserIds));

	if (tokens.length === 0) return;

	// 5. Build Expo Push messages — each user gets one message per event they're eligible for
	const messages: Array<{
		to: string;
		title: string;
		body: string;
		data: Record<string, string>;
		sound: string;
	}> = [];

	for (const event of events) {
		for (const t of tokens) {
			const p = prefsMap.get(t.userId);
			if (!p) continue;

			const eligible =
				(event.type === "session:start" && p.notifySessionStarted) ||
				(event.type === "match:recorded" && p.notifyMatchRecorded) ||
				(event.type === "achievement:unlock" && p.notifyAchievementUnlocked) ||
				(event.type === "streak" && p.notifyStreakReached);

			if (!eligible) continue;

			messages.push({
				to: t.token,
				title: event.title,
				body: event.body,
				data: event.data,
				sound: "default",
			});
		}
	}

	// 6. Send in batches of 100
	const BATCH_SIZE = 100;
	for (let i = 0; i < messages.length; i += BATCH_SIZE) {
		const batch = messages.slice(i, i + BATCH_SIZE);
		try {
			const res = await fetch("https://exp.host/--/api/v2/push/send", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(batch),
			});

			if (!res.ok) {
				console.error("[Push] Expo API error:", res.status, await res.text());
				continue;
			}

			const result = (await res.json()) as {
				data?: Array<{ status: string; message?: string; details?: { error?: string } }>;
			};

			// 7. Prune tokens marked DeviceNotRegistered
			if (result.data) {
				const tokensToDelete: string[] = [];
				for (let j = 0; j < result.data.length; j++) {
					const r = result.data[j];
					if (r.status === "error" && r.details?.error === "DeviceNotRegistered") {
						tokensToDelete.push(batch[j].to);
					}
				}
				if (tokensToDelete.length > 0) {
					await db
						.delete(pushToken)
						.where(inArray(pushToken.token, tokensToDelete));
				}
			}
		} catch (err) {
			console.error("[Push] Failed to send batch:", err);
		}
	}
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `bun typecheck && bunx oxlint apps/worker/src/services/push-notification.ts`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/worker/src/services/push-notification.ts
git commit -m "feat(worker): add push notification send service"
```

---

## Task 4: Worker — hook push into event call sites

**Files:**
- Modify: `apps/worker/src/trpc/router/session-router.ts` (session started, streak)
- Modify: `apps/worker/src/trpc/router/match-router.ts` (match recorded, streak)
- Modify: `apps/worker/src/index.ts` (achievement unlock)

- [ ] **Step 1: Add push to session-router.ts (session started + streak)**

Add import at top:
```typescript
import { sendLeaguePush } from "../../services/push-notification";
```

After the existing `ctx.waitUntil(broadcastSeasonEvent(...))` for `session:start` (around line 101), add:
```typescript
ctx.waitUntil(
	sendLeaguePush({
		db: ctx.db,
		organizationId: ctx.organization.id,
		excludeUserId: ctx.authentication.user.id,
		events: [
			{
				type: "session:start",
				title: "Session started",
				body: `${ctx.authentication.user.name} started a session in ${ctx.organization.name}`,
				data: {
					type: "session:start",
					leagueSlug: ctx.organization.slug,
					seasonSlug: input.seasonSlug,
					sessionId: session.id,
				},
			},
		],
	})
);
```

After streak broadcasts (around lines 350/361), add push for each streak event. The streak events already broadcast with `user: { id, name }`. Add:
```typescript
ctx.waitUntil(
	sendLeaguePush({
		db: ctx.db,
		organizationId: ctx.organization.id,
		events: [
			{
				type: "streak",
				title: "Streak reached",
				body: `${streakData.player.name} is on a ${streakData.streak}-win streak`,
				data: {
					type: "streak",
					leagueSlug: ctx.organization.slug,
					seasonSlug: sessionInfo.seasonSlug,
					playerId: streakData.player.id,
				},
			},
		],
	})
);
```

- [ ] **Step 2: Add push to match-router.ts (match recorded + streak)**

Add import at top:
```typescript
import { sendLeaguePush } from "../../services/push-notification";
```

After the existing `ctx.waitUntil(broadcastSeasonEvent(...))` for `match:insert` (around line 142), add:
```typescript
ctx.waitUntil(
	sendLeaguePush({
		db: ctx.db,
		organizationId: ctx.organization.id,
		excludeUserId: ctx.authentication.user.id,
		events: [
			{
				type: "match:recorded",
				title: "Match recorded",
				body: `${data.winner.name} beat ${data.loser.name} ${data.winnerScore}-${data.loserScore}`,
				data: {
					type: "match:recorded",
					leagueSlug: ctx.organization.slug,
					seasonSlug,
					matchId: data.id,
				},
			},
		],
	})
);
```

After streak broadcasts (around lines 48/62), add push for each streak event.

- [ ] **Step 3: Add push to index.ts queue consumer (achievement unlock)**

Add import at top:
```typescript
import { sendLeaguePush } from "./services/push-notification";
```

In the queue handler, after `broadcastSeasonEvent` calls inside the achievement branch, add:
```typescript
// Resolve leagueId from leagueSlug for push
const [org] = await db
	.select({ id: organization.id })
	.from(organization)
	.where(eq(organization.slug, body.leagueSlug))
	.limit(1);

if (org) {
	for (const event of buildAchievementUnlockEvents(newAchievements)) {
		await sendLeaguePush({
			db,
			organizationId: org.id,
			events: [
				{
					type: event.type,
					title: "Achievement unlocked",
					body: `${event.data.player.name} earned ${event.data.type.replace(/_/g, " ")}`,
					data: {
						type: event.type,
						playerId: event.data.player.id,
						leagueSlug: body.leagueSlug,
						seasonSlug: body.seasonSlug,
					},
				},
			],
		});
	}
}
```

- [ ] **Step 4: Typecheck and lint**

Run: `bun typecheck && bunx oxlint apps/worker/src`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add apps/worker/src/trpc/router/session-router.ts apps/worker/src/trpc/router/match-router.ts apps/worker/src/index.ts
git commit -m "feat(worker): hook push notifications into session/match/achievement events"
```

---

## Task 5: Worker — tests

**Files:**
- Create: `apps/worker/src/test/trpc/notification-router.spec.ts`

- [ ] **Step 1: Create notification-router.spec.ts**

```typescript
// apps/worker/src/test/trpc/notification-router.spec.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAuthContext, type AuthContext } from "../setup/auth-context-util";
import { createTRPCTestClient } from "./trpc-test-client";

describe("notification router", () => {
	let ctx: AuthContext;

	beforeEach(async () => {
		ctx = await createAuthContext();
	});

	describe("registerToken", () => {
		it("registers a push token", async () => {
			const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });
			const result = await client.notification.registerToken.mutate({
				token: "ExponentPushToken[test123]",
				platform: "ios",
			});
			expect(result.success).toBe(true);
		});

		it("upserts duplicate token", async () => {
			const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });
			await client.notification.registerToken.mutate({
				token: "ExponentPushToken[dup]",
				platform: "ios",
			});
			const result = await client.notification.registerToken.mutate({
				token: "ExponentPushToken[dup]",
				platform: "ios",
			});
			expect(result.success).toBe(true);
		});
	});

	describe("unregisterToken", () => {
		it("removes a token", async () => {
			const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });
			await client.notification.registerToken.mutate({
				token: "ExponentPushToken[removable]",
				platform: "ios",
			});
			const result = await client.notification.unregisterToken.mutate({
				token: "ExponentPushToken[removable]",
			});
			expect(result.success).toBe(true);
		});
	});

	describe("getSettings", () => {
		it("returns default settings for new user", async () => {
			const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });
			const settings = await client.notification.getSettings.query();
			expect(settings.pushEnabled).toBe(true);
			expect(settings.notifySessionStarted).toBe(true);
			expect(settings.notifyMatchRecorded).toBe(true);
			expect(settings.notifyAchievementUnlocked).toBe(true);
			expect(settings.notifyStreakReached).toBe(true);
		});
	});

	describe("updateSettings", () => {
		it("updates individual settings", async () => {
			const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });
			await client.notification.updateSettings.mutate({
				notifySessionStarted: false,
			});
			const settings = await client.notification.getSettings.query();
			expect(settings.notifySessionStarted).toBe(false);
			expect(settings.notifyMatchRecorded).toBe(true);
		});
	});
});
```

- [ ] **Step 2: Run tests**

Run: `bun run test -- --filter notification`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add apps/worker/src/test/trpc/notification-router.spec.ts
git commit -m "test(worker): add notification router tests"
```

---

## Task 6: Mobile — install expo-notifications + setup

**Files:**
- Modify: `apps/mobile/package.json` (install)
- Modify: `apps/mobile/app.json` (add plugin)
- Create: `apps/mobile/src/lib/notifications.ts`

- [ ] **Step 1: Install dependencies**

Run: `cd apps/mobile && bunx expo install expo-notifications expo-device`
Expected: Packages added to package.json.

- [ ] **Step 2: Add plugin to app.json**

Add to `expo.plugins` array in `apps/mobile/app.json`:
```json
"expo-notifications"
```

- [ ] **Step 3: Create notifications.ts**

```typescript
// apps/mobile/src/lib/notifications.ts
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { trpcClient } from "./trpc";

Notifications.setNotificationHandler({
	handleNotification: async () => ({
		shouldShowAlert: true,
		shouldPlaySound: true,
		shouldSetBadge: false,
	}),
});

export async function registerForPushNotifications(): Promise<string | null> {
	if (!Device.isDevice) {
		console.log("[Push] Must use physical device for push notifications");
		return null;
	}

	const { status: existingStatus } = await Notifications.getPermissionsAsync();
	let finalStatus = existingStatus;

	if (existingStatus !== "granted") {
		const { status } = await Notifications.requestPermissionsAsync();
		finalStatus = status;
	}

	if (finalStatus !== "granted") {
		console.log("[Push] Permission not granted");
		return null;
	}

	if (Platform.OS === "ios") {
		const { data: token } = await Notifications.getExpoPushTokenAsync();
		await trpcClient.notification.registerToken.mutate({
			token,
			platform: "ios",
		});
		return token;
	}

	return null;
}

export async function unregisterPushNotifications(): Promise<void> {
	if (Platform.OS !== "ios") return;

	try {
		const { data: token } = await Notifications.getExpoPushTokenAsync();
		await trpcClient.notification.unregisterToken.mutate({ token });
	} catch {
		// Token may not exist — ignore
	}
}

export function useNotificationObserver(
	onResponse: (response: Notifications.NotificationResponse) => void
) {
	Notifications.addNotificationResponseReceivedListener(onResponse);
}
```

- [ ] **Step 4: Typecheck and lint**

Run: `bun typecheck && bunx oxlint apps/mobile/src/lib/notifications.ts`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/package.json apps/mobile/app.json apps/mobile/src/lib/notifications.ts
git commit -m "feat(mobile): add push notification registration and handler"
```

---

## Task 7: Mobile — notification lifecycle in root layout

**Files:**
- Modify: `apps/mobile/src/app/_layout.tsx`

- [ ] **Step 1: Add notification init to _layout.tsx**

Add import:
```typescript
import { useEffect } from "react";
import {
	registerForPushNotifications,
	unregisterPushNotifications,
	useNotificationObserver,
} from "@/lib/notifications";
```

Add hooks inside `RootLayout` component, after `useProtectedRoute`:
```typescript
useEffect(() => {
	if (session) {
		registerForPushNotifications();
	}
	return () => {
		unregisterPushNotifications();
	};
}, [session]);

useNotificationObserver((response) => {
	// Deep link routing handled in Task 9
});
```

- [ ] **Step 2: Typecheck and lint**

Run: `bun typecheck && bunx oxlint apps/mobile/src/app/_layout.tsx`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/app/_layout.tsx
git commit -m "feat(mobile): register push token on sign-in, unregister on sign-out"
```

---

## Task 8: Mobile — notification settings screen

**Files:**
- Create: `apps/mobile/src/app/settings/notifications.tsx`
- Modify: `apps/mobile/src/app/profile.tsx` (add settings row)

- [ ] **Step 1: Create notifications settings screen**

```typescript
// apps/mobile/src/app/settings/notifications.tsx
import { View, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function NotificationSettingsScreen() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const router = useRouter();

	const { data: settings } = useQuery(
		trpc.notification.getSettings.queryOptions()
	);

	const updateMutation = useMutation(
		trpc.notification.updateSettings.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries(
					trpc.notification.getSettings.queryOptions()
				);
			},
		})
	);

	if (!settings) return null;

	const toggles = [
		{
			key: "pushEnabled" as const,
			label: "Push notifications",
			description: "Master switch for all push notifications",
		},
		{
			key: "notifySessionStarted" as const,
			label: "Session started",
			description: "When someone starts a session in your league",
		},
		{
			key: "notifyMatchRecorded" as const,
			label: "Match recorded",
			description: "When a match result is recorded",
		},
		{
			key: "notifyAchievementUnlocked" as const,
			label: "Achievement unlocked",
			description: "When you or a league member earns an achievement",
		},
		{
			key: "notifyStreakReached" as const,
			label: "Streak reached",
			description: "When you or a league member hits a win streak",
		},
	];

	return (
		<ScrollView style={{ flex: 1, padding: 16 }}>
			<ThemedText type="title">Notifications</ThemedText>

			{toggles.map((toggle) => (
				<Card key={toggle.key}>
					<CardContent>
						<View
							style={{
								flexDirection: "row",
								justifyContent: "space-between",
								alignItems: "center",
							}}
						>
							<View style={{ flex: 1, marginRight: 12 }}>
								<ThemedText type="defaultSemiBold">
									{toggle.label}
								</ThemedText>
								<ThemedText type="small">{toggle.description}</ThemedText>
							</View>
							<Switch
								checked={settings[toggle.key]}
								onCheckedChange={(checked) =>
									updateMutation.mutate({ [toggle.key]: checked })
								}
							/>
						</View>
					</CardContent>
				</Card>
			))}
		</ScrollView>
	);
}
```

- [ ] **Step 2: Add Notifications row to profile.tsx**

Add a new Card section between the Sessions card and the Sign Out button:
```tsx
<Card>
	<CardHeader>
		<CardTitle>Notifications</CardTitle>
	</CardHeader>
	<CardContent>
		<Button
			variant="outline"
			fullWidth
			onPress={() => router.push("/settings/notifications")}
		>
			Configure Notifications
		</Button>
	</CardContent>
</Card>
```

- [ ] **Step 3: Typecheck and lint**

Run: `bun typecheck && bunx oxlint apps/mobile/src/app/settings/notifications.tsx apps/mobile/src/app/profile.tsx`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/app/settings/notifications.tsx apps/mobile/src/app/profile.tsx
git commit -m "feat(mobile): add notification settings screen accessible from profile"
```

---

## Task 9: Mobile — deep link routing from notifications

**Files:**
- Modify: `apps/mobile/src/lib/notifications.ts` (add routing)

- [ ] **Step 1: Add deep link routing to notifications.ts**

Replace the `useNotificationObserver` hook and add a `handleNotificationResponse` function:
```typescript
import { useRouter } from "expo-router";

export function handleNotificationResponse(
	response: Notifications.NotificationResponse,
	router: ReturnType<typeof useRouter>
) {
	const data = response.notification.request.content.data as Record<
		string,
		string
	>;

	if (!data?.type) return;

	switch (data.type) {
		case "session:start":
			if (data.leagueSlug && data.seasonSlug && data.sessionId) {
				router.push(
					`/seasons/${data.seasonSlug}/session/${data.sessionId}`
				);
			}
			break;
		case "match:recorded":
			if (data.leagueSlug && data.seasonSlug) {
				router.push(`/seasons/${data.seasonSlug}`);
			}
			break;
		case "achievement:unlock":
		case "streak":
			if (data.playerId) {
				router.push(`/players/${data.playerId}`);
			}
			break;
	}
}

export function useNotificationObserver(
	onResponse: (response: Notifications.NotificationResponse) => void
) {
	Notifications.addNotificationResponseReceivedListener(onResponse);

	// Handle cold start
	Notifications.getLastNotificationResponseAsync().then((response) => {
		if (response) {
			onResponse(response);
		}
	});
}
```

- [ ] **Step 2: Update _layout.tsx to use router**

Update the notification observer in `_layout.tsx`:
```typescript
const router = useRouter();

useNotificationObserver((response) => {
	handleNotificationResponse(response, router);
});
```

- [ ] **Step 3: Typecheck and lint**

Run: `bun typecheck && bunx oxlint apps/mobile/src/lib/notifications.ts apps/mobile/src/app/_layout.tsx`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/lib/notifications.ts apps/mobile/src/app/_layout.tsx
git commit -m "feat(mobile): route deep links from push notifications"
```

---

## Task 10: Verification

- [ ] **Step 1: Run full verification**

```bash
bun db:generate
bun db:migrate
bun typecheck
bunx oxlint apps/worker/src apps/mobile/src
bun run test
```

Expected: All pass.

- [ ] **Step 2: Manual verification on simulator**

1. Start dev server: `bun dev`
2. Start Metro: `cd apps/mobile && bun start`
3. Sign in on simulator
4. Verify: no crash, token registration fires (check console logs)
5. Navigate to Profile → Configure Notifications → verify toggles render
6. Toggle a setting → verify it persists (navigate away and back)

- [ ] **Step 3: Test notification payload via simulator**

Create a test .apns file and push to simulator:
```bash
xcrun simctl push C2AEE1C2-9703-436A-8329-1BA8A2A6D08D com.scorebrawl test-notification.apns
```

Verify: notification appears, tapping routes correctly.

- [ ] **Step 4: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: address verification findings"
```

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | DB schema | `user-preferences-schema.ts` |
| 2 | Notification router | `notification-router.ts`, `trpc-router.ts` |
| 3 | Push send service | `push-notification.ts` |
| 4 | Event hooks | `session-router.ts`, `match-router.ts`, `index.ts` |
| 5 | Worker tests | `notification-router.spec.ts` |
| 6 | Mobile setup | `package.json`, `app.json`, `notifications.ts` |
| 7 | Lifecycle | `_layout.tsx` |
| 8 | Settings screen | `settings/notifications.tsx`, `profile.tsx` |
| 9 | Deep linking | `notifications.ts`, `_layout.tsx` |
| 10 | Verification | All |
