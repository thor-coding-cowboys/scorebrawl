#!/usr/bin/env bun

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
				// First, list and delete all objects in the bucket using Cloudflare SDK
				console.log(`Removing all objects from bucket: ${bucketName}`);

				// List all objects using Cloudflare SDK
				const objectsList = await cloudflare.r2.buckets.objects.list(bucketName, {
					account_id: accountId,
				});

				const objects = objectsList.objects ?? [];

				if (objects.length > 0) {
					console.log(`Found ${objects.length} objects to delete`);

					// Delete objects one by one using Cloudflare SDK
					for (const obj of objects) {
						try {
							await cloudflare.r2.buckets.objects.delete(bucketName, obj.key, {
								account_id: accountId,
							});
						} catch (error) {
							console.error(`Failed to delete object ${obj.key}:`, error);
						}
					}
					console.log(`Deleted ${objects.length} objects from bucket: ${bucketName}`);
				} else {
					console.log(`Bucket ${bucketName} is already empty`);
				}

				// Now delete the empty bucket using Cloudflare SDK
				console.log(`Deleting empty R2 bucket: ${bucketName}`);
				await cloudflare.r2.buckets.delete(bucketName, {
					account_id: accountId,
				});
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
