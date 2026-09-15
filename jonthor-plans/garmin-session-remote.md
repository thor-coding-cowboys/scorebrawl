# Garmin Session Remote Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Garmin Connect IQ watch app that acts as a remote control for active Scorebrawl sessions, plus the backend device API endpoints to support it.

**Architecture:** New REST endpoints in the existing device router (`/api/device/`) with API key auth. Garmin app written in Monkey C using Connect IQ SDK 4.0+. Watch polls session state and sends commands (start match, record result, resolve coin toss). Session creation/management stays on web -- watch is a remote control only.

**Tech Stack:** Hono (backend endpoints), Zod (validation), Drizzle (DB), Monkey C (Garmin app), Connect IQ SDK 4.0+

---

## Phase 1: Backend -- Device Session Endpoints ✅

### Task 1: GET /leagues/:leagueSlug/session/active ✅

**Files:**

- Modify: `apps/worker/src/routes/device-router.ts`

**What it does:** Returns the active session state for the league's active season. Reuses existing league/member verification pattern from the context endpoint.

**Query flow:**

1. Resolve league by slug, verify membership (same pattern as `/context`)
2. Find active season (same logic as `/context`)
3. Call `sessionRepository.getActiveSession({ db, seasonId })` to get raw session
4. If session exists, call `sessionRepository.getSessionById({ db, sessionId })` for full data with player names
5. Find current in-progress match (match with `result === null`)
6. Parse proposed lineup
7. Check pending coin tosses

**Response shape:**

```json
{
  "session": {
    "id": "gs_xxx",
    "seasonSlug": "spring-2026",
    "matchCount": 5,
    "teamSize": 1,
    "rotationMode": "winner-stays",
    "state": "proposed_lineup" | "match_in_progress" | "coin_toss_pending",
    "currentMatch": {
      "sessionMatchId": "sm_xxx",
      "matchNumber": 6,
      "home": [{ "sessionPlayerId": "sp_xxx", "name": "Jon" }],
      "away": [{ "sessionPlayerId": "sp_xxx", "name": "Bob" }],
      "homeScore": 0,
      "awayScore": 0
    } | null,
    "proposedLineup": {
      "home": [{ "sessionPlayerId": "sp_xxx", "name": "Jon" }],
      "away": [{ "sessionPlayerId": "sp_xxx", "name": "Alice" }]
    } | null,
    "pendingCoinToss": {
      "id": "ct_xxx",
      "conflictType": "loser-rotation",
      "candidates": [{ "sessionPlayerId": "sp_xxx", "name": "Bob" }]
    } | null,
    "queue": [{ "sessionPlayerId": "sp_xxx", "name": "Charlie" }]
  } | null
}
```

**Key detail:** `state` is derived:

- Has unresolved coin toss → `"coin_toss_pending"`
- Has match with `result === null` → `"match_in_progress"`
- Has `proposedLineup` → `"proposed_lineup"`

**Player name resolution:** `getSessionById` already joins through `sessionPlayer → seasonPlayer → player → user/guest` and provides `displayName`. Use that directly.

**Session player ID mapping:** The proposed lineup stores session player IDs (not season player IDs). The `getSessionById` response includes both `id` (sessionPlayerId) and `seasonPlayerId` for each player, so the device can work with either.

---

### Task 2: POST /leagues/:leagueSlug/session/start-match ✅

**Files:**

- Modify: `apps/worker/src/routes/device-router.ts`

**What it does:** Starts the next match using the proposed lineup. No request body required.

**Flow:**

1. Resolve league, verify membership
2. Find active season → get active session
3. Get full session via `getSessionById`
4. Read proposed lineup from session
5. Error if no proposed lineup or if a match is already in progress
6. Map session player IDs from proposed lineup to season player IDs using the session's player list
7. Use `selectedHomePlayerIds` / `selectedAwayPlayerIds` if present, else fall back to `homePlayerIds` / `awayPlayerIds`
8. Call `sessionRepository.startNextMatch({ db, sessionId, homeSeasonPlayerIds, awaySeasonPlayerIds })`
9. Broadcast SSE event
10. Return `{ success: true, matchNumber }`

**Season player ID resolution:** The proposed lineup uses session player IDs. `startNextMatch` expects season player IDs. Map via:

```typescript
const playerMap = new Map(fullSession.players.map((p) => [p.id, p.seasonPlayerId]));
const homeSeasonPlayerIds = lineupHomeIds.map((id) => playerMap.get(id));
```

---

