# Garmin Session Remote — Manual Test Plan

## Prerequisites

- Garmin Connect IQ SDK on PATH
- Scorebrawl running locally (`http://scorebrawl.localhost:1355`) or preview URL from PR
- API key created on your profile page - sb_devnFwguVrbNGEhVTIfCUDBRFAWhTxEcNCBxKVgduBeLsCYwRZWAUXXyrwgVBifVaND
- Active session in a league you're a member of

## 1. Build & Simulator

```bash
export PATH="$PATH:$HOME/Library/Application Support/Garmin/ConnectIQ/Sdks/connectiq-sdk-mac-8.4.1-2026-02-03-e9f77eeaa/bin"
monkeyc -f apps/garmin/monkey.jungle -o apps/garmin/build/ScoreBrawl.prg -d venu2 -y apps/garmin/developer_key.der -w
connectiq
monkeydo apps/garmin/build/ScoreBrawl.prg venu2
```

- [ ] Build succeeds (warnings OK)
- [ ] Simulator launches and app loads

## 2. No API Key

Leave API key blank in simulator settings.

- [ ] Shows "Set API key in Garmin Connect" error screen

## 3. Invalid API Key

Set API key to `garbage-key-123` in simulator settings. Set `serverUrl` to your test server.

- [ ] League picker shows auth error

## 4. League Picker

Set valid API key and `serverUrl`.

- [ ] Loading state appears briefly
- [ ] League list renders with correct names
- [ ] Selecting a league navigates to session view
- [ ] Back button exits app

## 5. Session View — No Active Session

Select a league with no active session.

- [ ] Shows "No active session" message

## 6. Session View — Proposed Lineup

Create a session on web. Wait for proposed lineup state.

- [ ] Shows match number, home/away player names
- [ ] Shows "Start Match" prompt
- [ ] Auto-refreshes within ~10 seconds when state changes on web

## 7. Start Match

Press SELECT on proposed lineup screen.

- [ ] Match starts (verify on web too)
- [ ] View updates to show match in progress

## 8. Session View — Match In Progress

- [ ] Shows match number, player names, current scores
- [ ] Shows "Enter Score" prompt

## 9. Score Entry

Press SELECT to open score entry.

- [ ] Home score field is active (highlighted)
- [ ] UP increments active score
- [ ] DOWN decrements active score (stops at 0)
- [ ] SELECT moves from home to away field
- [ ] SELECT on away field shows confirmation
- [ ] BACK on confirmation returns to editing
- [ ] Confirming submits and returns to session view
- [ ] Score appears correctly on web

## 10. Score Entry — 2v2+ Teams

Create a session with `teamSize > 1`.

- [ ] Multiple player names shown per side (comma-separated)
- [ ] Score entry still works correctly

## 11. Coin Toss

Set up a session with manual coin toss (`autoCoinToss: false`). Record a result that triggers rotation.

- [ ] Session view shows "Coin Toss" state
- [ ] SELECT opens coin toss menu with candidate names
- [ ] Selecting a candidate submits and returns to session view
- [ ] New proposed lineup reflects the coin toss winner

## 12. Error Recovery

- [ ] Disconnect phone (or kill Garmin Connect) → shows connection error
- [ ] Reconnect → next poll succeeds, view updates
- [ ] Submit score with stale match (someone else recorded first) → error shown, stays on view

## 13. Polling

- [ ] Record a result from web while watching the watch
- [ ] Watch updates within ~10 seconds to reflect new state
- [ ] Start a new session from web → watch picks it up

## 14. Backend Endpoints (curl)

```bash
API_KEY="your-api-key"
BASE="http://scorebrawl.localhost:1355/api/device"
SLUG="your-league-slug"

# Get active session
curl -s -H "x-api-key: $API_KEY" "$BASE/leagues/$SLUG/session/active" | jq .

# Start match
curl -s -X POST -H "x-api-key: $API_KEY" "$BASE/leagues/$SLUG/session/start-match" | jq .

# Record result
curl -s -X POST -H "x-api-key: $API_KEY" -H "Content-Type: application/json" \
  -d '{"homeScore":3,"awayScore":1}' "$BASE/leagues/$SLUG/session/record-result" | jq .

# Resolve coin toss
curl -s -X POST -H "x-api-key: $API_KEY" -H "Content-Type: application/json" \
  -d '{"coinTossId":"ct_xxx","winnerIds":["sp_xxx"]}' "$BASE/leagues/$SLUG/session/resolve-coin-toss" | jq .
```

- [ ] `GET /session/active` returns session or `{ session: null }`
- [ ] `POST /start-match` returns `{ success: true }`
- [ ] `POST /record-result` returns updated session state
- [ ] `POST /resolve-coin-toss` returns updated session state
- [ ] All return 401 without API key
- [ ] All return 403 for non-member API key

## 15. Physical Device

Sideload `.prg` via Garmin Connect Mobile.

- [ ] App appears in watch app list
- [ ] Full flow works: pick league → view session → start match → record score → coin toss
- [ ] Screen is readable on actual watch face
- [ ] Button/touch inputs feel responsive
- [ ] App doesn't crash after extended use (leave it polling for 5+ minutes)

## 16. Icon

- [ ] Replace `apps/garmin/resources/drawables/launcher_icon.png` with proper 70x70 Scorebrawl icon
- [ ] Rebuild and verify icon renders in simulator app list
