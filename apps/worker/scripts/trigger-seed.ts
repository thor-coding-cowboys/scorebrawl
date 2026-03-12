#!/usr/bin/env bun
/**
 * Trigger bulk seed for preview environments using admin user authentication.
 *
 * This script signs in as the seed user and uses the session token
to trigger bulk seeding via the admin endpoint.
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

const SEED_USER = {
	email: "seed@scorebrawl.com",
	password: "Test.1234",
};

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

This script signs in as the seed user and triggers bulk seeding.

${bold("Usage:")} bun run scripts/trigger-seed.ts [options]

${bold("Options:")}
  -m, --members <n>     Number of members to create (default: ${DEFAULT_MEMBER_COUNT})
  -M, --matches <n>     Number of matches to create (default: ${DEFAULT_MATCH_COUNT})
  -h, --help            Show this help message

${bold("Environment:")}
  PREVIEW_URL              Preview Worker URL (required)

${bold("Examples:")}
  PREVIEW_URL=https://... bun run scripts/trigger-seed.ts -m 4 -M 15
`);
}

async function signIn(previewUrl: string): Promise<string> {
	console.log(cyan("Signing in as seed user..."));

	const response = await fetch(`${previewUrl}/api/auth/sign-in/email`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			email: SEED_USER.email,
			password: SEED_USER.password,
		}),
	});

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`Sign in failed: ${error}`);
	}

	// Extract session token from cookies
	const setCookie = response.headers.get("set-cookie");
	if (!setCookie) {
		throw new Error("No session cookie returned");
	}

	// Parse session token from cookie
	const sessionMatch = setCookie.match(/better-auth.session_token=([^;]+)/);
	if (!sessionMatch) {
		throw new Error("Could not extract session token from cookie");
	}

	return sessionMatch[1];
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
		process.exit(1);
	}

	console.log(`
${bold(cyan("Preview Seed Trigger"))}
${"─".repeat(50)}
  URL:         ${previewUrl}
  Members:     ${args.members}
  Matches:     ${args.matches}
`);

	try {
		// Sign in to get session token
		const sessionToken = await signIn(previewUrl);
		console.log(green("Signed in successfully!"));

		// Trigger seed with session token
		console.log(cyan("Triggering bulk seed..."));

		const response = await fetch(`${previewUrl}/api/admin/seed`, {
			method: "POST",
		headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${sessionToken}`,
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

		const result = await response.json() as { success: boolean; message: string };

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
	} catch (error) {
		console.error(red("\nError:"), error instanceof Error ? error.message : error);
		process.exit(1);
	}
}

main().catch((error) => {
	console.error(red("Trigger failed:"), error);
	process.exit(1);
});
