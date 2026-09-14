# Mobile Push Notifications (iOS Only)

Push notifications for session started, match recorded, achievement unlocked, and streak reached. Delivered via Expo Push Service. No paid Apple Developer account required to build; real delivery waits on APNs credentials.

## Scope

- iOS only (Android later)
- 4 event types: session started, match recorded, achievement unlocked, streak reached
- Per-event user preferences (toggles) + master off switch
- Actor excluded for session/match events; included for achievements/streaks
- No credentials needed for build/test; real push delivery gated on APNs key

## Data Model

### New table: `push_token` (apps/worker/src/db/schema/)

| Column | Type | Notes |
|---|---|---|
| id | text PK (uuid) | |
| userId | text FK user | ON DELETE cascade |
| token | text UNIQUE | Expo push token |
| platform | text | "ios" only for now |
| deviceName | text? | Optional label |
| createdAt | integer | Audit |
| updatedAt | integer | Audit |
| lastSeenAt | integer | Bumped on each register call |

### Extend existing: `user_preference` (apps/worker/src/db/schema/)

| Column | Type | Default |
|---|---|---|
| pushEnabled | integer (boolean) | true |
| notifySessionStarted | integer (boolean) | true |
| notifyMatchRecorded | integer (boolean) | true |
| notifyAchievementUnlocked | integer (boolean) | true |
| notifyStreakReached | integer (boolean) | true |

## Worker API

New tRPC router `notification-router.ts`. All endpoints are `protectedProcedure` (user-scoped, not org-scoped).

| Procedure | Input | Notes |
|---|---|---|
| `registerToken` | `{ token: string, platform: "ios", deviceName?: string }` | Upsert by token; bind to user; bump lastSeenAt |
| `unregisterToken` | `{ token: string }` | Delete. Called on sign-out. |
| `getSettings` | none | Returns the 5 boolean preferences |
| `updateSettings` | `{ pushEnabled?, sessionStarted?, matchRecorded?, achievementUnlocked?, streakReached? }` | Partial update |

## Send Service

`services/push-notification.ts` — `sendLeaguePush(env, { organizationId, leagueSlug, seasonSlug, eventType, title, body, data, excludeUserId? })`

1. Query `member` table for `organizationId` → recipient userIds
2. Subtract `excludeUserId` if present
3. Join with `user_preference` where `pushEnabled = true` AND per-event toggle = true
4. Load `push_token` rows for those users
5. Batch POST (max 100 per request) to `https://exp.host/--/api/v2/push/send`
6. Prune tokens on `DeviceNotRegistered` receipt
7. No-op if no tokens found (graceful skip)

### Event Payloads

| Event | Title | Body | Deep link data |
|---|---|---|---|
| Session started | "Session started" | "{actor} started a session in {league}" | `{type: "session:start", leagueSlug, seasonSlug, sessionId}` |
| Match recorded | "Match recorded" | "{winner} beat {loser} {score}" | `{type: "match:recorded", leagueSlug, seasonSlug, matchId}` |
| Achievement unlock | "Achievement unlocked" | "{player} earned {achievement}" | `{type: "achievement:unlock", playerId}` |
| Streak reached | "Streak reached" | "{player} is on a {n}-win streak" | `{type: "streak", playerId}` |

## Event Hooks

All wrapped in `ctx.waitUntil(...)`:

| Location | Event type | Actor excluded |
|---|---|---|
| `session-router.ts` (create, line ~101) | `session:start` | yes |
| `match-router.ts` (recordResult, line ~142) | `match:insert` | yes |
| `index.ts` queue consumer (buildAchievementUnlockEvents) | `achievement:unlock` | no |
| `match-router.ts` (lines 48/62) | `streak` | no |
| `session-router.ts` (lines 350/361) | `streak` | no |

## Mobile

### Dependencies

- `expo-notifications` (install via `bunx expo install expo-notifications`)
- `expo-device` (platform detection)
- Add `expo-notifications` plugin to `app.json` plugins
- Add `extra.eas.projectId` (via `eas init`)

### `lib/notifications.ts`

- `registerForPushNotifications()`: request permissions → `getExpoPushTokenAsync({ projectId })` → call `notification.registerToken` → return token (null if denied)
- `unregisterPushNotifications()`: call `notification.unregisterToken` → clear local state
- `useNotificationObserver()`: listens for notification responses (warm) + `getLastNotificationResponseAsync()` (cold start) → routes via expo-router

### Deep Linking

`expo-notifications` response listener routes based on `data` fields:
- `session:start` → `/seasons/[seasonSlug]/session/[sessionId]`
- `match:recorded` → `/seasons/[seasonSlug]`
- `achievement:unlock` or `streak` → `/players/[playerId]`

All prefixed with league context if `leagueSlug` present.

### Settings

`app/settings/notifications.tsx` — 5 switches (master + 4 event types), wired to `getSettings`/`updateSettings` via TanStack Query. Reached from a new "Notifications" row on `profile.tsx`.

### Lifecycle

- Sign-in: `registerForPushNotifications()` in `_layout.tsx` (after auth state known)
- Sign-out: `unregisterPushNotifications()`
- Foreground: `Notifications.setNotificationHandler({ handleNotification: async () => ({shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false}) })`
- Android channel: not needed (iOS only)

### Android (deferred)

Same worker send path works; just needs `platform: "android"` tokens and FCM credentials. No code changes required later.

## Testing

### Worker

- Integration tests in `apps/worker/src/test/trpc/`:
  - `registerToken`: upserts correctly, binds to user
  - `unregisterToken`: deletes token
  - `getSettings`/`updateSettings`: reads/writes booleans
  - Recipient filtering: respects master toggle, per-event toggles, actor exclusion
  - Push batching: mock `globalThis.fetch`, verify payload structure, token pruning on DeviceNotRegistered

### Mobile (manual)

- Settings screen renders, switches persist
- Permission prompt shows on first install
- Token registration fires on sign-in
- Sign-out cleans up tokens
- Deep link routing works from `xcrun simctl push` payload

## Verification

```bash
bun db:generate && bun db:migrate
bun typecheck && bunx oxlint apps/worker/src apps/mobile/src
bun run test
```
