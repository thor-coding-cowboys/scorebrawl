#!/usr/bin/env bun
/**
 * Shared cleanup utilities for preview environments
 * Used by both CI workflows and manual cleanup scripts
 *
 * Works with either:
 * - Local wrangler authentication (OAuth) - preferred for local use
 * - Environment variables (CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID) - for CI
 */

import { $ } from "bun";

export interface CleanupConfig {
	prNumber: string;
	apiToken?: string;
	accountId?: string;
	debug?: boolean;
}

export interface CleanupResult {
	step: string;
	status: "success" | "skipped" | "error";
	message: string;
}

// Global debug flag
let debugMode = false;

/**
 * Log debug message if debug mode is enabled
 */
function debug(...args: unknown[]): void {
	if (debugMode) {
		console.log("🔍 DEBUG:", ...args);
	}
}

/**
 * Get account ID from wrangler (for local development)
 */
async function getAccountIdFromWrangler(): Promise<string | null> {
	try {
		const result = await $`bun wrangler whoami`.quiet();
		const output = result.stdout.toString();
		// Parse account ID from wrangler output
		const match = output.match(/[a-f0-9]{32}/);
		return match ? match[0] : null;
	} catch {
		return null;
	}
}

/**
 * List queues using wrangler CLI
 * Parses table output format from wrangler queues list
 */
async function listQueues(): Promise<string[]> {
	try {
		const result = await $`bun wrangler queues list`.quiet();
		const output = result.stdout.toString();
		debug("Queues list output:", output);

		// Parse table format with │ separators
		// Format: │ id │ name │ created_on │ modified_on │ producers │ consumers │
		const queues: string[] = [];
		for (const line of output.split("\n")) {
			// Skip lines without table separators
			if (!line.includes("│")) {
				continue;
			}

			// Split by │ and extract the name (second column)
			const parts = line
				.split("│")
				.map((p) => p.trim())
				.filter((p) => p.length > 0);
			if (parts.length >= 2) {
				const queueName = parts[1];
				// Include scorebrawl queue names (preview queues have dashes)
				if (queueName?.startsWith("scorebrawl")) {
					queues.push(queueName);
				}
			}
		}

		debug("Parsed queues:", queues);
		return [...new Set(queues)]; // Remove duplicates
	} catch (error) {
		debug("Error listing queues:", error);
		return [];
	}
}

/**
 * List R2 buckets using wrangler CLI
 * Parses output format: name: <bucket-name>
 */
async function listR2Buckets(): Promise<string[]> {
	try {
		const result = await $`bun wrangler r2 bucket list`.quiet();
		const output = result.stdout.toString();
		debug("R2 buckets list output:", output);

		// Parse bucket names from output
		// Format: name:           scorebrawl-user-assets
		const buckets: string[] = [];
		for (const line of output.split("\n")) {
			const trimmed = line.trim();
			if (trimmed.startsWith("name:")) {
				const bucketName = trimmed.replace(/^name:\s*/, "").trim();
				if (bucketName) {
					buckets.push(bucketName);
				}
			}
		}

		debug("Parsed buckets:", buckets);
		return buckets;
	} catch (error) {
		debug("Error listing R2 buckets:", error);
		return [];
	}
}

/**
 * Get resource names for a preview environment
 */
export function getResourceNames(prNumber: string) {
	return {
		workerName: `scorebrawl-pr-${prNumber}`,
		achievementQueueName: `scorebrawl-achievement-calculations-pr-${prNumber}`,
		seedQueueName: `scorebrawl-seed-queue-pr-${prNumber}`,
		dbName: `scorebrawl-db-pr-${prNumber}`,
		bucketName: `scorebrawl-user-assets-pr-${prNumber}`,
	};
}

/**
 * SAFETY CHECK: Validate that we're not trying to delete production resources
 */
export function validateSafetyCheck(workerName: string): void {
	if (workerName === "scorebrawl") {
		throw new Error(
			"SAFETY CHECK FAILED: Cannot delete the main 'scorebrawl' worker! " +
				"This script is for preview environments only (scorebrawl-pr-{N})"
		);
	}
}

/**
 * Remove a worker as a consumer from a queue
 */
