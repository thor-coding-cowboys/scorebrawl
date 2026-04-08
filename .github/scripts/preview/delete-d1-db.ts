#!/usr/bin/env bun
/**
 * CI script: Delete D1 database
 * Used by the preview cleanup workflow
 */

import { deleteDatabase, getResourceNames } from "../../../scripts/lib/cleanup.ts";

const prNumber = process.env.PR_NUMBER;

if (!prNumber) {
	console.error("PR_NUMBER environment variable is required");
	process.exit(1);
}

const names = getResourceNames(prNumber);

try {
	const result = await deleteDatabase(names.dbName);
	console.log(`${result.step}: ${result.status === "success" ? "Deleted" : result.message}`);
} catch {
	console.log("Failed to delete database, assuming it doesn't exist");
}

process.exit(0);
