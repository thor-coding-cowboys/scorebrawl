#!/usr/bin/env bun

import { $ } from "bun";

const prNumber = process.env.PR_NUMBER;
if (!prNumber) {
	console.error("PR_NUMBER environment variable is required");
	process.exit(1);
}

const queueName = `achievement-calculations-pr-${prNumber}`;

// Check if queue exists
try {
	const listResult = await $`bun wrangler queues list --json`.quiet();
	const queues = JSON.parse(listResult.stdout.toString());
	const queueExists = queues.find((q: { queue_name: string }) => q.queue_name === queueName);

	if (queueExists) {
		console.log(`Deleting queue: ${queueName}`);
		await $`bun wrangler queues delete ${queueName}`.quiet();
	} else {
		console.log(`Queue not found: ${queueName}`);
	}
} catch {
	console.log("Failed to list queues, assuming queue doesn't exist");
	process.exit(0);
}