### Task 3: POST /leagues/:leagueSlug/session/record-result ✅

**Files:**

- Modify: `apps/worker/src/routes/device-router.ts`

**Validation schema:**

```typescript
z.object({
	homeScore: z.number().int().min(0),
	awayScore: z.number().int().min(0),
});
```

**What it does:** Records the result for the current in-progress match. This is the most complex endpoint because it mirrors the tRPC `recordResult` orchestration.

**Flow (mirrors `session-router.ts:175-400`):**

1. Resolve league, verify membership
2. Find active season → get active session
3. Get full session via `getSessionById`
4. Find in-progress match (match with `result === null`). Error if none.
5. Determine result: `"home"` / `"away"` / `"draw"` from scores
6. Call `matchRepository.create()` -- creates permanent match with ELO calc
7. Send achievement queue message via `c.env.ACHIEVEMENT_QUEUE`
8. Call `sessionRepository.recordMatchResult()` -- updates session match, player stats
9. Map session/season player IDs for lineup computation
10. Call `computeNextLineup()` from `session-rotation.ts`
11. Handle coin toss:
    - If `autoCoinToss` on session: auto-resolve, re-compute lineup
    - If `autoCoinToss` off: create pending coin toss
12. Call `sessionRepository.updateProposedLineup()`
13. Broadcast SSE events (session update + streak checks)
14. Return the new session state (same shape as GET /session/active)

**Important:** This logic is ~100 lines duplicated from the tRPC router. Consider extracting into a shared service function in a future refactor. For now, keep it in the device router to avoid touching the tRPC router (less risk).

**Streak checks:** Call `matchRepository.checkStreakThresholds()` and `matchRepository.checkTeamStreakThresholds()` same as the tRPC router, then broadcast streak events.

---

### Task 4: POST /leagues/:leagueSlug/session/resolve-coin-toss ✅

**Files:**

- Modify: `apps/worker/src/routes/device-router.ts`

**Validation schema:**

```typescript
z.object({
	coinTossId: z.string(),
	winnerIds: z.array(z.string()).min(1), // session player IDs
});
```

**Flow (mirrors `session-router.ts:402-484`):**

1. Resolve league, verify membership
2. Look up coin toss by ID, verify it belongs to this league's session
3. Call `sessionRepository.resolveCoinToss()` with the winner IDs
4. Get full session via `getSessionById`
5. Find triggering match, re-compute lineup with resolved winners
6. Call `sessionRepository.updateProposedLineup()`
7. Broadcast SSE event
8. Return the new session state

---

### Task 5: Helper -- Extract league + session resolution ✅

**Files:**

- Modify: `apps/worker/src/routes/device-router.ts`

Before implementing Tasks 1-4, extract shared helper functions at the top of the device router:

```typescript
async function resolveLeagueAndVerifyMembership(c: Context) {
	// Returns { leagueData, seasonData } or throws appropriate HTTP error
	// Reuses the pattern from existing endpoints
}

async function getActiveSessionForLeague(db, leagueSlug, userId) {
	// Combines: resolve league → verify membership → find active season → get active session
	// Returns { session, seasonSlug, seasonId, leagueSlug } or null
}
```

This deduplicates the league/membership/season resolution across all 4 new endpoints + existing endpoints.

---

### Task 6: Backend integration tests ✅

**Files:**

- Create: `apps/worker/src/test/trpc/device-session.test.ts` (or wherever device tests live)

**Reference:** Look at existing test patterns in `apps/worker/src/test/` for `createTRPCTestClient` usage and test helpers.

**Test cases:**

1. `GET /session/active` -- no active session returns `{ session: null }`
2. `GET /session/active` -- returns session with proposed lineup
3. `GET /session/active` -- returns session with match in progress
4. `POST /session/start-match` -- starts match from proposed lineup
5. `POST /session/start-match` -- errors when no proposed lineup
6. `POST /session/start-match` -- errors when match already in progress
7. `POST /session/record-result` -- records result, returns new state with proposed lineup
8. `POST /session/record-result` -- errors when no match in progress
9. `POST /session/resolve-coin-toss` -- resolves toss and computes new lineup
10. Auth: all endpoints return 401 without API key, 403 for non-member

**Test setup:** Need to create a session via tRPC first (or via direct DB inserts), then test the device endpoints against it. The device endpoints use `fetch` directly against the Hono app, not tRPC.

---

## Phase 2: Garmin Connect IQ App ✅

### Task 7: Project scaffolding ✅

**Files:**

