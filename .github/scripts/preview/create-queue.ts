#!/usr/bin/env bun

import { $ } from "bun";

const prNumber = process.env.PR_NUMBER;
if (!prNumber) {
	console.error("PR_NUMBER environment variable is required");
	process.exit(1);
}

const queueName = `achievement-calculations-pr-${prNumber}`;

try {
	const listResult = await $`bun wrangler queues list --json`.quiet();
	const queues = JSON.parse(listResult.stdout.toString());
	const queueExists = queues.some(
		(q: { queue_name: string }) => q.queue_name === queueName,
	);

	if (queueExists) {
		console.log(`Queue already exists: ${queueName}`);
	} else {
		console.log(`Creating queue: ${queueName}`);
		await $`bun wrangler queues create ${queueName}`.quiet();
		console.log(`Queue created: ${queueName}`);
	}
} catch (error) {
	console.error("Failed to list/create queue:", error);
	process.exit(1);
}

// Output for GitHub Actions
const githubOutput = process.env.GITHUB_OUTPUT;
if (githubOutput) {
	const file = Bun.file(githubOutput);
	const existing = (await file.exists()) ? await file.text() : "";
	await Bun.write(githubOutput, `${existing}queue_name=${queueName}\n`);
}
