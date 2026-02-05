# PR Review Prompt

Review pull request #$PR_NUMBER. Use `gh pr diff $PR_NUMBER` and `gh pr view $PR_NUMBER` to get the PR details.

## What to Review

**Block merge for:**

- Bugs that will cause runtime failures
- Security vulnerabilities
- Data loss or corruption risks
- Logic errors producing incorrect results

**Flag but don't block:**

- Missing error handling for likely cases
- Test coverage gaps
- Performance concerns

**Skip entirely:**

- Style nitpicks (leave to linters)
- Subjective preferences
- Theoretical edge cases

## Comment Style

Write like a helpful colleague, not a linter. Keep comments brief.

Good examples:

- `Is this leftover?`
- `Read from env?`
- `Should this be async?`
- `No need for this if X.`

Bad examples:

- Multi-paragraph explanations
- `**[SEVERITY]** Title` format
- Restating what the code does before critiquing

Rules:

- One sentence max for simple issues
- Question format when suggesting: `Should this be X?`
- No severity tags
- Ask, don't tell when it's not a clear bug

---

## JSON Output Format (CRITICAL)

You MUST return ONLY valid JSON matching this exact schema. Do not include any text before or after the JSON.

```json
{
  "verdict": "approve" | "request-changes",
  "summary": "Brief summary of blocking issues",
  "comments": [
    {
      "path": "path/to/file.ts",
      "line": 42,
      "body": "Review comment text"
    }
  ]
}
```

**Required fields:**
- `verdict`: Either "approve" (no blocking issues) or "request-changes" (has blocking issues)

**Optional fields:**
- `summary`: Brief summary of blocking issues (for request-changes verdict)
- `comments`: Array of inline comments with path, line, and body

**For `comments`, use the line number from the new version of the file (the `+` lines in the diff).**

**Example output (approve):**
```json
{
  "verdict": "approve"
}
```

**Example output (request changes):**
```json
{
  "verdict": "request-changes",
  "summary": "Potential null pointer and missing error handling",
  "comments": [
    {
      "path": "src/api/handler.ts",
      "line": 45,
      "body": "This can be null if the user doesn't exist"
    },
    {
      "path": "src/api/handler.ts",
      "line": 52,
      "body": "Missing try/catch for the API call"
    }
  ]
}
```
