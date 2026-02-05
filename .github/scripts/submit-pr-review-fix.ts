#!/usr/bin/env bun
import { $ } from "bun";
import { extractJsonFromFile } from "./utils/extract-json";

interface FixedOutput {
	status: "fixed";
	summary?: string;
}

interface BlockedOutput {
	status: "blocked";
	reason?: string;
}

type FixOutput = FixedOutput | BlockedOutput;

async function hasChanges(): Promise<boolean> {
	const result = await $`git status --porcelain`.text();
	return result.trim().length > 0;
}

async function main() {
	const jsonFile = Bun.argv[2];
	if (!jsonFile) {
		console.error("Usage: submit-pr-review-fix.ts <json-file>");
		process.exit(1);
	}

	const prNumber = process.env.PR_NUMBER;
	const branchName = process.env.BRANCH_NAME;

	if (!prNumber) {
		console.error("PR_NUMBER environment variable is required");
		process.exit(1);
	}

	if (!branchName) {
		console.error("BRANCH_NAME environment variable is required");
		process.exit(1);
	}

	let output: FixOutput;
	try {
		output = await extractJsonFromFile<FixOutput>(jsonFile);
	} catch (e) {
		console.error("Failed to parse structured output:", e);
		process.exit(1);
	}

	if (output.status === "blocked") {
		console.log(`Fix blocked: ${output.reason}`);
		await $`gh pr comment ${prNumber} --body ${`**Blocked:** ${output.reason ?? "Unknown"}`}`;
		process.exit(0);
	}

	if (!(await hasChanges())) {
		process.exit(0);
	}

	await $`git add -A`;
	await $`git commit -m ${"fix: address review feedback"}`;
	await $`git push origin ${branchName}`;
}

main();
