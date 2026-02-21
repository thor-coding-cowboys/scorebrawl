#!/usr/bin/env bun

import { $ } from "bun";

const prNumber = process.env.PR_NUMBER;
if (!prNumber) {
	console.error("PR_NUMBER environment variable is required");
	process.exit(1);
}

const queueName = `achievement-calculations-pr-${prNumber}`;

try {
	console.log(`Creating queue: ${queueName}`);
	await $`bun wrangler queues create ${queueName}`.quiet();
	console.log(`Queue created: ${queueName}`);
} catch (error) {
	const stderr =
		error instanceof Error && "stderr" in error
			? String((error as { stderr: unknown }).stderr)
			: "";
	if (stderr.includes("already exists")) {
		console.log(`Queue already exists: ${queueName}`);
	} else {
		console.error("Failed to create queue:", error);
		process.exit(1);
	}
}

// Output for GitHub Actions
const githubOutput = process.env.GITHUB_OUTPUT;
if (githubOutput) {
	const file = Bun.file(githubOutput);
	const existing = (await file.exists()) ? await file.text() : "";
	await Bun.write(githubOutput, `${existing}queue_name=${queueName}\n`);
}
