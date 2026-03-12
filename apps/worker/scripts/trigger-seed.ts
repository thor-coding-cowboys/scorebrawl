#!/usr/bin/env bun
/**
 * Trigger bulk seed via Cloudflare Queue for preview environments ONLY.
 *
 * This script sends a message to the seed queue using the Cloudflare API,
 * which is processed by the Worker running close to the D1 database.
 *
 * ⚠️  PREVIEW ENVIRONMENTS ONLY - This will only seed preview databases, never production.
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
${bold(cyan("Scorebrawl Preview Queue Seed Trigger"))}
${"─".repeat(50)}

${yellow("⚠️  PREVIEW ENVIRONMENTS ONLY")}

This script seeds preview databases via Cloudflare Queue.
Runs inside the Worker for maximum performance (close to D1).

${bold("Usage:")} bun run scripts/trigger-seed.ts [options]

${bold("Options:")}
  -m, --members <n>     Number of members to create (default: ${DEFAULT_MEMBER_COUNT})
  -M, --matches <n>     Number of matches to create (default: ${DEFAULT_MATCH_COUNT})
  -h, --help            Show this help message

${bold("Examples:")}
  bun run scripts/trigger-seed.ts              # Seed preview with defaults
  bun run scripts/trigger-seed.ts -m 1000      # Create 1000 members
  bun run scripts/trigger-seed.ts -M 10000     # Create 10000 matches
  bun run scripts/trigger-seed.ts -m 500 -M 2500  # Large dataset

${bold("Note:")}
  The seed runs asynchronously via queue. Check logs with:
  bunx wrangler tail

${red("Production seeding is NOT supported via this script.")}
`);
}

async function main() {
	const args = parseArgs();

	if (args.help) {
		printHelp();
		process.exit(0);
	}

	console.log(`
${bold(cyan("Preview Queue Seed Trigger"))}
${"─".repeat(50)}
  Environment: ${yellow("PREVIEW ONLY")}
  Members:     ${args.members}
  Matches:     ${args.matches}
`);

	const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
	const apiToken = process.env.CLOUDFLARE_API_TOKEN;
	const queueName = process.env.QUEUE_NAME || "scorebrawl-seed-queue";

	if (!accountId || !apiToken) {
		console.error(red("Error: CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN must be set"));
		process.exit(1);
	}

	// First, get the queue ID by name
	console.log(cyan("Looking up queue ID..."));
	const listQueuesResponse = await fetch(
		`https://api.cloudflare.com/client/v4/accounts/${accountId}/queues`,
		{
			method: "GET",
			headers: {
				Authorization: `Bearer ${apiToken}`,
				"Content-Type": "application/json",
			},
		}
	);

	if (!listQueuesResponse.ok) {
		const error = await listQueuesResponse.text();
		console.error(red("Failed to list queues:"), error);
		process.exit(1);
	}

	const queuesData = (await listQueuesResponse.json()) as {
		result: Array<{ queue_id: string; queue_name: string }>;
	};
	console.log(cyan(`Looking for queue: ${queueName}`));
	const queue = queuesData.result.find((q) => q.queue_name === queueName);

	if (!queue) {
		console.error(red(`Error: Could not find queue '${queueName}'`));
		console.error("Available queues:", queuesData.result.map((q) => q.queue_name).join(", "));
		process.exit(1);
	}

	console.log(cyan(`Found queue ID: ${queue.queue_id}`));

	// Send message to queue
	console.log(cyan("Sending seed request to queue..."));

	const message = {
		action: "bulk-seed",
		memberCount: args.members,
		matchCount: args.matches,
	};

	const sendResponse = await fetch(
		`https://api.cloudflare.com/client/v4/accounts/${accountId}/queues/${queue.queue_id}/messages`,
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				body: JSON.stringify(message),
			}),
		}
	);

	if (!sendResponse.ok) {
		const errorText = await sendResponse.text();
		console.error(red("Failed to send message to queue:"));
		console.error("Status:", sendResponse.status, sendResponse.statusText);
		console.error("Response:", errorText);
		process.exit(1);
	}

	const sendData = (await sendResponse.json()) as { success: boolean };

	if (sendData.success) {
		console.log(green("\nSeed request sent successfully!"));
		console.log(yellow("\nThe seed is processing asynchronously."));
		console.log(`Monitor with: ${bold("bunx wrangler tail")}`);
	} else {
		console.error(red("\nFailed to send seed request"));
		process.exit(1);
	}
}

main().catch((error) => {
	console.error(red("Trigger failed:"), error);
	process.exit(1);
});
