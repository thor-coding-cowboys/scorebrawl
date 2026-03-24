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

const achievementQueueName = `scorebrawl-achievement-calculations-pr-${prNumber}`;
const seedQueueName = `scorebrawl-seed-queue-pr-${prNumber}`;

const cloudflare = new Cloudflare({ apiToken });

async function deleteQueue(queueName: string): Promise<void> {
	let queueExists = false;
	for await (const queue of cloudflare.queues.list({ account_id: accountId! })) {
		if (queue.queue_name === queueName) {
			queueExists = true;
			break;
		}
	}

	if (queueExists) {
		console.log(`Deleting queue: ${queueName}`);
		await $`bun wrangler queues delete ${queueName}`.quiet();
	} else {
		console.log(`Queue not found: ${queueName}`);
	}
}

try {
	await deleteQueue(achievementQueueName);
	await deleteQueue(seedQueueName);
} catch {
	console.log("Failed to list/delete queues, assuming they don't exist");
	process.exit(0);
}
