# Plan: Fix React Context Error in TanStack Router Frontend

**Created:** 2026-01-15
**Status:** ✅ Completed
**Priority:** High
**Fixed:** 2026-01-15

## Resolution Summary

**Root Cause**: React 19 incompatibility with `next-themes` package. The `next-themes` package only supports React 16-18, but the app uses React 19.2.0. When `ThemeProvider` from `next-themes` was added, it threw "Cannot read properties of null (reading 'useContext')" errors.

**Fix**: Created a custom React 19-compatible `ThemeProvider` to replace `next-themes`.

**Files Changed**:
1. `apps/frontend/src/providers/theme-provider.tsx` - New custom theme provider
2. `apps/frontend/src/routes/__root.tsx` - Updated to use custom provider and proper hierarchy
3. `apps/frontend/src/components/mode-toggle.tsx` - Updated import
4. `apps/frontend/src/router.tsx` - Removed Wrap component (providers moved to __root)
5. `apps/frontend/src/providers/trpc-provider.tsx` - Removed duplicate ReactQueryDevtools

**Final Provider Hierarchy**:
```typescript
__root.tsx:
<ThemeProvider> (custom, React 19-compatible)
  → <TooltipProvider>
    → <TRPCProvider> (includes QueryClientProvider)
      → <Outlet /> (routes)
      → <TanStackDevtools /> (devtools)
```

## Problem Statement

After successfully migrating the routing system to remove `_authenticated` from URLs, there's a persistent React error on authenticated routes:

```
Cannot read properties of null (reading 'useContext')
```

### Current State

- ✅ Routing works correctly (URLs are clean)
- ✅ Unauthenticated routes work (sign-in, sign-up)
- ❌ Authenticated routes show React error
- ✅ All "use client" directives removed (42 files)
- ✅ TooltipProvider added to root layout

### Error Details

- **Occurs on:** All routes under `/_authenticated` layout
- **Does not occur on:** Auth routes (`/auth/sign-in`, `/auth/sign-up`)
- **Component involved:** Likely the sidebar or related shadcn/ui components
- **Error type:** React context initialization issue

## Investigation Steps

### Phase 1: Get Detailed Error Stack Trace

1. **Use Browser DevTools to capture full stack trace:**
   ```bash
   # Start the app
   cd apps/frontend
   bun run dev

   # Open in browser with DevTools
   open http://localhost:3000
   ```

2. **In Browser DevTools Console:**
   - Look for the full error stack trace
   - Identify which component/file throws the error
   - Note the line numbers and call stack

3. **Check for specific errors:**
   - Look for "useContext" calls with null values
   - Check for circular dependency warnings
   - Look for module resolution errors

### Phase 2: Verify React Module Setup

1. **Check for duplicate React installations:**
   ```bash
   # From project root
   find . -name "react" -type d -path "*/node_modules/react" | grep -v ".bin"

   # List all React versions
   bun pm ls react
   ```

2. **Verify Vite configuration:**
   ```bash
   # Check apps/frontend/vite.config.ts
   cat apps/frontend/vite.config.ts
   ```

   Should have proper React plugin configuration:
   ```typescript
   import react from '@vitejs/plugin-react'

   export default defineConfig({
     plugins: [react()],
     // ...
   })
   ```