export async function removeQueueConsumer(
	queueName: string,
	workerName: string
): Promise<CleanupResult> {
	try {
		const queues = await listQueues();
		const queueExists = queues.includes(queueName);
		debug(`Queue ${queueName} exists:`, queueExists);

		if (queueExists) {
			debug(`Removing consumer ${workerName} from ${queueName}...`);
			const cmd = $`bun wrangler queues consumer remove ${queueName} ${workerName}`;
			if (!debugMode) {
				cmd.quiet();
			}
			await cmd;
			return { step: `Remove consumer from ${queueName}`, status: "success", message: "Removed" };
		}
		return {
			step: `Remove consumer from ${queueName}`,
			status: "skipped",
			message: "Queue not found",
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		const stderr = (error as { stderr?: string }).stderr;
		const fullMessage = stderr ? `${message}\n${stderr}` : message;
		debug(`Error removing consumer from ${queueName}:`, fullMessage);

		if (fullMessage.includes("not found") || fullMessage.includes("does not exist")) {
			return {
				step: `Remove consumer from ${queueName}`,
				status: "skipped",
				message: "Consumer not found",
			};
		}
		return { step: `Remove consumer from ${queueName}`, status: "error", message: fullMessage };
	}
}

/**
 * Delete a Cloudflare Worker
 */
export async function deleteWorker(workerName: string): Promise<CleanupResult> {
	try {
		debug(`Deleting worker ${workerName}...`);
		const cmd = $`bun wrangler delete --name ${workerName} --force`;
		if (!debugMode) {
			cmd.quiet();
		}
		await cmd;
		return { step: "Delete Worker", status: "success", message: "Deleted" };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		const stderr = (error as { stderr?: string }).stderr;
		const fullMessage = stderr ? `${message}\n${stderr}` : message;
		debug(`Error deleting worker ${workerName}:`, fullMessage);

		if (fullMessage.includes("not found") || fullMessage.includes("does not exist")) {
			return { step: "Delete Worker", status: "skipped", message: "Worker not found" };
		}
		return { step: "Delete Worker", status: "error", message: fullMessage };
	}
}

/**
 * Delete a queue
 */
export async function deleteQueue(queueName: string): Promise<CleanupResult> {
	try {
		const queues = await listQueues();
		const queueExists = queues.includes(queueName);
		debug(`Queue ${queueName} exists for deletion:`, queueExists);

		if (queueExists) {
			debug(`Deleting queue ${queueName}...`);
			const cmd = $`bun wrangler queues delete ${queueName} --force`;
			if (!debugMode) {
				cmd.quiet();
			}
			await cmd;
			return { step: `Delete Queue ${queueName}`, status: "success", message: "Deleted" };
		}
		return { step: `Delete Queue ${queueName}`, status: "skipped", message: "Queue not found" };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		const stderr = (error as { stderr?: string }).stderr;
		const fullMessage = stderr ? `${message}\n${stderr}` : message;
		debug(`Error deleting queue ${queueName}:`, fullMessage);

		return { step: `Delete Queue ${queueName}`, status: "error", message: fullMessage };
	}
}

/**
 * Delete a D1 database
 */
export async function deleteDatabase(dbName: string): Promise<CleanupResult> {
	try {
		debug(`Listing databases to check if ${dbName} exists...`);
		const listResult = await $`bun wrangler d1 list --json`.quiet();
		const databases = JSON.parse(listResult.stdout.toString());
		const dbExists = databases.find((db: { name: string }) => db.name === dbName);
		debug(`Database ${dbName} exists:`, !!dbExists);

		if (dbExists) {
			debug(`Deleting database ${dbName}...`);
			const cmd = $`bun wrangler d1 delete ${dbName} --skip-confirmation`;
			if (!debugMode) {
				cmd.quiet();
			}
			await cmd;
			return { step: "Delete Database", status: "success", message: "Deleted" };
		}
		return { step: "Delete Database", status: "skipped", message: "Database not found" };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		const stderr = (error as { stderr?: string }).stderr;
		const fullMessage = stderr ? `${message}\n${stderr}` : message;
		debug(`Error deleting database ${dbName}:`, fullMessage);

		return { step: "Delete Database", status: "error", message: fullMessage };
	}
}

/**
 * Delete an R2 bucket
 */
export async function deleteR2Bucket(bucketName: string): Promise<CleanupResult> {
	try {
		const buckets = await listR2Buckets();
		const bucketExists = buckets.includes(bucketName);
		debug(`Bucket ${bucketName} exists:`, bucketExists);

		if (bucketExists) {
			// First, remove all objects from the bucket
			try {
				debug(`Removing objects from bucket ${bucketName}...`);
				const deleteCmd = $`bun wrangler r2 object delete --bucket ${bucketName} --prefix ""`;
				if (!debugMode) {
					deleteCmd.quiet();
				}
				await deleteCmd;
			} catch {
				// Bucket might be empty, continue
				debug("No objects to delete or delete failed");
			}

			// Delete the bucket
			debug(`Deleting bucket ${bucketName}...`);
			const cmd = $`bun wrangler r2 bucket delete ${bucketName}`;
			if (!debugMode) {
				cmd.quiet();
			}
			await cmd;
			return { step: "Delete R2 Bucket", status: "success", message: "Deleted" };
		}
		return { step: "Delete R2 Bucket", status: "skipped", message: "Bucket not found" };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		const stderr = (error as { stderr?: string }).stderr;
		const fullMessage = stderr ? `${message}\n${stderr}` : message;
		debug(`Error deleting bucket ${bucketName}:`, fullMessage);

		return { step: "Delete R2 Bucket", status: "error", message: fullMessage };
	}
}

/**
 * Run full cleanup sequence
 * Works with local wrangler auth or CI environment variables
 */
export async function runCleanup(config: CleanupConfig): Promise<CleanupResult[]> {
	const { prNumber, debug: isDebug } = config;

	// Set global debug mode
	debugMode = isDebug ?? false;

	const names = getResourceNames(prNumber);
	const results: CleanupResult[] = [];

	// Safety check
	validateSafetyCheck(names.workerName);

	// For logging purposes, show account info if we can get it
	const accountId = config.accountId ?? (await getAccountIdFromWrangler());
	if (accountId) {
		console.log(`   Using account: ${accountId}`);
	}

	if (debugMode) {
		console.log("\n🔍 DEBUG MODE ENABLED - showing all command output\n");
	}

	// Step 1: Remove worker from both queues
	results.push(await removeQueueConsumer(names.achievementQueueName, names.workerName));
	results.push(await removeQueueConsumer(names.seedQueueName, names.workerName));

	// Step 2: Delete worker
	results.push(await deleteWorker(names.workerName));

	// Step 3: Delete queues
	results.push(await deleteQueue(names.achievementQueueName));
	results.push(await deleteQueue(names.seedQueueName));

	// Step 4: Delete database
	results.push(await deleteDatabase(names.dbName));

	// Step 5: Delete R2 bucket
	results.push(await deleteR2Bucket(names.bucketName));

	return results;
}
