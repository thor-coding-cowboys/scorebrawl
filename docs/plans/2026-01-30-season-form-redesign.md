# Season Form Redesign

**Date:** 2026-01-30
**Status:** ✅ Implemented
**Implementation Date:** 2026-01-30
**Goal:** Rewrite season creation form in apps/frontend to match functionality of apps/scorebrawl reference implementation

---

## Overview

Replace the simple season creation form with a comprehensive two-step wizard that supports both ELO and 3-1-0 scoring systems with full field customization.

---

## Architecture

### File Structure

```
apps/frontend/src/
├── routes/
│   └── _authenticated/_withSidebar/leagues/$leagueSlug/seasons/
│       ├── create.tsx           # Step 1: Score type selection
│       └── create-form.tsx      # Step 2: Form based on type
├── components/season/
│   ├── score-type-selector.tsx  # Cards for ELO vs 3-1-0
│   └── season-create-form.tsx   # Dynamic form component
```

### User Flow

1. User navigates to `/leagues/{slug}/seasons/create`
2. See score type selector with two cards (ELO vs 3-1-0)
3. Click desired scoring system
4. Navigate to `/leagues/{slug}/seasons/create-form?scoreType=elo` (or `3-1-0`)
5. Fill out appropriate form fields
6. Submit and redirect to season dashboard

### Component Responsibilities

**create.tsx route**
- Minimal wrapper
- Renders ScoreTypeSelector component only

**create-form.tsx route**
- Reads scoreType from URL query param
- Validates scoreType is valid
- Renders SeasonCreateForm with scoreType prop

**ScoreTypeSelector component**
- Two clickable cards side-by-side
- Descriptions for each scoring system
- Navigates to create-form route with scoreType param

**SeasonCreateForm component**
- Single dynamic component
- Renders different fields based on scoreType prop
- Handles form state, validation, and submission

---

## Score Type Selector Design

### Visual Layout

Two large cards displayed side-by-side (stack on mobile):

**ELO Card:**
- Icon: Trophy
- Title: "ELO Rating"
- Description: "Create a season using the Elo Points System. A higher K-Factor may lead to more volatile ratings, while a lower K-Factor results in more stable ratings over time."

**3-1-0 Card:**
- Icon: List/Table
- Title: "3-1-0 Points"
- Description: "Create a season using the Standard 3-1-0 Points System, where teams earn 3 points for a win, 1 point for a draw, and 0 points for a loss. A straightforward scoring system for clear and simple match outcomes."

### Interaction

- Hover: Border highlight, subtle shadow
- Click: Navigate using TanStack Router to create-form with scoreType query param
- Responsive: Grid layout (2 columns desktop, 1 column mobile)

---

## Season Create Form Design

### Form Fields

**Common Fields (Both Types):**

1. **Name**
   - Type: Text input
   - Required: Yes
   - Placeholder: "Spring 2024"
   - Validation: Min length check

2. **Start Date**
   - Type: DatePicker
   - Required: No
   - Default: Today's date
   - Format: Date object

3. **End Date**
   - Type: DatePicker
   - Required: No
   - Default: None
   - Validation: Must be after start date (if both provided)

**ELO-Specific Fields:**

4. **Initial Score**
   - Type: Number input
   - Required: Yes
   - Default: 1200
   - Min: 50
   - Helper text: "Starting ELO rating for all players"

5. **K-Factor**
   - Type: Number input
   - Required: Yes
   - Default: 32
   - Range: 10-50
   - Helper text: "Higher values = more volatile ratings"

**3-1-0-Specific Fields:**

4. **Rounds per Player**
   - Type: Number input
   - Required: Yes
   - Default: 1
   - Range: 1-365
   - Helper text: "Number of rounds each player participates in"

### Form Implementation

**Technology:**
- React Hook Form for form state
- Zod resolver for validation
- Schemas: `EloSeasonCreateDTOSchema` or `ThreeOneNilSeasonCreateDTOSchema`
- Default values extracted from schema defaults

**Validation:**
- Real-time validation on blur
- Inline error messages below fields
- Custom refinement: endDate > startDate
- All validation rules from DTOs enforced

