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

const buckets = [`scorebrawl-user-assets-pr-${prNumber}`];

// Check if buckets exist using Cloudflare SDK
try {
	const cloudflare = new Cloudflare({
		apiToken,
	});

	const existingBucketsList = await cloudflare.r2.buckets.list({
		account_id: accountId,
	});

	const existingBuckets = new Set(existingBucketsList.buckets?.map((bucket) => bucket.name) ?? []);

	for (const bucketName of buckets) {
		if (existingBuckets.has(bucketName)) {
			console.log(`Processing R2 bucket: ${bucketName}`);

			try {
				// First, remove all objects from the bucket using Wrangler CLI
				console.log(`Removing all objects from bucket: ${bucketName}`);

				// Use Wrangler to delete all objects in the bucket
				try {
					await $`bun wrangler r2 object delete --bucket ${bucketName} --prefix ""`.quiet();
					console.log(`Removed all objects from bucket: ${bucketName}`);
				} catch {
					// If the bucket is empty or the delete fails, continue with bucket deletion
					console.log(`No objects found or failed to delete objects from bucket: ${bucketName}`);
				}

				// Now delete the empty bucket using Wrangler CLI
				console.log(`Deleting R2 bucket: ${bucketName}`);
				await $`bun wrangler r2 bucket delete ${bucketName}`.quiet();
				console.log(`Successfully deleted bucket: ${bucketName}`);
			} catch (error) {
				console.error(`Failed to delete R2 bucket ${bucketName}:`, error);
			}
		} else {
			console.log(`R2 bucket not found: ${bucketName}`);
		}
	}
} catch (error) {
	console.error("Failed to list/delete buckets:", error);
	process.exit(1);
}
