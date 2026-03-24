#!/usr/bin/env bun
import { createOpencode } from "@opencode-ai/sdk/v2";
import { $ } from "bun";

const prNumber = process.argv[2];
if (!prNumber) {
	console.error("Usage: review-pr.ts <pr-number>");
	process.exit(1);
}

const repo = process.env.GITHUB_REPOSITORY;
if (!repo) {
	console.error("GITHUB_REPOSITORY required");
	process.exit(1);
}

async function getPrDiff(): Promise<string> {
	try {
		return await $`gh pr diff ${prNumber}`.text();
	} catch (error) {
		console.error("Failed to get PR diff:", error);
		process.exit(1);
	}
}

const REVIEW_PROMPT = `Review this PR diff and provide structured feedback.

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
- Is this leftover?
- Read from env?
- Should this be async?
- No need for this if X.

Bad examples:
- Multi-paragraph explanations
- **[SEVERITY]** Title format
- Restating what the code does before critiquing

Rules:
- One sentence max for simple issues
- Question format when suggesting: Should this be X?
- No severity tags
- Ask, don't tell when it's not a clear bug

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
- Flag shell template literal syntax as incorrect - dollar-sign followed by backtick is valid Bun syntax for shell execution

PR Diff:
\`\`\`diff
{{DIFF}}
\`\`\`

Provide your review as JSON matching the schema. For comments, use the line number from the new version of the file (the + lines in the diff).`;

async function main() {
	try {
		const diff = await getPrDiff();

		console.log("Starting OpenCode review...");

		const { client, server } = await createOpencode({
			timeout: 60000,
		});

		// Create session
		const sessionResult = await client.session.create({
			title: `PR Review #${prNumber}`,
		});

		if (sessionResult.error) {
			console.error("Failed to create session:", sessionResult.error);
			await server.close();
			process.exit(1);
		}

		const sessionId = sessionResult.data.id;

		// Send prompt with structured output
		const result = await client.session.prompt({
			sessionID: sessionId,
			model: {
				// providerID: "opencode-go",
				// modelID: "minimax-m2.7",
				providerID: "opencode",
				modelID: "big-pickle",
			},
			parts: [
				{
					type: "text",
					text: REVIEW_PROMPT.replace("{{DIFF}}", diff),
				},
			],
			format: {
				type: "json_schema",
				schema: {
					type: "object",
					properties: {
						verdict: {
							type: "string",
							enum: ["approve", "request-changes"],
							description:
								"Your final verdict: 'approve' if no significant issues, 'request-changes' if issues found",
						},
						summary: {
							type: "string",
							description: "Brief summary of blocking issues (for request-changes). 2-3 sentences.",
						},
						comments: {
							type: "array",
							items: {
								type: "object",
								properties: {
									path: {
										type: "string",
										description: "File path relative to repo root (e.g., 'src/index.ts')",
									},
									line: {
										type: "integer",
										description: "Line number (1-based) where the issue is",
									},
									body: {
										type: "string",
										description:
											"Comment explaining the issue. Brief, helpful tone. One sentence max.",
									},
								},
								required: ["path", "line", "body"],
							},
							description:
								"Specific line-level comments. Use line number from new version (+ lines in diff). Empty array if approving.",
						},
					},
					required: ["verdict", "summary", "comments"],
				},
				retryCount: 3,
			},
		});

		if (result.error) {
			console.error("OpenCode error:", result.error);
			await server.close();
			process.exit(1);
		}

		// Try to get structured output
		const assistantMessage = result.data.info;
		let output = assistantMessage.structured;

		// Fallback: try to parse from text parts if structured is not available
		if (!output) {
			// Look for text parts that might contain JSON
			const textParts = result.data.parts.filter((p) => p.type === "text");

			for (const part of textParts) {
				const text = part.text || "";
				// Try to find JSON in the text
				const jsonMatch = text.match(/\{[\s\S]*\}/);
				if (jsonMatch) {
					try {
						const parsed = JSON.parse(jsonMatch[0]);
						if (parsed.verdict && parsed.summary !== undefined && parsed.comments !== undefined) {
							output = parsed;
							break;
						}
					} catch {
						// Not valid JSON, continue
					}
				}
			}

			// Last resort: if no JSON found, fail
			if (!output) {
				console.error(
					"Failed to get structured output:",
					"\nError name:",
					assistantMessage.error?.name,
					"\nError data:",
					JSON.stringify(assistantMessage.error?.data, null, 2)
				);
				await server.close();
				process.exit(1);
			}
		}

		console.log(JSON.stringify(output, null, 2));

		// Write to GITHUB_OUTPUT if available
		if (process.env.GITHUB_OUTPUT) {
			await Bun.write(process.env.GITHUB_OUTPUT, `structured_output=${JSON.stringify(output)}\n`);
		}

		// Cleanup
		await client.session.delete({ sessionID: sessionId });
		await server.close();
	} catch (error) {
		console.error("Error:", error);
		process.exit(1);
	}
}

main();