**State Management:**
```tsx
const form = useForm({
  resolver: zodResolver(
    scoreType === 'elo'
      ? EloSeasonCreateDTOSchema
      : ThreeOneNilSeasonCreateDTOSchema
  ),
  defaultValues: {
    name: '',
    startDate: new Date(),
    initialScore: 1200,  // ELO only
    kFactor: 32,          // ELO only
    roundsPerPlayer: 1,   // 3-1-0 only
  }
})
```

---

## Submission & Error Handling

### Submit Flow

1. User clicks "Create Season" button
2. Form validates against Zod schema
3. **If invalid:** Show inline errors, prevent submission
4. **If valid:** Call `trpc.season.create.useMutation()`
5. Show loading state on button
6. **On success:** Navigate to season dashboard
7. **On error:** Show toast notification

### Loading States

- Button disabled during submission
- Button text: "Creating..." with spinner
- All form fields remain enabled (allow edits if needed)

### Error Handling

```tsx
const createSeason = trpc.season.create.useMutation({
  onSuccess: (data) => {
    navigate({
      to: '/leagues/$leagueSlug/seasons/$seasonSlug',
      params: {
        leagueSlug,
        seasonSlug: data.slug
      }
    })
  },
  onError: (error) => {
    toast({
      title: "Failed to create season",
      description: error.message,
      variant: "destructive",
    })
  }
})
```

### Navigation

- **Back button:** Returns to score type selector
- **Breadcrumbs:** Leagues > {League Name} > Seasons > Create
- **Cancel:** Optional cancel button that goes back to seasons list

---

## Styling & Layout

### Page Layout

- Container: `max-w-2xl` centered
- Page title: "Create Season" (h1, text-3xl, font-bold, mb-6)
- Form wrapped in Card component
- Vertical spacing: `space-y-4` between fields
- Form actions: Flex row with Back (left) and Submit (right)

### Field Styling

- Consistent FormItem/FormLabel/FormControl pattern
- Required fields: Red asterisk `*` after label
- Field descriptions: Muted text below labels
- Number inputs: `step="1"` for integers
- DatePicker: Use existing UI component

### Responsive Design

- Form fields: Full width on mobile
- Score type cards: Stack on mobile (grid-cols-1)
- Touch targets: Minimum 44px for mobile
- Proper spacing on all screen sizes

### Accessibility

- Proper label associations (htmlFor + id)
- ARIA labels on all form fields
- Error messages announced to screen readers
- Focus management: First field auto-focused
- Keyboard navigation throughout
- High contrast error states

---

## Key Design Decisions

1. **Manual form implementation:** No AutoForm component used anywhere in codebase
2. **Two-step wizard:** Separate score type selection from form for clarity
3. **Single dynamic component:** SeasonCreateForm handles both types
4. **URL-based state:** scoreType in query param for bookmarkability
5. **Full field control:** All fields from DTOs exposed to users
6. **Consistent validation:** Use existing Zod schemas from packages/database

---

## Migration Notes

### Remove AutoForm

- Do not copy AutoForm component from scorebrawl
- Update any existing forms using AutoForm to manual implementation
- Add to migration checklist: "No AutoForm usage in frontend"

### Reuse Existing Components

- DatePicker: Already exists in apps/frontend/src/components/ui
- Card, Input, Button, Select: Already available
- Form components: FormField, FormItem, FormLabel, FormControl, FormMessage
- Toast: Use existing toast hook

### DTOs

- Import from: `@scorebrawl/database/dto/season`
- Schemas already defined and validated
- No changes needed to DTOs

---

## Success Criteria

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

---

## Future Enhancements (Out of Scope)

- Season templates or presets
- Bulk season creation
- Copy settings from previous season
- Season preview before creation
- Advanced scheduling options

---

**Design Completed By:** Claude Sonnet 4.5
**Next Steps:** Create implementation plan and use git worktrees for isolated development

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
- Full keyboard accessibility with focus indicators

### Testing Completed
- Manual testing documentation created
- Test cases cover both scoring system flows
- Validation testing (required fields, ranges, dates)
- Error handling testing (toast notifications)
- Responsive design testing (mobile/desktop)
- Keyboard navigation and accessibility

**Implementation Completed By:** Claude Sonnet 4.5
