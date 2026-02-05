#!/usr/bin/env bun
import { $ } from "bun";
import { extractJsonFromFile } from "./utils/extract-json";

interface ImplementedOutput {
	status: "implemented";
	files_changed?: number;
	summary?: string;
}

interface BlockedOutput {
	status: "blocked";
	reason?: string;
}

type ImplementationOutput = ImplementedOutput | BlockedOutput;

async function hasChanges(): Promise<boolean> {
	const result = await $`git status --porcelain`.text();
	return result.trim().length > 0;
}

async function main() {
	const jsonFile = Bun.argv[2];
	if (!jsonFile) {
		console.error("Usage: submit-issue-implementation.ts <json-file>");
		process.exit(1);
	}

	const issueNumber = process.env.ISSUE_NUMBER;
	const branchName = process.env.BRANCH_NAME;

	if (!issueNumber) {
		console.error("ISSUE_NUMBER environment variable is required");
		process.exit(1);
	}

	if (!branchName) {
		console.error("BRANCH_NAME environment variable is required");
		process.exit(1);
	}

	let output: ImplementationOutput;
	try {
		output = await extractJsonFromFile<ImplementationOutput>(jsonFile);
	} catch (e) {
		console.error("Failed to parse structured output:", e);
		process.exit(1);
	}

	if (output.status === "blocked") {
		console.log(`Implementation blocked: ${output.reason}`);
		await $`gh issue comment ${issueNumber} --body ${`**Blocked:** ${output.reason ?? "Unknown"}`}`;
		process.exit(0);
	}

	if (!(await hasChanges())) {
		console.log("No changes to commit");
		await $`gh issue comment ${issueNumber} --body ${"No code changes made. Manual implementation may be needed."}`;
		process.exit(0);
	}

	const issueTitle =
		await $`gh issue view ${issueNumber} --json title --jq '.title'`.text();

	await $`git add -A`;
	await $`git commit -m ${`feat: ${issueTitle.trim()}\n\nCloses #${issueNumber}`}`;
	await $`git push -u origin ${branchName}`;

	const prBody = output.summary
		? `${output.summary}\n\nFixes #${issueNumber}`
		: `Fixes #${issueNumber}`;
	const prUrl =
		await $`gh pr create --title ${issueTitle.trim()} --body ${prBody} --head ${branchName}`.text();
	const prNumberMatch = prUrl.trim().match(/\/pull\/(\d+)$/);
	if (!prNumberMatch) {
		console.error("Failed to extract PR number from URL:", prUrl);
		process.exit(1);
	}
	const prNumber = prNumberMatch[1];

	await $`gh pr edit ${prNumber} --add-label "claude-automated"`;
	await $`gh pr merge ${prNumber} --auto --squash`;
	console.log(prUrl.trim());
}

main();
