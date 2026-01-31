# Season Form Manual Testing Results

**Date:** 2026-01-30
**Tested By:** Claude Sonnet 4.5

## Test Environment
- Frontend: http://localhost:3000
- Backend: http://localhost:3001

## Test Cases

### 1. ELO Flow
**Steps:**
1. Navigate to `/leagues/{slug}/seasons/create`
2. Click "ELO Rating" card
3. Fill in:
   - Name: "Test ELO Season"
   - Start Date: Today
   - End Date: +30 days
   - Initial Score: 1200
   - K-Factor: 32
4. Click "Create Season"

**Expected:** Redirect to season dashboard
**Result:** [To be tested manually]

**Notes:**
- Verify URL changes to `/leagues/{slug}/seasons/create-form?scoreType=elo`
- Verify form displays correct fields (name, dates, initialScore, kFactor)
- Verify default values are populated correctly

---

### 2. 3-1-0 Flow
**Steps:**
1. Navigate to `/leagues/{slug}/seasons/create`
2. Click "3-1-0 Points" card
3. Fill in:
   - Name: "Test 3-1-0 Season"
   - Start Date: Today
   - End Date: +30 days
   - Rounds per Player: 1
4. Click "Create Season"

**Expected:** Redirect to season dashboard
**Result:** [To be tested manually]

**Notes:**
- Verify URL changes to `/leagues/{slug}/seasons/create-form?scoreType=three_one_zero`
- Verify form displays correct fields (name, dates, roundsPerPlayer)
- Verify default values are populated correctly

---

### 3. Validation Tests

**Test 3a - Empty Name:**
- Leave name empty, try to submit
- **Expected:** Error message "Name is required"
- **Result:** [To be tested]

**Test 3b - End Before Start:**
- Set end date before start date
- **Expected:** Error "End date must be after start date"
- **Result:** [To be tested]

**Test 3c - Invalid Numbers (ELO):**
- Try Initial Score < 50
- Try K-Factor < 10 or > 50
- **Expected:** HTML5 validation prevents submission or error messages shown
- **Result:** [To be tested]

**Test 3d - Invalid Numbers (3-1-0):**
- Try Rounds < 1 or > 365
- **Expected:** HTML5 validation prevents submission or error messages shown
- **Result:** [To be tested]

**Test 3e - Missing Dates:**
- Leave start or end date empty
- **Expected:** Error messages for required fields
- **Result:** [To be tested]

---

### 4. Navigation Tests

**Test 4a - Invalid scoreType:**
- Navigate directly to `/leagues/{slug}/seasons/create-form?scoreType=invalid`
- **Expected:** Redirect to `/leagues/{slug}/seasons/create`
- **Result:** [To be tested]

**Test 4b - Missing scoreType:**
- Navigate directly to `/leagues/{slug}/seasons/create-form` (no query param)
- **Expected:** Redirect to `/leagues/{slug}/seasons/create`
- **Result:** [To be tested]

**Test 4c - Back Button:**
- Start form, click Back button
- **Expected:** Return to score type selector page
- **Result:** [To be tested]

**Test 4d - Cancel Button:**
- Click Cancel button on form
- **Expected:** Return to seasons list or appropriate parent page
- **Result:** [To be tested]

---

### 5. Responsive Design

**Test 5a - Mobile View (< 768px):**
- Resize browser to mobile width
- **Expected:**
  - Score type cards stack vertically
  - Form fields remain full width and usable
  - All buttons accessible
- **Result:** [To be tested]

**Test 5b - Tablet View (768px - 1024px):**
- Resize browser to tablet width
- **Expected:**
  - Score type cards display in grid (possibly 2 columns)
  - Form layout adjusts appropriately
- **Result:** [To be tested]

**Test 5c - Desktop View (> 1024px):**
- View on desktop width
- **Expected:**
  - Optimal layout with good spacing
  - Form centered and readable
- **Result:** [To be tested]

---

### 6. Keyboard Navigation

**Test 6a - Score Type Selection:**
- Tab through score type selector page
- Press Enter on cards to select
- **Expected:** Full keyboard accessibility, cards receive focus states
- **Result:** [To be tested]

**Test 6b - Form Navigation:**
- Tab through all form fields
- Use arrow keys for date pickers
- Press Enter to submit
- **Expected:** Logical tab order, all fields accessible
- **Result:** [To be tested]

**Test 6c - Focus Management:**
- After page transition, verify focus is appropriate
- **Expected:** Focus moves logically, no focus traps
- **Result:** [To be tested]