- Create: `apps/garmin/manifest.xml`
- Create: `apps/garmin/monkey.jungle`
- Create: `apps/garmin/resources/strings/strings.xml`
- Create: `apps/garmin/resources/settings/settings.xml`
- Create: `apps/garmin/resources/settings/properties.xml`
- Create: `apps/garmin/resources/drawables/drawables.xml`
- Create: `apps/garmin/resources/drawables/launcher_icon.png` (placeholder)

**manifest.xml key config:**

```xml
<iq:manifest xmlns:iq="http://www.garmin.com/xml/connectiq" version="3">
    <iq:application entry="ScoreBrawlApp"
        id="scorebrawl-garmin-remote"
        launcherIcon="@Drawables.LauncherIcon"
        minSdkVersion="4.0.0"
        name="@Strings.AppName"
        type="watch-app">
        <iq:permissions>
            <iq:uses-permission id="Communications"/>
        </iq:permissions>
        <iq:products>
            <!-- Venu series -->
            <iq:product id="venu2"/>
            <iq:product id="venu2plus"/>
            <iq:product id="venu2s"/>
            <iq:product id="venu3"/>
            <iq:product id="venu3s"/>
            <!-- Fenix series -->
            <iq:product id="fenix7"/>
            <iq:product id="fenix7s"/>
            <iq:product id="fenix7x"/>
            <iq:product id="fenix7pro"/>
            <iq:product id="fenix7spro"/>
            <iq:product id="fenix7xpro"/>
            <iq:product id="fenix8"/>
            <!-- Forerunner series -->
            <iq:product id="fr265"/>
            <iq:product id="fr265s"/>
            <iq:product id="fr955"/>
            <iq:product id="fr965"/>
        </iq:products>
    </iq:application>
</iq:manifest>
```

**NOTE:** Verify exact product IDs against https://developer.garmin.com/connect-iq/compatible-devices/ before finalizing. The IDs above are approximate.

**settings.xml** (user configures in Garmin Connect Mobile app):

```xml
<settings>
    <setting propertyKey="@Properties.apiKey" title="@Strings.ApiKeyTitle">
        <settingConfig type="alphaNumeric"/>
    </setting>
    <setting propertyKey="@Properties.serverUrl" title="@Strings.ServerUrlTitle">
        <settingConfig type="alphaNumeric"/>
    </setting>
</settings>
```

**properties.xml:**

```xml
<properties>
    <property id="apiKey" type="string"></property>
    <property id="serverUrl" type="string">https://scorebrawl.com</property>
</properties>
```

**monkey.jungle:**

```
project.manifest = manifest.xml
```

---

### Task 8: API client module ✅

**Files:**

- Create: `apps/garmin/source/ApiClient.mc`

**Responsibilities:**

- Read `apiKey` and `serverUrl` from app properties
- Provide `get(path, callback)` and `post(path, body, callback)` methods
- Set `x-api-key` header on all requests
- Handle JSON response parsing
- Handle error states (no phone connected, HTTP errors, auth failures)

**Monkey C implementation:**

```monkeyc
using Toybox.Communications;
using Toybox.Application.Properties;

class ApiClient {
    static function getBaseUrl() {
        var url = Properties.getValue("serverUrl");
        if (url == null || url.equals("")) {
            return "https://scorebrawl.com";
        }
        return url;
    }

    static function getApiKey() {
        return Properties.getValue("apiKey");
    }

    static function get(path as String, callback as Method) as Void {
        var url = getBaseUrl() + "/api/device" + path;
        var options = {
            :method => Communications.HTTP_REQUEST_METHOD_GET,
            :headers => {
                "x-api-key" => getApiKey()
            },
            :responseType => Communications.HTTP_RESPONSE_CONTENT_TYPE_JSON
        };
        Communications.makeWebRequest(url, null, options, callback);
    }

    static function post(path as String, body as Dictionary, callback as Method) as Void {
        var url = getBaseUrl() + "/api/device" + path;
        var options = {
            :method => Communications.HTTP_REQUEST_METHOD_POST,
            :headers => {
                "Content-Type" => "application/json",
                "x-api-key" => getApiKey()
            },
            :responseType => Communications.HTTP_RESPONSE_CONTENT_TYPE_JSON
        };
        Communications.makeWebRequest(url, body, options, callback);
    }
}
```

**Error handling pattern:**

