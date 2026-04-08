#!/usr/bin/env bun
/**
 * CI script: Remove worker as queue consumer
 * Used by the preview cleanup workflow
 */

import {
	removeQueueConsumer,
	getResourceNames,
	validateSafetyCheck,
} from "../../../scripts/lib/cleanup.ts";

const prNumber = process.env.PR_NUMBER;

if (!prNumber) {
	console.error("PR_NUMBER environment variable is required");
	process.exit(1);
}

const names = getResourceNames(prNumber);

// Safety check
validateSafetyCheck(names.workerName);

try {
	// Remove from both queues
	const result1 = await removeQueueConsumer(names.achievementQueueName, names.workerName);
	console.log(`${result1.step}: ${result1.status === "success" ? "Removed" : result1.message}`);

	const result2 = await removeQueueConsumer(names.seedQueueName, names.workerName);
	console.log(`${result2.step}: ${result2.status === "success" ? "Removed" : result2.message}`);
} catch (error) {
	console.log("Error removing queue consumer (continuing):", error);
}

process.exit(0);
