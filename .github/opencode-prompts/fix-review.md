# Fix PR Review Feedback Prompt

Fix the review feedback on pull request #$PR_NUMBER.

## Context

This PR was created by the automated issue implementation workflow. A reviewer has requested changes. Your job is to address the feedback and fix the issues.

## Steps

1. **Get the review feedback**

   ```bash
   gh pr view $PR_NUMBER --json reviews --jq '.reviews[] | select(.state == "CHANGES_REQUESTED") | .body'
   ```

2. **Understand the PR changes**

   ```bash
   gh pr diff $PR_NUMBER
   ```

3. **Fix the issues**
   - Read the relevant files
   - Make the necessary changes to address the feedback
   - Ensure your changes don't break existing functionality

4. **Verify your changes**
   - Run linting: `./scripts/lint`
   - Run formatting: `./scripts/format`
   - Run tests: `./scripts/test`
   - Fix any errors before finishing

## Guidelines

- Focus only on fixing what the reviewer requested
- Don't make unrelated changes or improvements
- Keep changes minimal and targeted
- If the feedback is unclear, make your best judgment based on the code context

## Output

Provide a brief summary of what you fixed. Do NOT commit the changes - the workflow will handle that.

---

## JSON Output Format (CRITICAL)

You MUST return ONLY valid JSON matching this exact schema. Do not include any text before or after the JSON.

```json
{
  "status": "fixed" | "blocked",
  "summary": "Description of fixes made",
  "reason": "Only if blocked - explanation of why"
}
```

**Required fields:**
- `status`: Either "fixed" (feedback addressed) or "blocked" (cannot fix)

**Optional fields:**
- `summary`: Description of fixes made (for fixed status)
- `reason`: Explanation of blocker (for blocked status)

**Example output (success):**
```json
{
  "status": "fixed",
  "summary": "Added null check for user object and wrapped API call in try/catch as requested"
}
```

**Example output (blocked):**
```json
{
  "status": "blocked",
  "reason": "Reviewer requested use of a library that isn't installed and adding it would require approval"
}
```
