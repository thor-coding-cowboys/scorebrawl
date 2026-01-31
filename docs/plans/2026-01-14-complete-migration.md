# Complete Migration: Routes, Auth, Components, Tests

> **For Claude:** Use superpowers:subagent-driven-development to implement this plan

**Goal:** Complete the frontend migration with routes, auth UI, business components, and comprehensive tests

**Context:** Infrastructure is done (backend, frontend, database package). Now migrating application logic.

---

## Phase 1: Authentication Components

### Task 1: Build Sign-In Component

**Files:**
- Create: `apps/frontend/src/components/auth/sign-in-form.tsx`

**Implementation:**
Adapt reference sign-in-form.tsx with:
- Email/password authentication
- Google OAuth (instead of GitHub)
- Passkey support
- Form validation with Zod
- Error handling
- TanStack Router navigation
- Uses authClient from `@/lib/auth-client`

**Commit:** "feat: add sign-in form component"

---

### Task 2: Build Sign-Up Component

**Files:**
- Create: `apps/frontend/src/components/auth/sign-up-form.tsx`

**Implementation:**
Adapt reference sign-up-form.tsx with:
- Name, email, password fields
- Google OAuth
- Form validation
- Links to sign-in

**Commit:** "feat: add sign-up form component"

---

### Task 3: Build Forgot Password Component

**Files:**
- Create: `apps/frontend/src/components/auth/forgot-password-form.tsx`

**Implementation:**
Adapt reference forgot-password-form.tsx:
- Email input
- Password reset request
- Google OAuth fallback
- Back navigation

**Commit:** "feat: add forgot password form component"

---

## Phase 2: Core Routes

### Task 4: Create Auth Routes

**Files:**
- Create: `apps/frontend/src/routes/auth/sign-in.tsx`
- Create: `apps/frontend/src/routes/auth/sign-up.tsx`
- Create: `apps/frontend/src/routes/auth/forgot-password.tsx`

**Implementation:**
- Centered layout (min-h-screen, flex center)
- Use auth form components
- Handle redirect search param
- Public routes (no auth required)

**Commit:** "feat: add auth routes"

---

### Task 5: Create Index/Dashboard Route

**Files:**
- Create: `apps/frontend/src/routes/index.tsx`

**Implementation:**
- Protected route (requires auth)
- Fetch user's leagues via tRPC
- Redirect logic:
  - If has leagues → redirect to first league
  - If no leagues → redirect to onboarding
- Loading state

**Commit:** "feat: add index route with smart redirect"

---

### Task 6: Create Onboarding Route

**Files:**
- Create: `apps/frontend/src/routes/onboarding.tsx`
- Copy: `apps/scorebrawl/src/components/onboarding/OnboardingStepper.tsx` → `apps/frontend/src/components/onboarding/onboarding-stepper.tsx`

**Implementation:**
- Protected route
- Centered layout
- OnboardingStepper component
- Check if user already has leagues (redirect if so)

**Commit:** "feat: add onboarding route and component"

---

### Task 7: Create Profile Route

**Files:**
- Create: `apps/frontend/src/routes/profile.tsx`
- Copy profile components from scorebrawl

**Implementation:**
- Protected route
- User info display
- Linked accounts management
- Passkeys management
- User's leagues list

**Commit:** "feat: add profile route"

---

## Phase 3: League Routes

### Task 8: Create Leagues Layout

**Files:**
- Create: `apps/frontend/src/routes/leagues/_layout.tsx`
- Copy sidebar component

**Implementation:**
- Protected layout
- AppSidebar with league navigation
- Main content area
- Session check

**Commit:** "feat: add leagues layout with sidebar"

---

### Task 9: Create League List and Create Routes

**Files:**
- Create: `apps/frontend/src/routes/leagues/index.tsx`
- Create: `apps/frontend/src/routes/leagues/create.tsx`
- Copy LeagueForm component

**Implementation:**
- leagues/index.tsx: Same redirect logic as root
- leagues/create.tsx: League creation form
- Use tRPC mutations

**Commit:** "feat: add league list and create routes"

---

### Task 10: Create Dynamic League Routes

**Files:**
- Create: `apps/frontend/src/routes/leagues/$leagueSlug/_layout.tsx`
- Create: `apps/frontend/src/routes/leagues/$leagueSlug/index.tsx`
- Create: `apps/frontend/src/routes/leagues/$leagueSlug/players/index.tsx`
- Create: `apps/frontend/src/routes/leagues/$leagueSlug/teams/index.tsx`
- Create: `apps/frontend/src/routes/leagues/$leagueSlug/settings.tsx`

**Implementation:**
- Layout: Validate league access, provide league context
- Index: Smart redirect to season or create season
- Players: Player list table
- Teams: Team list table
- Settings: League settings form

**Commit:** "feat: add dynamic league routes"

---

### Task 11: Create Season Routes

**Files:**
- Create: `apps/frontend/src/routes/leagues/$leagueSlug/seasons/index.tsx`
- Create: `apps/frontend/src/routes/leagues/$leagueSlug/seasons/create.tsx`
- Create: `apps/frontend/src/routes/leagues/$leagueSlug/seasons/$seasonSlug/_layout.tsx`
- Create: `apps/frontend/src/routes/leagues/$leagueSlug/seasons/$seasonSlug/index.tsx`
- Create: `apps/frontend/src/routes/leagues/$leagueSlug/seasons/$seasonSlug/matches/index.tsx`

**Implementation:**
- Seasons list
- Season creation with score type selection
- Season layout with SeasonProvider context
- Season dashboard with standings
- Matches list

**Commit:** "feat: add season routes"

---

## Phase 4: Copy Business Components

### Task 12: Copy Shared Components

**Files:**
- Copy all from `apps/scorebrawl/src/components/` to `apps/frontend/src/components/`
- Exclude: ui (already copied), providers (already exist), auth (building new)

**Implementation:**
- Copy avatar, layout, league, match, players, season, standing, state folders
- Fix imports (update to use new structure)
- Update tRPC usage to use new client

**Commit:** "feat: copy business logic components"

---

## Phase 5: Testing

### Task 13: Add League Router Tests

**Files:**
- Create: `packages/database/src/trpc/__tests__/league-router.test.ts`

**Tests:**
- Create league
- Update league
- Get league by slug
- Delete league
- Access control (member vs non-member)

**Commit:** "test: add league router tests"

---

### Task 14: Add Season Router Tests

**Files:**
- Create: `packages/database/src/trpc/__tests__/season-router.test.ts`

**Tests:**
- Create season
- Get season by slug
- Update season
- Close season
- List seasons for league

**Commit:** "test: add season router tests"

---

### Task 15: Add Match Router Tests

**Files:**
- Create: `packages/database/src/trpc/__tests__/match-router.test.ts`

**Tests:**
- Create ELO match
- Create fixture match
- Get match by ID
- Update match
- Delete match
- Validate ELO calculations

**Commit:** "test: add match router tests"

---

## Phase 6: Integration & Polish

### Task 16: Update Router Root

**Files:**
- Modify: `apps/frontend/src/router.tsx`

**Implementation:**
- Ensure TRPCProvider wraps routes
- Add auth state management
- Configure route guards
- Add loading states

**Commit:** "feat: finalize router configuration"

---

### Task 17: Test End-to-End Flow

**Files:**
- None (testing only)

**Test Flow:**
1. Start backend and frontend servers
2. Sign up new user
3. Complete onboarding
4. Create league
5. Add players
6. Create season
7. Record matches
8. Verify standings update

**Commit:** "docs: add e2e testing notes"
