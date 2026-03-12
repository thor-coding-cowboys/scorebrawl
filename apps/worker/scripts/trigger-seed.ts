#!/usr/bin/env bun
/**
 * Trigger bulk seed for preview environments via D1 HTTP API.
 *
 * This script seeds preview databases by calling the Worker directly
 * with a secret seed token, bypassing the need for queue-based seeding in CI.
 *
 * ⚠️  PREVIEW ENVIRONMENTS ONLY
 *
 * Usage:
 *   bun run scripts/trigger-seed.ts --members 100 --matches 500
 *   bun run scripts/trigger-seed.ts -m 1000 -M 5000
 */

const green = (text: string) => `\x1b[32m${text}\x1b[0m`;
const red = (text: string) => `\x1b[31m${text}\x1b[0m`;
const yellow = (text: string) => `\x1b[33m${text}\x1b[0m`;
const cyan = (text: string) => `\x1b[36m${text}\x1b[0m`;
const bold = (text: string) => `\x1b[1m${text}\x1b[0m`;

const DEFAULT_MEMBER_COUNT = 100;
const DEFAULT_MATCH_COUNT = 500;

function parseArgs(): {
	members: number;
	matches: number;
	help: boolean;
} {
	const args = process.argv.slice(2);
	let members = DEFAULT_MEMBER_COUNT;
	let matches = DEFAULT_MATCH_COUNT;

	// Parse --members=N or -m N
	const membersArgIndex = args.findIndex((a) => a === "-m" || a === "--members");
	if (membersArgIndex !== -1 && args[membersArgIndex + 1]) {
		const parsed = Number.parseInt(args[membersArgIndex + 1], 10);
		if (!Number.isNaN(parsed) && parsed >= 0) {
			members = parsed;
		}
	}
	const membersEqArg = args.find((a) => a.startsWith("--members="));
	if (membersEqArg) {
		const parsed = Number.parseInt(membersEqArg.split("=")[1], 10);
		if (!Number.isNaN(parsed) && parsed >= 0) {
			members = parsed;
		}
	}

	// Parse --matches=N or -M N
	const matchesArgIndex = args.findIndex((a) => a === "-M" || a === "--matches");
	if (matchesArgIndex !== -1 && args[matchesArgIndex + 1]) {
		const parsed = Number.parseInt(args[matchesArgIndex + 1], 10);
		if (!Number.isNaN(parsed) && parsed >= 0) {
			matches = parsed;
		}
	}
	const matchesEqArg = args.find((a) => a.startsWith("--matches="));
	if (matchesEqArg) {
		const parsed = Number.parseInt(matchesEqArg.split("=")[1], 10);
		if (!Number.isNaN(parsed) && parsed >= 0) {
			matches = parsed;
		}
	}

	const help = args.includes("--help") || args.includes("-h");

	return { members, matches, help };
}

function printHelp() {
	console.log(`
${bold(cyan("Scorebrawl Preview Seed Trigger"))}
${"─".repeat(50)}

${yellow("⚠️  PREVIEW ENVIRONMENTS ONLY")}

Seeds preview databases by calling the Worker directly.

${bold("Usage:")} bun run scripts/trigger-seed.ts [options]

${bold("Options:")}
  -m, --members <n>     Number of members to create (default: ${DEFAULT_MEMBER_COUNT})
  -M, --matches <n>     Number of matches to create (default: ${DEFAULT_MATCH_COUNT})
  -h, --help            Show this help message

${bold("Environment:")}
  PREVIEW_URL              Preview Worker URL (required)
  SCOREBRAWL_SEED_SECRET   Secret token for seeding (optional, uses default if not set)

${bold("Examples:")}
  PREVIEW_URL=https://... bun run scripts/trigger-seed.ts -m 4 -M 15
`);
}

async function main() {
	const args = parseArgs();

	if (args.help) {
		printHelp();
		process.exit(0);
	}

	const previewUrl = process.env.PREVIEW_URL;
	if (!previewUrl) {
		console.error(red("Error: PREVIEW_URL environment variable must be set"));
		console.error("Example: PREVIEW_URL=https://scorebrawl-pr-123.coding-cowboys.workers.dev");
		process.exit(1);
	}

	console.log(`
${bold(cyan("Preview Seed Trigger"))}
${"─".repeat(50)}
  URL:         ${previewUrl}
  Members:     ${args.members}
  Matches:     ${args.matches}
`);

	// Send seed request to the preview Worker
	console.log(cyan("Sending seed request to preview Worker..."));

	const response = await fetch(`${previewUrl}/api/admin/seed`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"X-Seed-Token": process.env.SCOREBRAWL_SEED_SECRET || "dev-seed-token",
		},
		body: JSON.stringify({
			memberCount: args.members,
			matchCount: args.matches,
		}),
	});

	if (!response.ok) {
		const errorText = await response.text();
		console.error(red("\nFailed to trigger seed:"));
		console.error("Status:", response.status, response.statusText);
		console.error("Response:", errorText);
		process.exit(1);
	}

	const result = (await response.json()) as { success: boolean; message: string };

	if (result.success) {
		console.log(green("\nSeed request sent successfully!"));
		console.log(result.message);
		console.log(yellow("\nThe seed is processing asynchronously."));
		console.log(`Monitor with: ${bold("bunx wrangler tail")}`);
	} else {
		console.error(red("\nSeed request failed:"));
		console.error(result.message);
		process.exit(1);
	}
}

main().catch((error) => {
	console.error(red("Trigger failed:"), error);
	process.exit(1);
});
