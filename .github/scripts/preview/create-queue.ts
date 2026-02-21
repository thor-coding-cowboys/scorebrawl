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

const queueName = `scorebrawl-achievement-calculations-pr-${prNumber}`;

try {
	const cloudflare = new Cloudflare({ apiToken });
	let queueExists = false;
	for await (const queue of cloudflare.queues.list({ account_id: accountId })) {
		if (queue.queue_name === queueName) {
			queueExists = true;
			break;
		}
	}

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