```monkeyc
// Callback signature: method(responseCode as Number, data as Dictionary or String or Null)
// responseCode: HTTP status or negative = BLE error
// -104 = BLE_CONNECTION_UNAVAILABLE (phone not connected)
// -300 = NETWORK_REQUEST_TIMED_OUT
// 401 = invalid API key
// 200 = success
```

---

### Task 9: App entry point ✅

**Files:**

- Create: `apps/garmin/source/ScoreBrawlApp.mc`

**Monkey C:**

```monkeyc
using Toybox.Application;
using Toybox.WatchUi;

class ScoreBrawlApp extends Application.AppBase {
    function initialize() {
        AppBase.initialize();
    }

    function getInitialView() as [Views] or [Views, InputDelegates] {
        // Check if API key is configured
        var apiKey = ApiClient.getApiKey();
        if (apiKey == null || apiKey.equals("")) {
            return [new ErrorView("Set API key in\nGarmin Connect")];
        }
        return [new LeaguePickerView(), new LeaguePickerDelegate()];
    }
}
```

---

### Task 10: League picker view ✅

**Files:**

- Create: `apps/garmin/source/LeaguePickerView.mc`
- Create: `apps/garmin/source/LeaguePickerDelegate.mc`

**UX:** On load, fetches `GET /leagues`. Shows a `Menu2` with league names. User selects one → pushes `SessionView`.

**Flow:**

1. `onShow()` → call `ApiClient.get("/leagues", method(:onLeaguesResponse))`
2. Show loading indicator
3. On response → store leagues array, build `Menu2`
4. On menu item select → push `SessionView` with selected league slug

**Delegate:** Extends `Menu2InputDelegate`. On select, reads league slug from menu item and pushes session view.

**Error states:**

- No leagues: show "No leagues found"
- Network error: show "Connect phone" or "Check API key"

---

### Task 11: Session dashboard view ✅

**Files:**

- Create: `apps/garmin/source/SessionView.mc`
- Create: `apps/garmin/source/SessionDelegate.mc`

**This is the main view.** It polls `GET /leagues/:slug/session/active` every 10 seconds.

**Constructor:** Takes `leagueSlug` as parameter.

**State machine rendering:**

```
state == null         → "No active session" (center text)
state == "proposed_lineup"  → Show match #N, Home vs Away names, [SELECT] = "Start Match"
state == "match_in_progress" → Show match #N, Home vs Away + score, [SELECT] = "Enter Score"
state == "coin_toss_pending" → Show "Coin Toss", candidates, [SELECT] = "Pick Winner"
```

**Layout (proposed_lineup example on 240x240):**

```
┌──────────────────┐
│    Match #6       │  ← centered, bold
│                   │
│    Jon            │  ← home (left aligned)
│      vs           │  ← centered
│    Alice          │  ← away (left aligned)
│                   │
│  [Start Match]    │  ← bottom prompt
└──────────────────┘
```

**Layout (match_in_progress):**

```
┌──────────────────┐
│    Match #6       │
│                   │
│  Jon        2     │  ← home name + score
│      vs           │
│  Alice      1     │  ← away name + score
│                   │
│  [Enter Score]    │
└──────────────────┘
```

**Polling:** Use `Timer.Timer` with 10-second repeat. On each tick, re-fetch session state. Call `WatchUi.requestUpdate()` to trigger `onUpdate()` redraw.

**Delegate actions:**

- `SELECT` button (or tap on touch devices):
  - `proposed_lineup` → call `POST /session/start-match`, show brief "Starting..." then refresh
  - `match_in_progress` → push `ScoreEntryView` with current match data
  - `coin_toss_pending` → push `CoinTossView` with candidates
- `BACK` button → pop back to league picker

**2v2+ teams:** When `teamSize > 1`, show multiple names per side:

```
Jon, Bob
   vs
Alice, Charlie
```

---

### Task 12: Score entry view ✅

**Files:**

- Create: `apps/garmin/source/ScoreEntryView.mc`
- Create: `apps/garmin/source/ScoreEntryDelegate.mc`

**Constructor:** Takes `leagueSlug`, `homeNames` (array), `awayNames` (array).

**UX:** Two score values, active cursor toggles between them.

**Layout:**

```
┌──────────────────┐
│   Record Score    │
│                   │
│  Jon         [3]  │  ← home, score highlighted when active
│  Alice        1   │  ← away, score dimmed when not active
│                   │
│  UP/DOWN = +/-    │
│  SELECT = confirm │
└──────────────────┘
```

**Input (button-based, Fenix):**

