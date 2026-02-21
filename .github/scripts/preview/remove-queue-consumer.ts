#!/usr/bin/env bun

import { $ } from "bun";
import { Cloudflare } from "cloudflare";

const prNumber = process.env.PR_NUMBER;
const apiToken = process.env.CLOUDFLARE_API_TOKEN;
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;

if (!prNumber) {
	console.error("PR_NUMBER environment variable is required");
	process.exit(1);
}

if (!apiToken || !accountId) {
	console.error("CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID are required");
	process.exit(1);
}

const queueName = `achievement-calculations-pr-${prNumber}`;
const workerName = `scorebrawl-pr-${prNumber}`;

try {
	const cloudflare = new Cloudflare({ apiToken });

	// Check if queue exists
	let queueExists = false;
	for await (const queue of cloudflare.queues.list({ account_id: accountId })) {
		if (queue.queue_name === queueName) {
			queueExists = true;
			break;
		}
	}

	if (queueExists) {
		console.log(`Removing ${workerName} as consumer from queue: ${queueName}`);
		await $`bun wrangler queues consumer remove ${queueName} ${workerName}`.quiet();
		console.log(`Removed ${workerName} as consumer from queue ${queueName}`);
	} else {
		console.log(`Queue not found: ${queueName}`);
	}
} catch (error) {
	console.log("Failed to remove queue consumer:", error);
	process.exit(0);
}
