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

const buckets = [{ name: `scorebrawl-user-assets-pr-${prNumber}`, outputKey: "bucket_name" }];

// Check if buckets already exist using Cloudflare SDK
try {
	const cloudflare = new Cloudflare({
		apiToken,
	});

	const existingBucketsList = await cloudflare.r2.buckets.list({
		account_id: accountId,
	});

	const existingBuckets = new Set(existingBucketsList.buckets?.map((bucket) => bucket.name) ?? []);

	for (const bucket of buckets) {
		if (existingBuckets.has(bucket.name)) {
			console.log(`R2 bucket already exists: ${bucket.name}`);
		} else {
			console.log(`Creating R2 bucket: ${bucket.name}`);
			await $`bun wrangler r2 bucket create ${bucket.name}`.quiet();
		}
	}
} catch (error) {
	console.error("Failed to list/create buckets:", error);
	process.exit(1);
}

// Output for GitHub Actions
const githubOutput = process.env.GITHUB_OUTPUT;
if (githubOutput) {
	const file = Bun.file(githubOutput);
	const existing = (await file.exists()) ? await file.text() : "";
	let output = existing;
	for (const bucket of buckets) {
		output += `${bucket.outputKey}=${bucket.name}\n`;
	}
	await Bun.write(githubOutput, output);
}