- `UP` → increment active score
- `DOWN` → decrement active score (min 0)
- `SELECT` → if on home score, move to away score. If on away score, submit.
- `BACK` → cancel, pop view

**Input (touch-based, Venu):**

- Tap score number to select it
- Swipe up/down to change value
- Tap confirm button to submit

**On submit:**

1. Show "Recording..." text
2. Call `POST /session/record-result` with `{ homeScore, awayScore }`
3. On success → pop view (returns to SessionView which will auto-refresh)
4. On error → show error briefly, stay on view

**Confirmation step:** Before submitting, briefly show "Home 3 - 1 Away?" with confirm/cancel. This prevents accidental submissions on the tiny screen.

---

### Task 13: Coin toss view ✅

**Files:**

- Create: `apps/garmin/source/CoinTossView.mc`
- Create: `apps/garmin/source/CoinTossDelegate.mc`

**Constructor:** Takes `leagueSlug`, `coinTossId`, `candidates` (array of `{ sessionPlayerId, name }`), `conflictType`.

**UX:** Show a `Menu2` with candidate names. User selects the winner(s).

**For single-winner tosses** (most common -- `loser-rotation`, `max-consecutive-exceeded`):

- Menu with candidate names
- Select one → immediately submit

**For draw-tiebreak** (needs one team to win):

- Show "Who stays?" header
- Two menu items: "Home" and "Away" (with player names)
- Select one → submit that team's session player IDs as winners

**On submit:**

1. Call `POST /session/resolve-coin-toss` with `{ coinTossId, winnerIds }`
2. On success → pop view (returns to SessionView)
3. On error → show error

---

### Task 14: Error/loading view ✅

**Files:**

- Create: `apps/garmin/source/ErrorView.mc`

**Simple view** that shows a centered text message. Used for:

- "Set API key in Garmin Connect" (no API key configured)
- "Connect phone" (BLE error)
- "No active session"
- Loading states ("Loading...")

No delegate needed -- just shows text. Back button pops the view.

---

## Phase 3: Verification ✅

### Task 15: Backend verification ✅

**Steps:**

1. `bun oxc` -- lint/format ✅
2. `bun typecheck` -- type check ✅
3. `bun run test` -- 17 test files, 177 tests passed ✅
4. Manual test: curl the device endpoints with an API key

### Task 16: Garmin app build verification ✅

**Steps:**

1. Install Connect IQ SDK ✅ — SDK 8.4.1 at `~/Library/Application Support/Garmin/ConnectIQ/Sdks/connectiq-sdk-mac-8.4.1-2026-02-03-e9f77eeaa/`
2. Build the app ✅ — `monkeyc` build successful for venu2 (2 non-blocking warnings: icon scaling, no language support)
3. Run in simulator ✅ — app sideloaded to venu2 simulator successfully
4. Test with real API (phone connected) — requires physical device
5. Verify product IDs in manifest.xml against device reference ✅ — fixed `fenix8` → size variants (`fenix843mm`, `fenix847mm`, etc.), added Venu 4, Fenix E, Epix 2, FR165/970

**Build fixes applied:**

- App ID changed to UUID format (`b91c7113-fa81-4b4f-9992-f7d9b8c338f8`)
- Developer signing key generated in DER format
- All source files updated with fully qualified Monkey C types (`Lang.String`, `Graphics.Dc`, etc.)
- `getInitialView()` return type fixed to match SDK signature: `[WatchUi.Views] or [WatchUi.Views, WatchUi.InputDelegates]`
- Removed dead code null checks on `WatchUi.getCurrentView()` (returns non-null tuple in SDK 8.4.1)
- `.gitignore` updated with Garmin build artifacts and developer keys

---

## Manual Next Steps

Everything below requires human action — either local SDK setup, device access, or deployment.

### 1. Create PR for the branch

Backend is implemented and tested (177 tests passing). Open a PR — Cloudflare will auto-deploy a preview URL. Use that preview URL (or `http://scorebrawl.localhost:1355` for local dev) as the `serverUrl` in the Garmin app settings during testing. No need to merge to main first.

Verify endpoints against preview:

```bash
curl -H "x-api-key: YOUR_KEY" https://PREVIEW_URL/api/device/leagues/YOUR_SLUG/session/active
```

### 2. Install Connect IQ SDK

Download from https://developer.garmin.com/connect-iq/sdk/

```bash
# After install, add to PATH
export PATH=$PATH:$HOME/Library/Application\ Support/Garmin/ConnectIQ/Sdks/connectiq-sdk-xxx/bin
```

