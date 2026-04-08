#!/usr/bin/env -S bun run
/**
 * Manual cleanup script for preview environments
 * Usage: ./scripts/cleanup-preview-env.ts [OPTIONS] <PR_NUMBER>
 *
 * Options:
 *   --debug    Show verbose output from all commands
 *
 * Works with local wrangler authentication (OAuth) - no env vars needed!
 * Or with env vars for CI: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID
 *
 * SAFETY: This script will NEVER delete the main "scorebrawl" worker.
 * It only works with preview environments matching pattern: scorebrawl-pr-{N}
 */

import { runCleanup, type CleanupResult } from "./lib/cleanup.ts";

const args = process.argv.slice(2);
const debug = args.includes("--debug");
const prNumberArg = args.find((arg) => /^\d+$/.test(arg));

// Validate PR number
if (!prNumberArg) {
	console.error("❌ Error: PR number is required as an argument");
	console.error("Usage: ./scripts/cleanup-preview-env.ts [OPTIONS] <PR_NUMBER>");
	console.error("Options:");
	console.error("  --debug    Show verbose output from all commands");
	console.error("");
	console.error("Examples:");
	console.error("  ./scripts/cleanup-preview-env.ts 634");
	console.error("  ./scripts/cleanup-preview-env.ts --debug 634");
	process.exit(1);
}

const prNumber = prNumberArg;

console.log(`🧹 Cleaning up preview environment for PR #${prNumber}`);
console.log(`   Worker: scorebrawl-pr-${prNumber}`);
console.log(`   Database: scorebrawl-db-pr-${prNumber}`);
console.log(
	`   Queues: scorebrawl-achievement-calculations-pr-${prNumber}, scorebrawl-seed-queue-pr-${prNumber}`
);
console.log(`   R2 Bucket: scorebrawl-user-assets-pr-${prNumber}`);
console.log("");

console.log("\n📋 Cleanup Sequence:");
console.log("   1. Remove worker from queues");
console.log("   2. Delete worker");
console.log("   3. Delete queues");
console.log("   4. Delete database");
console.log("   5. Delete R2 bucket");
console.log("");

try {
	const results = await runCleanup({ prNumber, debug });

	// Print summary
	console.log(`\n${"=".repeat(60)}`);
	console.log("📊 CLEANUP SUMMARY");
	console.log("=".repeat(60));

	const successes = results.filter((r: CleanupResult) => r.status === "success").length;
	const skipped = results.filter((r: CleanupResult) => r.status === "skipped").length;
	const errors = results.filter((r: CleanupResult) => r.status === "error").length;

	for (const result of results) {
		const icon = result.status === "success" ? "✅" : result.status === "skipped" ? "⏭️" : "❌";
		console.log(`${icon} ${result.step}: ${result.message}`);
	}

	console.log("-".repeat(60));
	console.log(`Total: ${successes} succeeded, ${skipped} skipped, ${errors} errors`);
	console.log("=".repeat(60));

	if (errors > 0) {
		console.log("\n⚠️  Some cleanup steps had errors. You may need to manually verify.");
		process.exit(1);
	} else {
		console.log("\n✨ Cleanup completed successfully!");
		process.exit(0);
	}
} catch (error) {
	console.error("\n❌ Cleanup failed:", error instanceof Error ? error.message : String(error));
	process.exit(1);
}
