# Visual Web Review Prompt

Review pull request #$PR_NUMBER with a focus on visual and UI changes.

## Context

Screenshots have been captured and saved to `/tmp/web-screenshots/`:
- `dashboard-light.png`, `dashboard-dark.png`
- `activity-light.png`, `activity-dark.png`
- `chat-light.png`, `chat-dark.png`
- `*-a11y.txt` accessibility tree snapshots
- `manifest.json` with capture metadata

Read the screenshots and accessibility snapshots to understand the current UI state.

## How to Review

1. Read the PR diff: `gh pr diff $PR_NUMBER`
2. Read the screenshots from `/tmp/web-screenshots/`
3. Read accessibility snapshots for relevant pages

## What to Review

**Visual consistency:**
- Layout alignment and spacing
- Typography and color usage
- Component styling matches existing patterns

**Dark mode:**
- All elements visible and readable
- No hardcoded colors that break in dark mode
- Proper contrast ratios

**Accessibility:**
- Interactive elements have appropriate roles
- Proper heading hierarchy
- Form inputs have labels

**Responsiveness:**
- No obvious overflow issues
- Elements scale appropriately

## Comment Style

Write like a helpful colleague. Keep comments brief and actionable.

Good examples:
- `Button text hard to read in dark mode`
- `Missing label on input field`
- `Inconsistent spacing with other cards`
- `Heading jumps from h2 to h4`

Bad examples:
- Multi-paragraph explanations
- Severity tags like `[CRITICAL]`
- Restating what the screenshot shows

## Video Script Generation

After reviewing, create a video script that demonstrates the changes in this PR. The script should show what changed - navigate to affected pages, interact with new/changed elements, and demonstrate both light and dark modes if relevant.

## Output

Write your visual review findings. If no issues found, say so briefly. Don't pad the review with generic praise.

---

## JSON Output Format (CRITICAL)

You MUST return ONLY valid JSON matching this exact schema. Do not include any text before or after the JSON.

```json
{
  "review": "Markdown content with visual review findings",
  "video_script": {
    "title": "Brief description of what the video shows",
    "actions": [
      { "type": "navigate", "target": "/", "description": "Go to dashboard" },
      { "type": "wait", "value": "1000", "description": "Show the page" },
      { "type": "click", "target": "button.new-feature", "description": "Click new button" },
      { "type": "theme", "value": "dark", "description": "Switch to dark mode" }
    ]
  }
}
```

**Required fields:**
- `review`: Markdown content with visual review findings

**Optional fields:**
- `video_script`: Script for recording a demo video
  - `title`: What the video demonstrates
  - `actions`: Array of actions

**Action types:**
- `navigate`: Go to a URL path (target: "/path")
- `click`: Click an element (target: CSS selector)
- `type`: Type text into an input (target: selector, value: text)
- `wait`: Pause recording (value: milliseconds)
- `theme`: Switch theme (value: "light" or "dark")
- `scroll`: Scroll to element (target: selector) or scroll down (no target)

**Example output (with issues):**
```json
{
  "review": "## Visual Review Findings\n\n### Issues\n\n1. **Button contrast in dark mode** - The primary button on the chat page has low contrast (2.8:1) against the dark background. Consider using a lighter shade.\n\n2. **Inconsistent spacing** - The new card component uses 16px padding while existing cards use 24px.\n\n### Notes\n\nThe responsive behavior looks good on mobile widths.",
  "video_script": {
    "title": "New chat feature demo",
    "actions": [
      { "type": "navigate", "target": "/chat", "description": "Go to chat" },
      { "type": "wait", "value": "1000", "description": "Show light mode" },
      { "type": "theme", "value": "dark", "description": "Switch to dark mode" },
      { "type": "wait", "value": "1000", "description": "Show dark mode" }
    ]
  }
}
```

**Example output (no issues):**
```json
{
  "review": "No visual issues found. The changes look consistent with existing patterns and work well in both light and dark modes."
}
```
