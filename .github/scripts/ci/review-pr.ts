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

const REVIEW_PROMPT = `Review this PR diff for a Cloudflare Worker + TanStack Router monorepo (Bun runtime).

## Block merge for
- Runtime bugs, security vulnerabilities, data loss risks, logic errors
- N+1 queries — Cloudflare Workers have strict CPU limits; always use joins/subqueries
- Redundant auth checks in tRPC: protectedProcedure/activeOrgProcedure already guarantee user — never re-check
- Missing @hono/zod-validator validation on Hono routes (json/query/header/param)
- @ts-expect-error or @ts-ignore usage
- Workspace dependencies not using catalog (must be "catalog:" in package.json)
- TanStack Router violations: non-route files in routes/ without "-" prefix, or route files incorrectly prefixed
- Using npm/yarn/pnpm instead of bun; running \`bun test\` instead of \`bun run test\`; running \`bun deploy\`

## Flag but don't block
- Missing error handling for likely cases
- Test coverage gaps for new tRPC routes
- Performance concerns outside CPU-limit risk

## Skip entirely
- Style/formatting (leave to oxlint/oxfmt)
- Subjective preferences, theoretical edge cases

## Comment style
Write like a helpful colleague. One sentence max. Question format for suggestions.
- Good: "Is this leftover?" / "Should this be async?" / "Read from env?"
- Bad: multi-paragraph, severity tags, restating what code does before critiquing
- Never flag dollar-sign backtick as incorrect — that is valid Bun shell syntax

## Rules
- Be specific (file:line)
- Only give a verdict on code you actually reviewed
- Not everything is blocking — categorize honestly

PR Diff:
\`\`\`diff
{{DIFF}}
\`\`\`

Respond as JSON matching the schema. Use line numbers from the new file version (the + lines).`;

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