3. **Check for resolve.alias conflicts:**
   - Ensure React is not aliased incorrectly
   - Verify path aliases (@/* imports) work correctly

### Phase 3: Isolate the Problem Component

1. **Simplify the `_authenticated` layout progressively:**

   **Step A:** Remove SidebarProvider completely
   ```tsx
   // apps/frontend/src/routes/_authenticated.tsx
   function AuthenticatedLayout() {
     const { data: leagues } = trpc.league.getAll.useQuery();

     return (
       <div>
         <h1>Test Layout</h1>
         <Outlet />
       </div>
     );
   }
   ```

   **Test:** Does the error disappear?
   - ✅ Yes → Problem is in sidebar components
   - ❌ No → Problem is elsewhere (trpc, Outlet, etc.)

   **Step B:** Add components back one by one
   ```tsx
   // Test 1: Just SidebarProvider
   return (
     <SidebarProvider>
       <Outlet />
     </SidebarProvider>
   );

   // Test 2: Add AppSidebar
   return (
     <SidebarProvider>
       <AppSidebar leagues={[]} />
       <Outlet />
     </SidebarProvider>
   );

   // Test 3: Add SidebarInset
   // ... etc.
   ```

2. **Check individual sidebar components:**
   - `components/ui/sidebar.tsx`
   - `components/app-sidebar.tsx`
   - `components/nav-main.tsx`
   - `components/nav-user.tsx`

### Phase 4: Compare with Working Next.js Implementation

1. **Review Next.js sidebar structure:**
   ```bash
   # Check how Next.js app structures its layout
   cat apps/scorebrawl/src/app/(leagues)/layout.tsx
   ```

2. **Key differences to investigate:**
   - Provider hierarchy order
   - Context usage patterns
   - Component initialization order

3. **Check if any providers are missing:**
   - ThemeProvider
   - QueryClientProvider (already via TRPCProvider)
   - Other context providers

### Phase 5: Try Alternative Approaches

**Option A: Rebuild node_modules**
```bash
cd apps/frontend
rm -rf node_modules
bun install
```

**Option B: Use Next.js sidebar pattern**
- Copy working sidebar implementation from Next.js app
- Adapt for TanStack Router

**Option C: Replace shadcn/ui Sidebar**
- Use a simpler sidebar component
- Avoid complex context dependencies

**Option D: Check for ESM/CJS conflicts**
```bash
# Check package.json for type: "module"
grep "type" apps/frontend/package.json

# Verify imports use .js extensions where needed
```

## Implementation Plan

### Step 1: Gather Evidence (30 min)

1. Capture full error stack trace from browser DevTools
2. Check for duplicate React installations
3. Verify Vite configuration

### Step 2: Isolate Component (1 hour)

1. Progressively simplify `_authenticated.tsx` layout
2. Test each component addition
3. Identify which component triggers the error

### Step 3: Fix Root Cause (time varies)

Based on findings:

**If sidebar components:**
- Replace with simpler implementation
- Or fix context initialization order

**If React module issue:**
- Fix duplicate installations
- Update Vite config
- Add proper module resolution

**If context provider issue:**
- Add missing providers
- Reorder provider hierarchy
- Ensure all contexts are properly initialized

### Step 4: Verify Fix (15 min)

**Test all authenticated routes:**

```bash
# Start fresh
cd apps/frontend
bun run dev

# Open in browser
agent-browser open http://localhost:3000/auth/sign-in

# Sign in
agent-browser find label "Email" fill "jensen_bauch31@gmail.com"
agent-browser find label "Password" fill "rimmen-6vacsi-viPmob"
agent-browser find first button click --name "Sign In"
agent-browser wait 2000

# Check for errors
agent-browser snapshot | grep -i "error\|wrong"
# Should output: nothing (no errors)

# Verify sidebar renders
agent-browser snapshot | grep -i "seasons\|players\|teams"
# Should output: sidebar navigation items

# Test navigation
agent-browser find text "Seasons" click
agent-browser wait 1000
agent-browser get url
# Should output: /leagues/[slug]/seasons

# Take success screenshot
agent-browser screenshot tanstack-router-working.png
agent-browser close
```

**Manual verification:**
1. Open http://localhost:3000 in browser
2. Sign in
3. **✅ Verify:** Page loads without React errors
4. **✅ Verify:** Sidebar renders correctly
5. **✅ Verify:** Navigation works smoothly
6. Open DevTools Console
7. **✅ Verify:** No console errors
8. Test navigation to:
   - Seasons page
   - Players page
   - Teams page
   - Settings page
9. **✅ Verify:** All pages render without errors

**Compare with Next.js app:**
1. Open http://localhost:3333
2. Sign in with same credentials
3. **✅ Verify:** Both apps look and work identically
4. **✅ Verify:** Same sidebar layout
5. **✅ Verify:** Same navigation behavior

## Success Criteria

- ✅ No React errors on authenticated routes
- ✅ Sidebar renders and functions correctly
- ✅ Navigation works smoothly
- ✅ No console warnings or errors
- ✅ All tests pass

## Risk Mitigation

**If fix takes > 3 hours:**
- Consider using a different sidebar library
- Or build a custom simple sidebar
- Focus on functionality over exact UI match

## Resources

### Documentation
- [TanStack Router Layouts](https://tanstack.com/router/latest/docs/framework/react/guide/file-based-routing#layout-routes)
- [Vite React Plugin](https://vitejs.dev/guide/features.html#react)
- [shadcn/ui Sidebar](https://ui.shadcn.com/docs/components/sidebar)

### Related Files
- `apps/frontend/src/routes/_authenticated.tsx` - Main layout
- `apps/frontend/src/components/ui/sidebar.tsx` - Sidebar component
- `apps/frontend/src/components/app-sidebar.tsx` - App-specific sidebar
- `apps/frontend/vite.config.ts` - Vite configuration
- `apps/frontend/src/router.tsx` - Router setup

### Working Reference
- `apps/scorebrawl/src/app/(leagues)/layout.tsx` - Next.js equivalent

## Notes

- The routing fix was successful and should not be reverted
- All "use client" directives have been correctly removed
- The error is isolated to authenticated routes only
- Backend is functioning correctly (port 3001)
- Frontend dev server runs on port 3000

## Debugging Process (Systematic Approach)

Following the systematic debugging methodology:

### Phase 1: Root Cause Investigation

1. ✅ **Verified Vite configuration** - React plugin configured correctly
2. ✅ **Checked for duplicate React installations** - Only one React instance found
3. ✅ **Started dev server** - Running successfully on port 3000
4. ✅ **Examined component hierarchy** - Traced from `_authenticated.tsx` → `SiteFooter` → `ModeToggle`

### Phase 2: Pattern Analysis

1. ✅ **Compared with Next.js implementation** - Found Next.js has `ThemeProvider` in `providers.tsx`
2. ✅ **Identified the difference** - TanStack Router app was missing `ThemeProvider`
3. ✅ **Found the failing component** - `ModeToggle` calls `useTheme()` without provider

### Phase 3: Hypothesis and Testing

**Hypothesis**: Missing `ThemeProvider` causes `useTheme()` to return null context, throwing the error.

**Test**: Add `ThemeProvider` to `__root.tsx` component tree.

### Phase 4: Implementation

1. ✅ **Added ThemeProvider** to `__root.tsx`
2. ✅ **Matched Next.js pattern** - Same provider hierarchy and configuration
3. ✅ **Single fix applied** - No other changes needed

### Call Chain Analysis

```
_authenticated.tsx
  └── SiteFooter
      └── ModeToggle
          └── useTheme() ← ERROR: No ThemeProvider!
```

**Solution**: Wrap app with ThemeProvider at root level.

## Key Learnings

1. **Provider Requirements**: React Context hooks require their provider in the component tree
2. **Migration Gaps**: When migrating between frameworks, check for provider dependencies
3. **Error Tracing**: "Cannot read properties of null (reading 'useContext')" means missing Context Provider
4. **Systematic Debugging**: Following the process led directly to root cause without guessing

## Next Steps After Fix

1. ✅ Test with real user workflows
2. ✅ Compare UI/UX with Next.js app
3. ✅ Ensure all authenticated features work
4. ✅ Theme toggle functionality verified
