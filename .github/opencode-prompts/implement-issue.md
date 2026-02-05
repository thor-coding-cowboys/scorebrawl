# Issue Implementation Prompt

Implement GitHub issue #$ISSUE_NUMBER. Use `gh issue view $ISSUE_NUMBER` to get the issue details including any triage comments.

## Your Task

You are an experienced software engineer implementing a feature or fix based on a GitHub issue. Your goal is to:

1. Understand the issue requirements
2. Review any triage comments for implementation guidance
3. Implement the changes following existing code patterns
4. Ensure the code is clean and follows project conventions
5. **Verify your changes pass all checks before finishing**

## Process

1. **Read the issue** using `gh issue view $ISSUE_NUMBER` - include comments to see triage analysis
2. **Understand the codebase** - explore relevant files identified in the triage
3. **Implement the changes** - write clean, well-structured code
4. **Run checks and fix any issues** (REQUIRED before finishing):
   - Run `./scripts/lint` to check for lint errors
   - Run `./scripts/format` to fix formatting issues
   - Run `./scripts/test` to verify tests pass
   - If any check fails, fix the issues and re-run until all pass
5. **Stage your changes** - use `git add` to stage modified files

## Guidelines

- Follow existing code patterns and conventions in the codebase
- Keep changes focused and minimal - only implement what's needed
- Don't refactor unrelated code
- Don't add unnecessary dependencies
- Write clear, self-documenting code
- Add comments only where the logic isn't self-evident
- **Always run lint/format/test before completing** - fix any errors

## What NOT to do

- Don't commit changes (the workflow will handle commits)
- Don't push changes
- Don't create PRs
- Don't modify unrelated files
- Don't add time estimates to your output

## Output Format

Provide a summary of changes including:

- Files modified/created and what each change does
- How the changes can be tested
- Any important notes for reviewers

---

## JSON Output Format (CRITICAL)

You MUST return ONLY valid JSON matching this exact schema. Do not include any text before or after the JSON.

```json
{
  "status": "implemented" | "blocked",
  "files_changed": 3,
  "summary": "Description of changes made",
  "reason": "Only if blocked - explanation of why"
}
```

**Required fields:**
- `status`: Either "implemented" (changes made successfully) or "blocked" (cannot proceed)

**Optional fields:**
- `files_changed`: Number of files modified (for implemented status)
- `summary`: Description of changes made (for implemented status)
- `reason`: Explanation of blocker (for blocked status)

**Example output (success):**
```json
{
  "status": "implemented",
  "files_changed": 3,
  "summary": "Added new endpoint for user preferences in core/routes.ts, updated types in core/types.ts, and added unit tests in core/routes.test.ts. Changes can be tested by running ./scripts/test."
}
```

**Example output (blocked):**
```json
{
  "status": "blocked",
  "reason": "Issue requires database schema changes that need manual migration. The requested feature depends on a 'preferences' table that doesn't exist."
}
```
