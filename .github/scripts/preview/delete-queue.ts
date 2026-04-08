#!/usr/bin/env bun
/**
 * CI script: Delete queues
 * Used by the preview cleanup workflow
 */

import { deleteQueue, getResourceNames } from "../../../scripts/lib/cleanup.ts";

const prNumber = process.env.PR_NUMBER;

if (!prNumber) {
	console.error("PR_NUMBER environment variable is required");
	process.exit(1);
}

const names = getResourceNames(prNumber);

try {
	const result1 = await deleteQueue(names.achievementQueueName);
	console.log(`${result1.step}: ${result1.status === "success" ? "Deleted" : result1.message}`);

	const result2 = await deleteQueue(names.seedQueueName);
	console.log(`${result2.step}: ${result2.status === "success" ? "Deleted" : result1.message}`);
} catch {
	console.log("Failed to delete queues, assuming they don't exist");
}

process.exit(0);