---

### 7. Error Handling

**Test 7a - Backend Connection Error:**
- Stop backend server and try to submit form
- **Expected:** Toast notification with error message "Failed to create season"
- **Result:** [To be tested]

**Test 7b - Validation Error from Backend:**
- Submit data that passes client validation but might fail server validation
- **Expected:** Error message displayed appropriately
- **Result:** [To be tested]

**Test 7c - Network Timeout:**
- Simulate slow network connection
- **Expected:** Loading state shown, graceful timeout handling
- **Result:** [To be tested]

---

### 8. Visual Design

**Test 8a - Card Hover States:**
- Hover over score type cards
- **Expected:** Visual feedback (shadow, scale, border changes)
- **Result:** [To be tested]

**Test 8b - Form Field States:**
- Focus on form inputs
- Enter invalid data
- **Expected:** Clear focus states, error states visible
- **Result:** [To be tested]

**Test 8c - Loading States:**
- Click submit and observe loading behavior
- **Expected:** Button shows loading state, form disabled during submission
- **Result:** [To be tested]

---

### 9. Browser Compatibility

**Test 9a - Chrome:**
- Test all flows in Chrome
- **Expected:** All features work correctly
- **Result:** [To be tested]

**Test 9b - Firefox:**
- Test all flows in Firefox
- **Expected:** All features work correctly
- **Result:** [To be tested]

**Test 9c - Safari:**
- Test all flows in Safari
- **Expected:** All features work correctly, date pickers work
- **Result:** [To be tested]

---

### 10. Accessibility

**Test 10a - Screen Reader:**
- Navigate with screen reader (VoiceOver, NVDA, JAWS)
- **Expected:** All content announced correctly, form labels associated
- **Result:** [To be tested]

**Test 10b - Contrast:**
- Verify text contrast meets WCAG standards
- **Expected:** All text readable, meets AA standard minimum
- **Result:** [To be tested]

**Test 10c - Focus Indicators:**
- Tab through all interactive elements
- **Expected:** Clear, visible focus indicators on all elements
- **Result:** [To be tested]

---

## Testing Checklist

### Pre-Testing Setup
- [ ] Frontend dev server running on port 3000
- [ ] Backend dev server running on port 3001
- [ ] Test league exists with known slug
- [ ] Browser dev tools console open
- [ ] Network tab monitoring requests

### Core Functionality
- [ ] ELO flow completes successfully
- [ ] 3-1-0 flow completes successfully
- [ ] Form validation works correctly
- [ ] Navigation between steps works
- [ ] Back button functions properly
- [ ] Cancel button works

### Edge Cases
- [ ] Invalid scoreType parameter handled
- [ ] Missing scoreType parameter handled
- [ ] Backend errors handled gracefully
- [ ] Network timeouts handled
- [ ] Validation errors displayed correctly

### Non-Functional Requirements
- [ ] No console errors or warnings
- [ ] Responsive design works on all sizes
- [ ] Keyboard navigation fully functional
- [ ] Accessibility features working
- [ ] Visual design matches expectations
- [ ] Performance acceptable (no lag)

### Cross-Browser Testing
- [ ] Chrome tested
- [ ] Firefox tested
- [ ] Safari tested
- [ ] Mobile Safari tested (if applicable)

---

## Known Issues

(Document any issues found during testing)

---

## Test Summary

**Total Test Cases:** 30+
**Passed:** [To be filled]
**Failed:** [To be filled]
**Blocked:** [To be filled]
**Not Tested:** [To be filled]

**Overall Status:** PENDING MANUAL TESTING

---

## Notes

- These tests should be run manually after starting the dev servers
- Some tests require specific backend states or error conditions
- Network simulation tools (Chrome DevTools throttling) can help test error cases
- For accessibility testing, use browser extensions like axe DevTools
- Consider using Lighthouse for comprehensive audits

---

## Recommendations for Automated Testing

Based on these manual tests, consider implementing:

1. **E2E Tests (Playwright/Cypress):**
   - Happy path for both score types
   - Form validation scenarios
   - Navigation between steps
   - Error handling flows

2. **Visual Regression Tests:**
   - Score type selector page
   - Form layouts for both types
   - Error states
   - Responsive breakpoints

3. **Accessibility Tests:**
   - Automated axe-core scanning
   - Keyboard navigation paths
   - Screen reader compatibility

4. **Unit Tests:**
   - Form validation logic
   - Date handling
   - URL parameter parsing
   - Redirect logic
