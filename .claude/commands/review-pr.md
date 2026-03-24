---
allowed-tools: Bash(gh pr diff:*),Bash(gh pr view:*),Read(*),Glob(*)
description: Review a pull request
---

Review pull request #$ARGUMENTS. Use `gh pr diff $ARGUMENTS` and `gh pr view $ARGUMENTS` to get the PR details.

## What to Review

**Block merge for:**

- Bugs that will cause runtime failures
- Security vulnerabilities
- Data loss or corruption risks
- Logic errors producing incorrect results
- N+1 queries (critical for Cloudflare Workers)
- Missing tRPC procedure auth checks when they should exist
- Missing Hono route validation with @hono/zod-validator
- TanStack Router file organization issues (routes without prefix, non-routes with - prefix)
- @ts-expect-error or @ts-ignore usage
- Missing catalog usage for workspace dependencies

**Flag but don't block:**

- Missing error handling for likely cases
- Test coverage gaps
- Performance concerns

**Skip entirely:**

- Style nitpicks (leave to linters)
- Subjective preferences
- Theoretical edge cases

## Review Checklist

**Code Quality:**
- Clean separation of concerns?
- Proper error handling?
- Type safety (if applicable)?
- DRY principle followed?
- Edge cases handled?

**Architecture:**
- Sound design decisions?
- Scalability considerations?
- Performance implications?
- Security concerns?

**Testing:**
- Tests actually test logic (not mocks)?
- Edge cases covered?
- Integration tests where needed?
- All tests passing?

**Requirements:**
- All plan requirements met?
- Implementation matches spec?
- No scope creep?
- Breaking changes documented?

**Production Readiness:**
- Migration strategy (if schema changes)?
- Backward compatibility considered?
- Documentation complete?
- No obvious bugs?

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

## Output Format

### Strengths
[What's well done? Be specific.]

### Issues

#### Critical (Must Fix)
[Bugs, security issues, data loss risks, broken functionality]

#### Important (Should Fix)
[Architecture problems, missing features, poor error handling, test gaps]

#### Minor (Nice to Have)
[Code style, optimization opportunities, documentation improvements]

**For each issue:**
- File:line reference
- What's wrong
- Why it matters
- How to fix (if not obvious)

### Recommendations
[Improvements for code quality, architecture, or process]

### Assessment

**Ready to merge?** [Yes/No/With fixes]

**Reasoning:** [Technical assessment in 1-2 sentences]

## Critical Rules

**DO:**
- Categorize by actual severity (not everything is Critical)
- Be specific (file:line, not vague)
- Explain WHY issues matter
- Acknowledge strengths
- Give clear verdict

**DON'T:**
- Say "looks good" without checking
- Mark nitpicks as Critical
- Give feedback on code you didn't review
- Be vague ("improve error handling")
- Avoid giving a clear verdict

## Structured Output

Your response will be captured as structured JSON with these fields:

- `verdict`: "approve" or "request-changes"
- `summary`: Brief summary of blocking issues (for request-changes)
- `comments`: Array of inline comments, each with `path`, `line`, `body`

For `comments`, use the line number from the new version of the file (the `+` lines in the diff).
