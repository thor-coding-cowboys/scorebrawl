# Season Form Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace simple season creation form with comprehensive two-step wizard supporting ELO and 3-1-0 scoring systems

**Architecture:** Two-step flow with score type selector (step 1) leading to dynamic form (step 2). Single SeasonCreateForm component handles both scoring types. Manual field implementation using React Hook Form + Zod validation.

**Tech Stack:** React 19, TanStack Router, React Hook Form, Zod, tRPC, Shadcn/ui components

---

## Task 1: Create ScoreTypeSelector Component

**Files:**
- Create: `apps/frontend/src/components/season/score-type-selector.tsx`

**Step 1: Create component file with basic structure**

```tsx
import { useNavigate } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Trophy, Table } from 'lucide-react'

interface ScoreTypeSelectorProps {
  leagueSlug: string
}

export function ScoreTypeSelector({ leagueSlug }: ScoreTypeSelectorProps) {
  const navigate = useNavigate()

  const handleSelectScoreType = (scoreType: 'elo' | '3-1-0') => {
    navigate({
      to: '/leagues/$leagueSlug/seasons/create-form',
      params: { leagueSlug },
      search: { scoreType }
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2">Choose Scoring System</h2>
        <p className="text-muted-foreground">
          Select how you want to track player performance in this season
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* ELO Card */}
        <Card
          className="cursor-pointer transition-all hover:border-primary hover:shadow-md"
          onClick={() => handleSelectScoreType('elo')}
        >
          <CardHeader>
            <Trophy className="h-8 w-8 mb-2 text-primary" />
            <CardTitle>ELO Rating</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Create a season using the Elo Points System. A higher K-Factor may lead to more
              volatile ratings, while a lower K-Factor results in more stable ratings over time.
            </p>
          </CardContent>
        </Card>

        {/* 3-1-0 Card */}
        <Card
          className="cursor-pointer transition-all hover:border-primary hover:shadow-md"
          onClick={() => handleSelectScoreType('3-1-0')}
        >
          <CardHeader>
            <Table className="h-8 w-8 mb-2 text-primary" />
            <CardTitle>3-1-0 Points</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Create a season using the Standard 3-1-0 Points System, where teams earn 3 points
              for a win, 1 point for a draw, and 0 points for a loss. A straightforward scoring
              system for clear and simple match outcomes.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
```

**Step 2: Verify imports and component structure**

Check that all imports resolve:
- `@tanstack/react-router` for navigation
- `@/components/ui/card` for Card components
- `lucide-react` for icons

**Step 3: Commit**

```bash
git add apps/frontend/src/components/season/score-type-selector.tsx
git commit -m "feat: add score type selector component

Add two-card selector for choosing between ELO and 3-1-0 scoring systems
with descriptions and navigation to form step.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Create SeasonCreateForm Component Skeleton

**Files:**
- Create: `apps/frontend/src/components/season/season-create-form.tsx`

**Step 1: Create component with type handling**

```tsx
import { useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { trpc } from '@/lib/trpc'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Form } from '@/components/ui/form'
import { EloSeasonCreateDTOSchema, ThreeOneNilSeasonCreateDTOSchema } from '@scorebrawl/database/dto/season'
import { z } from 'zod'

interface SeasonCreateFormProps {
  leagueSlug: string
  scoreType: 'elo' | '3-1-0'
}

type EloFormValues = z.infer<typeof EloSeasonCreateDTOSchema>
type ThreeOneNilFormValues = z.infer<typeof ThreeOneNilSeasonCreateDTOSchema>

