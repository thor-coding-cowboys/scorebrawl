#!/usr/bin/env bun
/**
 * CI script: Delete R2 bucket
 * Used by the preview cleanup workflow
 */

import { deleteR2Bucket, getResourceNames } from "../../../scripts/lib/cleanup.ts";

const prNumber = process.env.PR_NUMBER;

if (!prNumber) {
	console.error("PR_NUMBER environment variable is required");
	process.exit(1);
}

const names = getResourceNames(prNumber);

try {
	const result = await deleteR2Bucket(names.bucketName);
	console.log(`${result.step}: ${result.status === "success" ? "Deleted" : result.message}`);
} catch (error) {
	console.error("Failed to delete R2 bucket:", error);
	process.exit(1);
}

process.exit(0);
