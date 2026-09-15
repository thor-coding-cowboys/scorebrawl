# Session UX Improvements

## Phase 1: Quick Text Fix — "Join Session" -> "Go to Session"

**Files:**

- `apps/web/src/routes/_authenticated/_sidebar/leagues/$slug/seasons/$seasonSlug/route.tsx:89`

**Change:** Rename button text from "Join Session" to "Go to Session". This banner shows in the season layout when an active session exists and user is not on the session route. It's navigational, not a participation action.

---

## Phase 2: Self-Join Button for Non-Participating Season Players

When viewing an active session, if the current user is a season player but NOT a session participant, show a prominent "Join Session" banner at the top of the session view.

**Backend:**

- `apps/worker/src/trpc/router/session-router.ts` — add `joinSelf` procedure (or reuse `addPlayer`). Need to resolve current user's `seasonPlayerId` from their `userId` + session's `seasonId`. The existing `addPlayer` requires knowing the `seasonPlayerId` — a new `joinSelf` that looks it up from auth context is cleaner.
  - Input: `{ sessionId: string }`
  - Logic: look up `seasonPlayer` where `userId = ctx.authentication.user.id` AND `seasonId = session.seasonId`. If not found or already in session, error. Otherwise delegate to `sessionRepository.addPlayerToSession`.
  - Broadcast `session:update` SSE event.

**Frontend:**

- `apps/web/src/routes/_authenticated/_sidebar/leagues/$slug/seasons/$seasonSlug/session/$sessionId/index.tsx`
  - After session loads, check: is current user a session participant? Compare `authSession.user.id` against `session.players` (need userId on session players OR fetch season player standing to match).
  - If not participating: render a top banner (amber/green styled, similar to season layout banner) with "Join Session" button.
  - On click: call `session.joinSelf` mutation -> invalidate session query -> banner disappears.
  - Need access to `useSession()` for auth user ID. Already available via `@/hooks/useSession`.

**Data consideration:** `SessionPlayer` type doesn't expose `userId`. Options:

1. Add `userId` to the session player payload from `getSessionById` (preferred — single query change in repository).
2. Separate query to check membership (extra round-trip, avoid).

**Files:**

- `apps/worker/src/repositories/session-repository.ts` — ensure `getSessionById` returns `userId` on players
- `apps/worker/src/trpc/router/session-router.ts` — add `joinSelf` procedure
- `apps/web/src/routes/.../session/$sessionId/index.tsx` — add join banner + mutation
- `apps/web/src/routes/.../session/$sessionId/-components/session-types.ts` — add `userId` to `SessionPlayer`

---

## Phase 3: SSE Session-End -> Navigate to Summary + Toast

When a session ends, all viewers should be redirected to the summary page with a toast "Session ended by {user}".

**Current behavior:**

- `session:end` SSE event is already broadcast from `session-router.ts:496`
- `use-season-sse.ts:166-189` dispatches a `session-event` CustomEvent with `type: "session:end"`
- Session view (`index.tsx:79-91`) listens for `session-event` and invalidates query on `session:end`
- BUT: it only invalidates — no navigation or toast

**Changes needed:**

1. **Include user name in the session:end event detail** — `SessionEventDetail` currently only has `type` + `sessionId`. Add `userName` field.
   - `apps/web/src/lib/event-types.ts` — add `userName?: string` to `SessionEventDetail`
   - `apps/web/src/hooks/use-season-sse.ts:172` — include `userName: parsed.user?.name` in the dispatched CustomEvent detail

2. **Session view: handle session:end with navigation + toast**
   - `apps/web/src/routes/.../session/$sessionId/index.tsx:79-91` — on `session:end` for this session AND not own event:
     - `toast.info("Session ended by {userName}")`
     - `navigate({ to: ".../summary" })`
   - Need `currentUserId` — get from `useSession()` hook (already used elsewhere in the app)

**Files:**

- `apps/web/src/lib/event-types.ts`
- `apps/web/src/hooks/use-season-sse.ts`
- `apps/web/src/routes/.../session/$sessionId/index.tsx`

---

## Phase 4: Shuffle Animation After Match Result

When a match result is recorded and the next lineup is computed (especially with `autoRandomize`), the transition is invisible if teams happen to look similar. Need an intermediate "shuffling" visual state.

**Current flow:**

1. User clicks "Record Result"
2. `recordResult.onSuccess` fires → sets `proposedLineup` + updates `teamAssignment` immediately
3. UI jumps to "Next Match" view with teams already assigned

**Proposed approach — "Reveal" animation:**
After recording a result, briefly show an intermediate state before revealing the new lineup:

1. Record result → clear team assignments (all players unassigned momentarily)
2. Show a brief shuffle/spin animation on the team roster cards (~1-1.5s)
3. Reveal the new lineup by setting team assignments

**Implementation:**

- Add `isShuffling` state to session page
- On `recordResult.onSuccess`:
  1. Set `isShuffling = true`, clear all team assignments
  2. After ~1.2s timeout, set actual lineup + `isShuffling = false`
- `TeamRosterCard` component: when `isShuffling`, show placeholder animation (pulsing skeleton slots or a "Shuffling..." text with spinning icon)
- This applies to both auto-randomize flow AND manual proposed lineup flow

**Alternative lighter approach — "Flash" transition:**

- Instead of full animation, briefly flash/highlight the team cards with a scale + opacity transition
- Use CSS `transition` on team roster entries with a staggered delay
- Simpler to implement, still provides visual feedback

**Recommended: combine both** — clear teams briefly with skeleton pulse, then reveal with staggered fade-in per player.

**Files:**

- `apps/web/src/routes/.../session/$sessionId/index.tsx` — add `isShuffling` state, modify `recordResult.onSuccess` and `applyRandomizedLineup`
- `apps/web/src/routes/.../session/$sessionId/-components/session-dashboard-cards.tsx` or `TeamRosterCard` — add shuffling visual state
- Possibly a new small component or CSS animation

---

## Unresolved Questions

1. **Phase 2**: Should non-participants be able to join mid-match, or only between matches? (current `addPlayer` works any time)
2. **Phase 2**: Should guest players (no userId) also be joinable via self-join, or only linked user accounts?
3. **Phase 4**: Preferred animation duration? 1s feels snappy, 1.5s gives more time to notice. Should it be configurable?
4. **Phase 4**: Should the shuffle animation also play on the very first match team selection, or only after recording a result?