export function SeasonCreateForm({ leagueSlug, scoreType }: SeasonCreateFormProps) {
  const navigate = useNavigate()
  const { toast } = useToast()
  const createSeason = trpc.season.create.useMutation()

  const isElo = scoreType === 'elo'

  // Form setup - we'll add this next
  const form = useForm({
    resolver: zodResolver(
      isElo ? EloSeasonCreateDTOSchema : ThreeOneNilSeasonCreateDTOSchema
    ),
    defaultValues: {
      leagueSlug,
      scoreType,
      name: '',
      startDate: new Date(),
      ...(isElo ? { initialScore: 1200, kFactor: 32 } : { roundsPerPlayer: 1 })
    }
  })

  const onSubmit = async (values: EloFormValues | ThreeOneNilFormValues) => {
    createSeason.mutate(values, {
      onSuccess: (data) => {
        navigate({
          to: '/leagues/$leagueSlug/seasons/$seasonSlug',
          params: { leagueSlug, seasonSlug: data.slug }
        })
      },
      onError: (error) => {
        toast({
          title: 'Failed to create season',
          description: error.message,
          variant: 'destructive'
        })
      }
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2">
          Create {isElo ? 'ELO' : '3-1-0'} Season
        </h2>
        <p className="text-muted-foreground">
          Fill out the details for your new season
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Season Details</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Form fields will be added in next tasks */}

              <div className="flex justify-between pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate({
                    to: '/leagues/$leagueSlug/seasons/create',
                    params: { leagueSlug }
                  })}
                >
                  Back
                </Button>
                <Button type="submit" disabled={createSeason.isPending}>
                  {createSeason.isPending ? 'Creating...' : 'Create Season'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
```

**Step 2: Verify type safety**

Check that TypeScript correctly infers types and default values match schema requirements.

**Step 3: Commit**

```bash
git add apps/frontend/src/components/season/season-create-form.tsx
git commit -m "feat: add season create form skeleton

Add form component with type handling, validation setup, and submission
logic. Fields to be added in subsequent commits.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Add Common Form Fields (Name, Dates)

**Files:**
- Modify: `apps/frontend/src/components/season/season-create-form.tsx`

**Step 1: Add imports for form components**

Add to imports section:
```tsx
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { DatePicker } from '@/components/ui/date-picker'
```

**Step 2: Add common fields inside form element**

Replace the `{/* Form fields will be added in next tasks */}` comment with:

```tsx
{/* Name Field - Common to both types */}
<FormField
  control={form.control}
  name="name"
  render={({ field }) => (
    <FormItem>
      <FormLabel>
        Season Name <span className="text-destructive">*</span>
      </FormLabel>
      <FormControl>
        <Input placeholder="Spring 2024" {...field} />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>

{/* Start Date Field - Common to both types */}
<FormField
  control={form.control}
  name="startDate"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Start Date</FormLabel>
      <FormControl>
        <DatePicker
          date={field.value}
          setDate={field.onChange}
        />
      </FormControl>
      <FormDescription>
        When the season begins (defaults to today)
      </FormDescription>
      <FormMessage />
    </FormItem>
  )}
/>

{/* End Date Field - Common to both types */}
<FormField
  control={form.control}
  name="endDate"
  render={({ field }) => (
    <FormItem>
      <FormLabel>End Date</FormLabel>
      <FormControl>
        <DatePicker
          date={field.value}
          setDate={field.onChange}
        />
      </FormControl>
      <FormDescription>
        When the season ends (optional)
      </FormDescription>
      <FormMessage />
    </FormItem>
  )}
/>
```

**Step 3: Test form renders**

Start dev server and navigate to form - should see name and date fields.

**Step 4: Commit**

```bash
git add apps/frontend/src/components/season/season-create-form.tsx
git commit -m "feat: add common form fields for season creation

Add name, start date, and end date fields with proper labels and
descriptions. Fields work for both ELO and 3-1-0 scoring types.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Add ELO-Specific Fields

**Files:**
- Modify: `apps/frontend/src/components/season/season-create-form.tsx`

**Step 1: Add ELO fields after common fields**

Add after the End Date field and before the buttons:

```tsx
{/* ELO-Specific Fields */}
{isElo && (
  <>
    <FormField
      control={form.control}
      name="initialScore"
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            Initial Score <span className="text-destructive">*</span>
          </FormLabel>
          <FormControl>
            <Input
              type="number"
              step="1"
              min="50"
              {...field}
              onChange={(e) => field.onChange(Number(e.target.value))}
            />
          </FormControl>
          <FormDescription>
            Starting ELO rating for all players (default: 1200, min: 50)
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />

    <FormField
      control={form.control}
      name="kFactor"
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            K-Factor <span className="text-destructive">*</span>
          </FormLabel>
          <FormControl>
            <Input
              type="number"
              step="1"
              min="10"
              max="50"
              {...field}
              onChange={(e) => field.onChange(Number(e.target.value))}
            />
          </FormControl>
          <FormDescription>
            Higher values lead to more volatile ratings (range: 10-50, default: 32)
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  </>
)}
```

**Step 2: Test ELO form**

Navigate to form with `?scoreType=elo` - should see 5 fields total with proper defaults.

**Step 3: Commit**

```bash
git add apps/frontend/src/components/season/season-create-form.tsx
git commit -m "feat: add ELO-specific form fields

Add Initial Score and K-Factor fields that appear only when ELO scoring
is selected. Includes proper number validation and helper text.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Add 3-1-0-Specific Fields

**Files:**
- Modify: `apps/frontend/src/components/season/season-create-form.tsx`

**Step 1: Add 3-1-0 fields after ELO fields block**

Add after the ELO fields closing tag and before buttons:

```tsx
{/* 3-1-0-Specific Fields */}
{!isElo && (
  <FormField
    control={form.control}
    name="roundsPerPlayer"
    render={({ field }) => (
      <FormItem>
        <FormLabel>
          Rounds per Player <span className="text-destructive">*</span>
        </FormLabel>
        <FormControl>
          <Input
            type="number"
            step="1"
            min="1"
            max="365"
            {...field}
            onChange={(e) => field.onChange(Number(e.target.value))}
          />
        </FormControl>
        <FormDescription>
          Number of rounds each player participates in (range: 1-365, default: 1)
        </FormDescription>
        <FormMessage />
      </FormItem>
    )}
  />
)}
```

**Step 2: Test 3-1-0 form**

Navigate to form with `?scoreType=3-1-0` - should see 4 fields total (name, dates, rounds).

**Step 3: Commit**

```bash
git add apps/frontend/src/components/season/season-create-form.tsx
git commit -m "feat: add 3-1-0-specific form field

Add Rounds per Player field that appears only when 3-1-0 scoring is
selected. Includes proper number validation and helper text.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Update Create Route (Step 1)

**Files:**
- Modify: `apps/frontend/src/routes/_authenticated/_withSidebar/leagues/$leagueSlug/seasons/create.tsx`

**Step 1: Replace entire file with score type selector**

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { ScoreTypeSelector } from '@/components/season/score-type-selector'

export const Route = createFileRoute('/_authenticated/_withSidebar/leagues/$leagueSlug/seasons/create')({
  component: CreateSeasonPage,
})

function CreateSeasonPage() {
  const { leagueSlug } = Route.useParams()

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Create Season</h1>
      <ScoreTypeSelector leagueSlug={leagueSlug} />
    </div>
  )
}
```

**Step 2: Test navigation**

Navigate to `/leagues/{slug}/seasons/create` - should see two cards for score type selection.

**Step 3: Commit**

```bash
git add apps/frontend/src/routes/_authenticated/_withSidebar/leagues/$leagueSlug/seasons/create.tsx
git commit -m "refactor: replace create route with score type selector

Replace simple form with score type selector as step 1 of wizard flow.
User now chooses scoring system before filling out form.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 7: Create Form Route (Step 2)

**Files:**
- Create: `apps/frontend/src/routes/_authenticated/_withSidebar/leagues/$leagueSlug/seasons/create-form.tsx`

**Step 1: Create route file**

```tsx
import { createFileRoute, redirect } from '@tanstack/react-router'
import { SeasonCreateForm } from '@/components/season/season-create-form'

export const Route = createFileRoute('/_authenticated/_withSidebar/leagues/$leagueSlug/seasons/create-form')({
  component: CreateSeasonFormPage,
  validateSearch: (search: Record<string, unknown>) => {
    const scoreType = search.scoreType as string

    // Validate scoreType and redirect if invalid
    if (scoreType !== 'elo' && scoreType !== '3-1-0') {
      throw redirect({
        to: '/leagues/$leagueSlug/seasons/create',
        params: (params) => params
      })
    }

    return {
      scoreType: scoreType as 'elo' | '3-1-0'
    }
  },
})

function CreateSeasonFormPage() {
  const { leagueSlug } = Route.useParams()
  const { scoreType } = Route.useSearch()

  return (
    <div className="max-w-2xl mx-auto">
      <SeasonCreateForm leagueSlug={leagueSlug} scoreType={scoreType} />
    </div>
  )
}
```

**Step 2: Test complete flow**

1. Go to `/leagues/{slug}/seasons/create`
2. Click ELO card
3. Should navigate to form with ELO fields
4. Go back and click 3-1-0 card
5. Should navigate to form with 3-1-0 fields

**Step 3: Commit**

```bash
git add apps/frontend/src/routes/_authenticated/_withSidebar/leagues/$leagueSlug/seasons/create-form.tsx
git commit -m "feat: add create-form route for step 2

Add form route that validates scoreType from URL and renders appropriate
form. Redirects to step 1 if scoreType is invalid.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 8: Fix Default Values Type Issue

**Files:**
- Modify: `apps/frontend/src/components/season/season-create-form.tsx`

**Step 1: Fix default values to match form type**

Update the form defaultValues to properly type-check:

```tsx
const form = useForm<EloFormValues | ThreeOneNilFormValues>({
  resolver: zodResolver(
    isElo ? EloSeasonCreateDTOSchema : ThreeOneNilSeasonCreateDTOSchema
  ),
  defaultValues: isElo
    ? {
        leagueSlug,
        scoreType: 'elo' as const,
        name: '',
        startDate: new Date(),
        initialScore: 1200,
        kFactor: 32,
      }
    : {
        leagueSlug,
        scoreType: '3-1-0' as const,
        name: '',
        startDate: new Date(),
        roundsPerPlayer: 1,
      }
})
```

**Step 2: Verify TypeScript errors are gone**

Run `bun run typecheck` in apps/frontend to verify no type errors.

**Step 3: Commit**

```bash
git add apps/frontend/src/components/season/season-create-form.tsx
git commit -m "fix: correct default values type handling

Split default values by score type to satisfy TypeScript's discriminated
union type checking.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 9: Add Date Validation Refinement

**Files:**
- Modify: `apps/frontend/src/components/season/season-create-form.tsx`

**Step 1: Create validation schema with refinement**

Add after imports:

```tsx
import { endOfDay, startOfDay } from 'date-fns'

// Create extended schemas with date validation
const createEloSchema = (leagueSlug: string) =>
  EloSeasonCreateDTOSchema.omit({ leagueSlug: true })
    .extend({ leagueSlug: z.literal(leagueSlug) })
    .refine(
      (data) =>
        !data.endDate ||
        endOfDay(data.endDate) > startOfDay(data.startDate),
      {
        message: 'End date must be after start date',
        path: ['endDate'],
      }
    )

const createThreeOneNilSchema = (leagueSlug: string) =>
  ThreeOneNilSeasonCreateDTOSchema.omit({ leagueSlug: true })
    .extend({ leagueSlug: z.literal(leagueSlug) })
    .refine(
      (data) =>
        !data.endDate ||
        endOfDay(data.endDate) > startOfDay(data.startDate),
      {
        message: 'End date must be after start date',
        path: ['endDate'],
      }
    )
```

**Step 2: Update form to use new schemas**

Update the useForm call:

```tsx
const form = useForm<EloFormValues | ThreeOneNilFormValues>({
  resolver: zodResolver(
    isElo ? createEloSchema(leagueSlug) : createThreeOneNilSchema(leagueSlug)
  ),
  // ... rest stays the same
})
```

**Step 3: Test date validation**

Try submitting form with end date before start date - should show error.

**Step 4: Commit**

```bash
git add apps/frontend/src/components/season/season-create-form.tsx
git commit -m "feat: add date validation refinement

Add validation to ensure end date is after start date. Shows clear error
message when validation fails.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 10: Manual Testing & Polish

**Files:**
- None (testing only)

**Step 1: Test complete ELO flow**

1. Navigate to `/leagues/{slug}/seasons/create`
2. Click "ELO Rating" card
3. Fill out form with valid data
4. Submit and verify redirect to season dashboard
5. Verify season appears in database

**Step 2: Test complete 3-1-0 flow**

1. Navigate back to `/leagues/{slug}/seasons/create`
2. Click "3-1-0 Points" card
3. Fill out form with valid data
4. Submit and verify redirect to season dashboard
5. Verify season appears in database

**Step 3: Test validation**

1. Try submitting empty name - should show error
2. Try invalid number ranges - should show error
3. Try end date before start date - should show error
4. Try navigating directly to create-form without scoreType - should redirect

**Step 4: Test responsive design**

1. Resize browser to mobile width
2. Verify cards stack vertically
3. Verify form is readable and usable
4. Verify touch targets are adequate

**Step 5: Test error handling**

1. Disconnect backend or cause mutation error
2. Submit form
3. Verify toast appears with error message

**Step 6: Document test results**

Create file `docs/testing/season-form-manual-tests.md` with results.

**Step 7: Commit test documentation**

```bash
git add docs/testing/season-form-manual-tests.md
git commit -m "docs: add manual testing results for season form

Document successful manual testing of two-step wizard flow, validation,
error handling, and responsive design.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 11: Update Documentation

**Files:**
- Modify: `docs/plans/2026-01-30-season-form-redesign.md`
- Modify: `docs/MIGRATION-STATUS.md`

**Step 1: Update design doc with implementation status**

Add to top of design doc after Status line:

```markdown
**Status:** ✅ Implemented
**Implementation Date:** 2026-01-30
```

Add implementation notes section at bottom:

```markdown
---

## Implementation Notes

### Files Created
- `apps/frontend/src/components/season/score-type-selector.tsx`
- `apps/frontend/src/components/season/season-create-form.tsx`
- `apps/frontend/src/routes/_authenticated/_withSidebar/leagues/$leagueSlug/seasons/create-form.tsx`

### Files Modified
- `apps/frontend/src/routes/_authenticated/_withSidebar/leagues/$leagueSlug/seasons/create.tsx`

### Key Changes
- Replaced single-page form with two-step wizard
- Added score type selection step
- Implemented dynamic form with full field support
- Added date validation with refinements
- Manual field implementation (no AutoForm)

### Testing Completed
- Manual testing of both scoring system flows
- Validation testing (required fields, ranges, dates)
- Error handling testing (toast notifications)
- Responsive design testing (mobile/desktop)
```

**Step 2: Update migration status**

Add to relevant section in MIGRATION-STATUS.md:

```markdown
### Season Management ✅
- ✅ Two-step season creation wizard
- ✅ Score type selector with descriptions
- ✅ Full field support for ELO (initial score, k-factor)
- ✅ Full field support for 3-1-0 (rounds per player)
- ✅ Date validation (end after start)
- ✅ Manual form implementation (no AutoForm)
```

**Step 3: Commit documentation updates**

```bash
git add docs/plans/2026-01-30-season-form-redesign.md docs/MIGRATION-STATUS.md
git commit -m "docs: update documentation with implementation status

Mark season form redesign as implemented and update migration status
with completed features.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 12: Final Verification

**Files:**
- None (verification only)

**Step 1: Run type checking**

```bash
cd apps/frontend
bun run typecheck
```

Expected: No TypeScript errors

**Step 2: Run build**

```bash
cd apps/frontend
bun run build
```

Expected: Build succeeds with no errors

**Step 3: Test production build**

```bash
cd apps/frontend
bun run preview
```

Navigate through the complete flow and verify everything works.

**Step 4: Verify no AutoForm usage**

```bash
grep -r "AutoForm" apps/frontend/src
```

Expected: No results (or only in comments)

**Step 5: Create summary**

Document verification results showing:
- TypeScript passes
- Build succeeds
- Production build works
- No AutoForm in codebase
- All success criteria met

**Step 6: Final commit**

```bash
git add -A
git commit -m "chore: final verification and cleanup

Verified TypeScript, build, and production functionality. Confirmed no
AutoForm usage in frontend codebase. All success criteria met.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Success Criteria Checklist

- [ ] Two-step wizard flow works correctly
- [ ] Score type selector shows both options with descriptions
- [ ] ELO form shows all 5 fields with correct defaults
- [ ] 3-1-0 form shows all 4 fields with correct defaults
- [ ] Date validation prevents end date before start date
- [ ] Form submission creates season via tRPC
- [ ] Success navigation goes to season dashboard
- [ ] Error toast shows on failure
- [ ] Form is responsive on mobile
- [ ] All fields accessible via keyboard
- [ ] No AutoForm component in codebase
- [ ] TypeScript compilation passes
- [ ] Production build succeeds

---

## Notes for Implementer

### Key Points
- Follow TDD where applicable (though this is primarily UI work)
- Commit frequently after each logical change
- Test manually after each task
- Keep components focused and single-purpose
- Reuse existing UI components

### Common Issues
- **Type errors with discriminated unions:** Split default values by type
- **Date picker state issues:** Ensure value and onChange are properly connected
- **Number input strings:** Remember to parse with Number() in onChange
- **Navigation after redirect:** May need to clear form state

### Testing Tips
- Use browser devtools to test responsive design
- Test with network throttling for loading states
- Test keyboard navigation with Tab key
- Verify form state resets between navigations

---

**Plan Created By:** Claude Sonnet 4.5
**Ready for Implementation:** Yes