Verify: `monkeyc --version`

### 3. Build the Garmin app

```bash
cd apps/garmin
monkeyc -f monkey.jungle -o build/ScoreBrawl.prg -d venu2
```

Fix any Monkey C compilation errors. The code was written without compiler validation — expect some syntax/API issues on first build.

### 4. Test in simulator

```bash
connectiq    # launches simulator
monkeydo build/ScoreBrawl.prg venu2
```

- Verify: API key error screen shows when no key configured
- Set API key in simulator settings
- Verify: league picker loads and lists leagues
- Verify: session view renders all 3 states (proposed lineup, match in progress, coin toss)
- Verify: score entry and coin toss flows work end-to-end

### 5. Replace placeholder launcher icon

Current icon is a blue 40x40 PNG placeholder. Replace `apps/garmin/resources/drawables/launcher_icon.png` with a proper Scorebrawl icon. Garmin requires 40x40 for most devices.

### 6. Test on physical device

Sideload via Garmin Connect Mobile:

1. Copy `.prg` file to phone
2. Open in Garmin Connect app → sideload to watch
3. Test with real session — start match, record score, resolve coin toss from watch
4. Test error cases: phone out of range, bad API key, no active session

### 7. Publish to Connect IQ Store (optional, later)

- Create developer account at https://developer.garmin.com
- Generate a proper app UUID (currently using `scorebrawl-garmin-remote` placeholder)
- Add store listing screenshots from simulator
- Submit for review

---

## Key Decisions & Risks

### Duplicated orchestration logic

The `recordResult` endpoint duplicates ~100 lines of orchestration from the tRPC session router. This is intentional for v1 to avoid touching the tRPC router. A future refactor should extract this into a shared service function that both routers call.

### Polling vs push

The Garmin watch polls every 10 seconds. This means if someone records a result from the web, the watch may show stale state for up to 10 seconds. Acceptable for v1. Garmin doesn't support WebSocket/SSE.

### Memory constraints

Garmin apps have 64-128KB memory limits. The session state response must stay lean. Player arrays are small (typical session = 4-8 players). No concern here.

### Phone dependency

All HTTP from the watch goes through BLE to the paired phone → internet. If the phone is out of range or Garmin Connect app is killed, HTTP will fail. The app should handle this gracefully with clear error messages.

### Touch vs button

Venu (touch) and Fenix (5-button) have different input models. Using `BehaviorDelegate` abstracts this -- `onSelect()`, `onBack()`, `onNextPage()`, `onPreviousPage()` map to both touch gestures and button presses. The `Menu2` system works on both.

### Device IDs

The product IDs in `manifest.xml` need verification against the actual Connect IQ device reference. Wrong IDs = app won't build for those devices.

---

## File Summary

| File                                               | Action                  | Phase |
| -------------------------------------------------- | ----------------------- | ----- |
| `apps/worker/src/routes/device-router.ts`          | Modify (add ~300 lines) | 1     |
| `apps/worker/src/test/trpc/device-session.test.ts` | Create                  | 1     |
| `apps/garmin/manifest.xml`                         | Create                  | 2     |
| `apps/garmin/monkey.jungle`                        | Create                  | 2     |
| `apps/garmin/resources/strings/strings.xml`        | Create                  | 2     |
| `apps/garmin/resources/settings/settings.xml`      | Create                  | 2     |
| `apps/garmin/resources/settings/properties.xml`    | Create                  | 2     |
| `apps/garmin/resources/drawables/drawables.xml`    | Create                  | 2     |
| `apps/garmin/source/ScoreBrawlApp.mc`              | Create                  | 2     |
| `apps/garmin/source/ApiClient.mc`                  | Create                  | 2     |
| `apps/garmin/source/LeaguePickerView.mc`           | Create                  | 2     |
| `apps/garmin/source/LeaguePickerDelegate.mc`       | Create                  | 2     |
| `apps/garmin/source/SessionView.mc`                | Create                  | 2     |
| `apps/garmin/source/SessionDelegate.mc`            | Create                  | 2     |
| `apps/garmin/source/ScoreEntryView.mc`             | Create                  | 2     |
| `apps/garmin/source/ScoreEntryDelegate.mc`         | Create                  | 2     |
| `apps/garmin/source/CoinTossView.mc`               | Create                  | 2     |
| `apps/garmin/source/CoinTossDelegate.mc`           | Create                  | 2     |
| `apps/garmin/source/ErrorView.mc`                  | Create                  | 2     |
