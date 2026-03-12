#!/usr/bin/env bun
/**
 * Local development database seeding script.
 *
 * ⚠️  LOCAL DEVELOPMENT ONLY - This script only works with local SQLite databases.
 *
 * For preview/production environments, use:
 *   bun run scripts/trigger-seed.ts
 *
 * This script seeds the local database with test data including:
 * - A seed user (seed@scorebrawl.com / Test.1234)
 * - A league with season
 * - Additional members/players
 * - Matches with ELO calculations
 */

import { spawn } from "bun";
import { Database } from "bun:sqlite";
import { drizzle as drizzleSqlite } from "drizzle-orm/bun-sqlite";
import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import * as readline from "node:readline";
import { and, eq, inArray, sql } from "drizzle-orm";
import { randEmail, randFullName, randNumber } from "@ngneat/falso";
import {
	account,
	league,
	leagueTeam,
	leagueTeamPlayer,
	match,
	matchPlayer,
	matchTeam,
	member,
	player,
	season,
	seasonPlayer,
	seasonTeam,
	user,
} from "../src/db/schema";
import { createId } from "../src/utils/id-util";
import { hashPassword } from "../src/lib/password";
import { calculateEloMatch, determineMatchResult } from "@coding-cowboys/scorebrawl-util/elo-util";

// Seed configuration
const SEED_USER = {
	email: "seed@scorebrawl.com",
	password: "Test.1234",
	name: randFullName(),
};

const SEED_LEAGUE = {
	name: "Scorebrawl",
	slug: "scorebrawl",
};

const SEED_SEASON = {
	name: "Season 1",
	slug: "season-1",
	initialScore: 1000,
	scoreType: "elo" as const,
	kFactor: 32,
};

const DEFAULT_MEMBER_COUNT = 20;
const DEFAULT_MATCH_COUNT = 100;

// CLI colors
const green = (text: string) => `\x1b[32m${text}\x1b[0m`;
const red = (text: string) => `\x1b[31m${text}\x1b[0m`;
const yellow = (text: string) => `\x1b[33m${text}\x1b[0m`;
const cyan = (text: string) => `\x1b[36m${text}\x1b[0m`;
const bold = (text: string) => `\x1b[1m${text}\x1b[0m`;
const dim = (text: string) => `\x1b[2m${text}\x1b[0m`;

// Parse CLI arguments
function parseArgs(): {
	interactive: boolean;
	reset: boolean;
	help: boolean;
	members: number;
	matches: number;
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
	// Also check for --members=N format
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
	// Also check for --matches=N format
	const matchesEqArg = args.find((a) => a.startsWith("--matches="));
	if (matchesEqArg) {
		const parsed = Number.parseInt(matchesEqArg.split("=")[1], 10);
		if (!Number.isNaN(parsed) && parsed >= 0) {
			matches = parsed;
		}
	}

	const interactive = args.includes("-i") || args.includes("--interactive");
	const reset = args.includes("-r") || args.includes("--reset");
	const help = args.includes("--help") || args.includes("-h");

	return { interactive, reset, help, members, matches };
}

function printHelp() {
	console.log(`
${bold(cyan("Scorebrawl Local Database Seed"))}
${"─".repeat(50)}

${red("⚠️  LOCAL DEVELOPMENT ONLY")}

This script only seeds your ${bold("local SQLite database")}.
For preview/production environments, use:

  ${bold("bun run scripts/trigger-seed.ts")}

${bold("Usage:")} bun run scripts/seed.ts [options]

${bold("Options:")}
  -i, --interactive    Interactive mode with prompts
  -r, --reset          Reset database before seeding
  -m, --members <n>    Number of additional members (default: ${DEFAULT_MEMBER_COUNT})
  -M, --matches <n>    Number of matches to create (default: ${DEFAULT_MATCH_COUNT})
  -h, --help           Show this help message

${bold("Examples:")}
  bun run scripts/seed.ts              # Seed with defaults
  bun run scripts/seed.ts -m 5         # Seed with 5 additional members
  bun run scripts/seed.ts -M 50        # Seed with 50 matches
  bun run scripts/seed.ts -m 20 -M 100 # 20 members and 100 matches
  bun run scripts/seed.ts -r           # Reset and seed
  bun run scripts/seed.ts -i           # Interactive mode

${bold("Seed Data:")}
  Email:    seed@scorebrawl.com
  Password: Test.1234
  League:   Scorebrawl
  Season:   Season 1
`);
}

async function prompt(question: string): Promise<string> {
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	return new Promise((resolve) => {
		rl.question(question, (answer) => {
			rl.close();
			resolve(answer);
		});
	});
}

async function interactiveMenu(): Promise<{ action: string; members: number; matches: number }> {
	console.log(`
${bold(cyan("Scorebrawl Database Seed Script"))}
${"─".repeat(40)}

${bold("What would you like to do?")}

  ${bold("1.")} Seed database with default data
  ${bold("2.")} Reset database and seed
  ${bold("3.")} Exit

`);

	const choice = await prompt("Enter your choice (1-3): ");

	let members = DEFAULT_MEMBER_COUNT;
	let matches = DEFAULT_MATCH_COUNT;

	switch (choice.trim()) {
		case "1":
		case "2": {
			const membersInput = await prompt(
				`Number of additional members to create (default: ${DEFAULT_MEMBER_COUNT}): `
			);
			if (membersInput.trim()) {
				const parsed = Number.parseInt(membersInput.trim(), 10);
				if (!Number.isNaN(parsed) && parsed >= 0) {
					members = parsed;
				}
			}
			const matchesInput = await prompt(
				`Number of matches to create (default: ${DEFAULT_MATCH_COUNT}): `
			);
			if (matchesInput.trim()) {
				const parsed = Number.parseInt(matchesInput.trim(), 10);
				if (!Number.isNaN(parsed) && parsed >= 0) {
					matches = parsed;
				}
			}
			return { action: choice === "1" ? "seed" : "reset-seed", members, matches };
		}
		case "3":
			return { action: "exit", members: 0, matches: 0 };
		default:
			console.log(red("Invalid choice. Please try again."));
			return interactiveMenu();
	}
}

async function runCommand(command: string, args: string[], cwd: string): Promise<boolean> {
	return new Promise((resolve) => {
		const proc = spawn({
			cmd: [command, ...args],
			cwd,
			stdout: "inherit",
			stderr: "inherit",
		});

		proc.exited.then((code) => {
			resolve(code === 0);
		});
	});
}

async function resetDatabase(workerDir: string): Promise<boolean> {
	console.log(yellow("\nResetting database..."));
	const success = await runCommand("bun", ["run", "db:reset"], workerDir);
	if (success) {
		console.log(green("Database reset complete."));
	} else {
		console.log(red("Database reset failed."));
	}
	return success;
}

function getLocalDbPath(workerDir: string): string | null {
	const d1Dir = resolve(workerDir, "../../.db/local/v3/d1/miniflare-D1DatabaseObject");
	if (!existsSync(d1Dir)) {
		return null;
	}

	const files = readdirSync(d1Dir);
	const sqliteFile = files.find(
		(f) => f.endsWith(".sqlite") && !f.includes("-shm") && !f.includes("-wal")
	);
	if (!sqliteFile) {
		return null;
	}

	return resolve(d1Dir, sqliteFile);
}

type DrizzleDB = ReturnType<typeof drizzleSqlite>;

// Helper to find or create a team (leagueTeam + leagueTeamPlayer + seasonTeam)
async function getOrCreateTeam({
	db,
	leagueId,
	seasonId,
	players,
	teamScores,
	now,
}: {
	db: DrizzleDB;
	leagueId: string;
	seasonId: string;
	players: { playerId: string; name: string }[];
	teamScores: Map<string, number>;
	now: Date;
}): Promise<{ seasonTeamId: string; score: number }> {
	const playerIds = players.map((p) => p.playerId);

	// Find existing league team with exact same players
	const [teamIdResult] = await db
		.select({ leagueTeamId: leagueTeamPlayer.leagueTeamId })
		.from(leagueTeamPlayer)
		.where(inArray(leagueTeamPlayer.playerId, playerIds))
		.groupBy(leagueTeamPlayer.leagueTeamId)
		.having(sql`COUNT(DISTINCT ${leagueTeamPlayer.playerId}) = ${players.length}`);

	let leagueTeamId = teamIdResult?.leagueTeamId;

	// Create league team if doesn't exist
	if (!leagueTeamId) {
		leagueTeamId = createId();
		const teamName = players.map((p) => p.name.split(" ")[0]).join(" & ");

		await db.insert(leagueTeam).values({
			id: leagueTeamId,
			name: teamName,
			leagueId,
			createdAt: now,
			updatedAt: now,
		});

		await db.insert(leagueTeamPlayer).values(
			players.map((p) => ({
				id: createId(),
				leagueTeamId: leagueTeamId as string,
				playerId: p.playerId,
				createdAt: now,
				updatedAt: now,
			}))
		);
	}

	// Check if season team exists
	const [existingSeasonTeam] = await db
		.select({ id: seasonTeam.id, score: seasonTeam.score })
		.from(seasonTeam)
		.where(and(eq(seasonTeam.leagueTeamId, leagueTeamId), eq(seasonTeam.seasonId, seasonId)))
		.limit(1);

	if (existingSeasonTeam) {
		// Return current score from tracking map if available
		const trackedScore = teamScores.get(existingSeasonTeam.id);
		return {
			seasonTeamId: existingSeasonTeam.id,
			score: trackedScore ?? existingSeasonTeam.score,
		};
	}

	// Create season team
	const seasonTeamId = createId();
	const initialScore = 1000;
	await db.insert(seasonTeam).values({
		id: seasonTeamId,
		leagueTeamId,
		seasonId,
		score: initialScore,
		createdAt: now,
		updatedAt: now,
	});

	teamScores.set(seasonTeamId, initialScore);
	return { seasonTeamId, score: initialScore };
}

async function createMatch({
	db,
	matchId,
	seasonId,
	homePlayerIds,
	awayPlayerIds,
	homeScore,
	awayScore,
	seasonData,
	playerNameMap,
	playerScores,
	playerIdMap,
	teamScores,
	existingTeams,
	leagueId,
	ownerUserId,
	now,
	matchIndex,
	matchCount,
}: {
	db: DrizzleDB;
	matchId: string;
	seasonId: string;
	homePlayerIds: string[];
	awayPlayerIds: string[];
	homeScore: number;
	awayScore: number;
	seasonData: { initialScore: number; scoreType: string; kFactor: number };
	playerNameMap: Map<string, string>;
	playerScores: Map<string, number>;
	playerIdMap: Map<string, string>;
	teamScores: Map<string, number>;
	existingTeams: Array<{ players: string[]; seasonTeamId: string }>;
	leagueId: string;
	ownerUserId: string;
	now: Date;
	matchIndex: number;
	matchCount: number;
}) {
	// Get team player info
	const homePlayers = homePlayerIds.map((id) => ({
		playerId: playerIdMap.get(id) ?? "",
		seasonPlayerId: id,
		score: playerScores.get(id) ?? seasonData.initialScore,
		name: playerNameMap.get(playerIdMap.get(id) ?? "") ?? "Unknown",
	}));

	const awayPlayers = awayPlayerIds.map((id) => ({
		playerId: playerIdMap.get(id) ?? "",
		seasonPlayerId: id,
		score: playerScores.get(id) ?? seasonData.initialScore,
		name: playerNameMap.get(playerIdMap.get(id) ?? "") ?? "Unknown",
	}));

	// Get or create teams
	const homeTeamResult = await getOrCreateTeam({
		db,
		leagueId,
		seasonId,
		players: homePlayers.map((p) => ({ playerId: p.playerId, name: p.name })),
		teamScores,
		now,
	});

	const awayTeamResult = await getOrCreateTeam({
		db,
		leagueId,
		seasonId,
		players: awayPlayers.map((p) => ({ playerId: p.playerId, name: p.name })),
		teamScores,
		now,
	});

	// Determine match result
	const matchResult = determineMatchResult(homeScore, awayScore);

	// Calculate ELO
	const eloResult = calculateEloMatch({
		scoreType: "elo",
		kFactor: seasonData.kFactor,
		homeScore,
		awayScore,
		homePlayers: homePlayers.map((p) => ({ id: p.seasonPlayerId, score: p.score })),
		awayPlayers: awayPlayers.map((p) => ({ id: p.seasonPlayerId, score: p.score })),
	});

	// Calculate new team scores based on average player scores
	const homeTeamScoreAfter =
		eloResult.homeTeam.players.reduce((sum, p) => sum + p.scoreAfter, 0) / homePlayers.length;
	const awayTeamScoreAfter =
		eloResult.awayTeam.players.reduce((sum, p) => sum + p.scoreAfter, 0) / awayPlayers.length;

	// Create match
	await db.insert(match).values({
		id: matchId,
		seasonId: seasonId,
		homeScore: homeScore,
		awayScore: awayScore,
		createdBy: ownerUserId,
		createdAt: new Date(now.getTime() - (matchCount - matchIndex) * 1000 * 60 * 60), // Spread over time
		updatedBy: ownerUserId,
		updatedAt: now,
	});

	// Create match teams
	const homeMatchTeamId = createId();
	const awayMatchTeamId = createId();

	await db.insert(matchTeam).values([
		{
			id: homeMatchTeamId,
			matchId: matchId,
			seasonTeamId: homeTeamResult.seasonTeamId,
			result: matchResult.homeResult,
			createdAt: now,
			updatedAt: now,
		},
		{
			id: awayMatchTeamId,
			matchId: matchId,
			seasonTeamId: awayTeamResult.seasonTeamId,
			result: matchResult.awayResult,
			createdAt: now,
			updatedAt: now,
		},
	]);

	// Update team scores
	teamScores.set(homeTeamResult.seasonTeamId, homeTeamScoreAfter);
	teamScores.set(awayTeamResult.seasonTeamId, awayTeamScoreAfter);

	// Create match players and update player scores
	await db.insert(matchPlayer).values([
		...homePlayerIds.map((seasonPlayerId) => {
			const playerScoreBefore = playerScores.get(seasonPlayerId) ?? seasonData.initialScore;
			const playerEloResult = eloResult.homeTeam.players.find((p) => p.id === seasonPlayerId);
			const playerScoreAfter = playerEloResult?.scoreAfter ?? playerScoreBefore;
			playerScores.set(seasonPlayerId, playerScoreAfter);

			return {
				id: createId(),
				matchId: matchId,
				seasonPlayerId: seasonPlayerId,
				playerId: playerIdMap.get(seasonPlayerId) ?? "",
				homeTeam: true,
				result: matchResult.homeResult,
				scoreBefore: playerScoreBefore,
				scoreAfter: playerScoreAfter,
				createdAt: now,
				updatedAt: now,
			};
		}),
		...awayPlayerIds.map((seasonPlayerId) => {
			const playerScoreBefore = playerScores.get(seasonPlayerId) ?? seasonData.initialScore;
			const playerEloResult = eloResult.awayTeam.players.find((p) => p.id === seasonPlayerId);
			const playerScoreAfter = playerEloResult?.scoreAfter ?? playerScoreBefore;
			playerScores.set(seasonPlayerId, playerScoreAfter);

			return {
				id: createId(),
				matchId: matchId,
				seasonPlayerId: seasonPlayerId,
				playerId: playerIdMap.get(seasonPlayerId) ?? "",
				homeTeam: false,
				result: matchResult.awayResult,
				scoreBefore: playerScoreBefore,
				scoreAfter: playerScoreAfter,
				createdAt: now,
				updatedAt: now,
			};
		}),
	]);

	// Update tracked team scores
	teamScores.set(homeTeamResult.seasonTeamId, homeTeamScoreAfter);
	teamScores.set(awayTeamResult.seasonTeamId, awayTeamScoreAfter);

	// Track teams for potential rivalries
	const homeTeamExists = existingTeams.find(
		(t) =>
			t.players.length === homePlayerIds.length && t.players.every((p) => homePlayerIds.includes(p))
	);
	const awayTeamExists = existingTeams.find(
		(t) =>
			t.players.length === awayPlayerIds.length && t.players.every((p) => awayPlayerIds.includes(p))
	);

	if (!homeTeamExists) {
		existingTeams.push({
			players: homePlayerIds,
			seasonTeamId: homeTeamResult.seasonTeamId,
		});
	}

	if (!awayTeamExists) {
		existingTeams.push({
			players: awayPlayerIds,
			seasonTeamId: awayTeamResult.seasonTeamId,
		});
	}
}

async function seedDatabase(
	memberCount: number,
	matchCount: number,
	isInteractive: boolean
): Promise<boolean> {
	const workerDir = resolve(import.meta.dir, "..");

	const dbPath = resolve(workerDir, "../../.db/local");

	// Check if local DB exists
	if (!existsSync(dbPath)) {
		console.log(yellow("Local database not found. Running migrations first..."));
		const migrated = await runCommand("bun", ["run", "db:migrate"], workerDir);
		if (!migrated) {
			console.log(red("Failed to run migrations."));
			return false;
		}
	}

	const sqlitePath = getLocalDbPath(workerDir);
	if (!sqlitePath) {
		console.log(red("Could not find SQLite database file."));
		return false;
	}

	console.log(cyan("\nSeeding local database..."));

	const sqlite = new Database(sqlitePath);
	const db = drizzleSqlite({ client: sqlite });

	try {
		const now = new Date();
		let createdCount = 0;
		let effectiveMemberCount = memberCount;

		// Check if main seed data already exists
		const [existingUser] = await db.select().from(user).where(eq(user.email, SEED_USER.email));
		const [existingLeague] = await db
			.select()
			.from(league)
			.where(eq(league.slug, SEED_LEAGUE.slug));
		const [existingSeason] = await db
			.select()
			.from(season)
			.where(eq(season.slug, SEED_SEASON.slug));

		const mainSeedExists = existingUser && existingLeague && existingSeason;

		// If main seed exists and running interactively, ask about members
		if (mainSeedExists && isInteractive) {
			console.log(dim(`  ○ User already exists: ${SEED_USER.email}`));
			console.log(dim(`  ○ League already exists: ${SEED_LEAGUE.name}`));
			console.log(dim(`  ○ Season already exists: ${SEED_SEASON.name}`));

			console.log(yellow("\n⚠️  For preview/production seeding, use:"));
			console.log(bold("  bun run scripts/trigger-seed.ts"));

			const wantMembers = await prompt("\nDatabase already seeded. Create additional members?");
			if (wantMembers.toLowerCase() !== "y" && wantMembers.toLowerCase() !== "yes") {
				effectiveMemberCount = 0;
			}
		}

		let ownerUserId: string;

		if (existingUser) {
			if (!mainSeedExists || !isInteractive) {
				console.log(dim(`  ○ User already exists: ${SEED_USER.email}`));
			}
			ownerUserId = existingUser.id;
		} else {
			// Create user
			ownerUserId = createId();
			await db.insert(user).values({
				id: ownerUserId,
				name: SEED_USER.name,
				email: SEED_USER.email,
				emailVerified: true,
				createdAt: now,
				updatedAt: now,
			});
			console.log(green(`  ✓ User created: ${SEED_USER.email} (${SEED_USER.name})`));

			// Create account with hashed password
			const hashedPassword = await hashPassword(SEED_USER.password);
			const accountId = createId();
			await db.insert(account).values({
				id: accountId,
				accountId: ownerUserId,
				providerId: "credential",
				userId: ownerUserId,
				password: hashedPassword,
				createdAt: now,
				updatedAt: now,
			});
			console.log(green("  ✓ Account created with password"));
			createdCount++;
		}

		let leagueId: string;
		let ownerPlayerId: string | null = null;

		if (existingLeague) {
			if (!mainSeedExists || !isInteractive) {
				console.log(dim(`  ○ League already exists: ${SEED_LEAGUE.name}`));
			}
			leagueId = existingLeague.id;

			// Get owner's player ID
			const [ownerPlayer] = await db.select().from(player).where(eq(player.userId, ownerUserId));
			ownerPlayerId = ownerPlayer?.id || null;
		} else {
			leagueId = createId();

			// Create the league
			await db.insert(league).values({
				id: leagueId,
				name: SEED_LEAGUE.name,
				slug: SEED_LEAGUE.slug,
				createdAt: now,
			});
			console.log(green(`  ✓ League created: ${SEED_LEAGUE.name} (slug: ${SEED_LEAGUE.slug})`));

			// Create the member (owner role)
			const memberId = createId();
			await db.insert(member).values({
				id: memberId,
				organizationId: leagueId,
				userId: ownerUserId,
				role: "owner",
				createdAt: now,
			});
			console.log(green("  ✓ Member created with owner role"));

			// Create the player (afterCreateOrganization logic)
			ownerPlayerId = createId();
			await db.insert(player).values({
				id: ownerPlayerId,
				userId: ownerUserId,
				leagueId: leagueId,
				disabled: false,
				createdAt: now,
				updatedAt: now,
			});
			console.log(green("  ✓ Player created for owner"));
			createdCount++;
		}

		let seasonId: string;

		if (existingSeason) {
			console.log(dim(`  ○ Season already exists: ${SEED_SEASON.name}`));
			seasonId = existingSeason.id;
		} else {
			seasonId = createId();
			const startDate = new Date();
			startDate.setDate(startDate.getDate() - 7); // Started a week ago

			await db.insert(season).values({
				id: seasonId,
				name: SEED_SEASON.name,
				slug: SEED_SEASON.slug,
				initialScore: SEED_SEASON.initialScore,
				scoreType: SEED_SEASON.scoreType,
				kFactor: SEED_SEASON.kFactor,
				startDate: startDate,
				endDate: null, // Ongoing
				leagueId: leagueId,
				archived: false,
				closed: false,
				createdBy: ownerUserId,
				updatedBy: ownerUserId,
				createdAt: now,
				updatedAt: now,
			});
			console.log(green(`  ✓ Season created: ${SEED_SEASON.name} (slug: ${SEED_SEASON.slug})`));

			// Add owner as season player if they have a player record
			if (ownerPlayerId) {
				await db.insert(seasonPlayer).values({
					id: createId(),
					seasonId: seasonId,
					playerId: ownerPlayerId,
					score: SEED_SEASON.initialScore,
					disabled: false,
					createdAt: now,
					updatedAt: now,
				});
				console.log(green("  ✓ Owner added as season player"));
			}
			createdCount++;
		}

		// Create additional members
		if (effectiveMemberCount > 0) {
			console.log(cyan(`\nCreating ${effectiveMemberCount} additional members...`));

			const existingEmails = new Set(
				(await db.select({ email: user.email }).from(user)).map((u) => u.email)
			);

			let membersCreated = 0;

			for (let i = 0; i < effectiveMemberCount; i++) {
				// Generate unique email
				let email: string;
				do {
					email = randEmail();
				} while (existingEmails.has(email));
				existingEmails.add(email);

				const name = randFullName();
				const newUserId = createId();

				// Create user
				await db.insert(user).values({
					id: newUserId,
					name: name,
					email: email,
					emailVerified: true,
					createdAt: now,
					updatedAt: now,
				});

				// Create account with same password as seed user
				const hashedPassword = await hashPassword(SEED_USER.password);
				await db.insert(account).values({
					id: createId(),
					accountId: newUserId,
					providerId: "credential",
					userId: newUserId,
					password: hashedPassword,
					createdAt: now,
					updatedAt: now,
				});

				// Create member with "member" role
				await db.insert(member).values({
					id: createId(),
					organizationId: leagueId,
					userId: newUserId,
					role: "member",
					createdAt: now,
				});

				// Create player (afterAcceptInvitation logic for non-viewer roles)
				const newPlayerId = createId();
				await db.insert(player).values({
					id: newPlayerId,
					userId: newUserId,
					leagueId: leagueId,
					disabled: false,
					createdAt: now,
					updatedAt: now,
				});

				// Add to season as season player
				await db.insert(seasonPlayer).values({
					id: createId(),
					seasonId: seasonId,
					playerId: newPlayerId,
					score: SEED_SEASON.initialScore,
					disabled: false,
					createdAt: now,
					updatedAt: now,
				});

				membersCreated++;
				console.log(green(`  ✓ Member ${i + 1}/${effectiveMemberCount}: ${name} (${email})`));
			}

			if (membersCreated > 0) {
				createdCount += membersCreated;
			}
		}

		// Create matches (requires at least 4 players for 2v2)
		let matchesCreated = 0;
		if (matchCount > 0) {
			// Get all season players for this season
			const allSeasonPlayers = await db
				.select({
					id: seasonPlayer.id,
					score: seasonPlayer.score,
					playerId: seasonPlayer.playerId,
				})
				.from(seasonPlayer)
				.where(eq(seasonPlayer.seasonId, seasonId));

			// Need at least 4 players for 2v2 matches
			if (allSeasonPlayers.length < 4) {
				console.log(
					yellow(
						`\nSkipping matches: need at least 4 season players, have ${allSeasonPlayers.length}`
					)
				);
			} else {
				console.log(cyan(`\nCreating ${matchCount} matches (2v2)...`));

				// Get season data for ELO calculation
				const [seasonData] = await db
					.select({
						id: season.id,
						scoreType: season.scoreType,
						kFactor: season.kFactor,
						initialScore: season.initialScore,
						leagueId: season.leagueId,
					})
					.from(season)
					.where(eq(season.id, seasonId));

				// Get player names for team naming
				const playerNames = await db
					.select({
						playerId: player.id,
						name: user.name,
					})
					.from(player)
					.innerJoin(user, eq(player.userId, user.id))
					.where(eq(player.leagueId, leagueId));
				const playerNameMap = new Map(playerNames.map((p) => [p.playerId, p.name]));

				// Track current scores (mutable during match creation)
				const playerScores = new Map(allSeasonPlayers.map((p) => [p.id, p.score]));
				const playerIdMap = new Map(allSeasonPlayers.map((p) => [p.id, p.playerId]));

				// Track team scores
				const teamScores = new Map<string, number>();
				// Track existing teams to create more rivalries
				const existingTeams: Array<{ players: string[]; seasonTeamId: string }> = [];

				for (let i = 0; i < matchCount; i++) {
					let homePlayerIds: string[];
					let awayPlayerIds: string[];

					// Enhanced rivalry logic: 60% chance to create rivalries after some teams exist
					if (i > 5 && Math.random() < 0.6 && existingTeams.length >= 2) {
						// Pick two different existing teams
						const shuffledTeams = [...existingTeams].sort(() => Math.random() - 0.5);
						const homeTeam = shuffledTeams[0];
						const awayTeam = shuffledTeams[1];
						homePlayerIds = homeTeam.players;
						awayPlayerIds = awayTeam.players;
					} else {
						// Create new random matchup
						const shuffled = [...allSeasonPlayers].sort(() => Math.random() - 0.5);
						const selectedPlayers = shuffled.slice(0, 4);
						homePlayerIds = [selectedPlayers[0].id, selectedPlayers[1].id];
						awayPlayerIds = [selectedPlayers[2].id, selectedPlayers[3].id];
					}

					// Generate random scores (0-10 each)
					const homeScore = randNumber({ min: 0, max: 10 });
					const awayScore = randNumber({ min: 0, max: 10 });

					await createMatch({
						db,
						matchId: createId(),
						seasonId,
						homePlayerIds,
						awayPlayerIds,
						homeScore,
						awayScore,
						seasonData,
						playerNameMap,
						playerScores,
						playerIdMap,
						teamScores,
						existingTeams,
						leagueId,
						ownerUserId,
						now,
						matchIndex: i,
						matchCount,
					});

					matchesCreated++;
					if ((i + 1) % 10 === 0 || i + 1 === matchCount) {
						console.log(green(`  ✓ Matches created: ${i + 1}/${matchCount}`));
					}
				}

				// Create additional rivalry matches to ensure multiple matchups between teams
				if (existingTeams.length >= 4) {
					console.log(cyan("\nCreating additional rivalry matches..."));
					const rivalryMatchCount = Math.min(20, Math.floor(existingTeams.length / 2));

					for (let i = 0; i < rivalryMatchCount; i++) {
						// Pick two different teams that haven't played much
						const shuffledTeams = [...existingTeams].sort(() => Math.random() - 0.5);
						const homeTeam = shuffledTeams[i % shuffledTeams.length];
						const awayTeam = shuffledTeams[(i + 1) % shuffledTeams.length];

						// Skip if it's the same team
						if (homeTeam.seasonTeamId === awayTeam.seasonTeamId) continue;

						const homePlayerIds = homeTeam.players;
						const awayPlayerIds = awayTeam.players;

						// Generate random scores (0-10 each)
						const homeScore = randNumber({ min: 0, max: 10 });
						const awayScore = randNumber({ min: 0, max: 10 });

						await createMatch({
							db,
							matchId: createId(),
							seasonId,
							homePlayerIds,
							awayPlayerIds,
							homeScore,
							awayScore,
							seasonData,
							playerNameMap,
							playerScores,
							playerIdMap,
							teamScores,
							existingTeams,
							leagueId,
							ownerUserId,
							now,
							matchIndex: matchCount + i,
							matchCount: matchCount + rivalryMatchCount,
						});

						matchesCreated++;
						if ((i + 1) % 5 === 0 || i + 1 === rivalryMatchCount) {
							console.log(green(`  ✓ Rivalry matches created: ${i + 1}/${rivalryMatchCount}`));
						}
					}
				}

				// Batch update all season player scores at the end
				for (const [spId, score] of playerScores) {
					await db.update(seasonPlayer).set({ score }).where(eq(seasonPlayer.id, spId));
				}

				// Batch update all season team scores at the end
				for (const [stId, score] of teamScores) {
					await db.update(seasonTeam).set({ score }).where(eq(seasonTeam.id, stId));
				}

				createdCount += matchesCreated;
			}
		}

		if (createdCount === 0) {
			console.log(yellow("\nDatabase already seeded - nothing to do."));
		} else {
			console.log(green("\nSeeding complete!"));
		}

		// Count totals
		const totalUsers = await db.select().from(user);
		const totalMembers = await db.select().from(member);
		const totalPlayers = await db.select().from(player);
		const totalSeasonPlayers = await db.select().from(seasonPlayer);
		const totalMatches = await db.select().from(match);
		const totalLeagueTeams = await db.select().from(leagueTeam);
		const totalSeasonTeams = await db.select().from(seasonTeam);

		console.log(`
${bold("Seed Data:")}
${"─".repeat(40)}
  ${bold("Email:")}          ${SEED_USER.email}
  ${bold("Password:")}       ${SEED_USER.password}
  ${bold("League:")}         ${SEED_LEAGUE.name} (${SEED_LEAGUE.slug})
  ${bold("Season:")}         ${SEED_SEASON.name} (${SEED_SEASON.slug})

${bold("Totals:")}
${"─".repeat(40)}
  ${bold("Users:")}          ${totalUsers.length}
  ${bold("Members:")}        ${totalMembers.length}
  ${bold("Players:")}        ${totalPlayers.length}
  ${bold("Season Players:")} ${totalSeasonPlayers.length}
  ${bold("Matches:")}        ${totalMatches.length}
  ${bold("League Teams:")}   ${totalLeagueTeams.length}
  ${bold("Season Teams:")}   ${totalSeasonTeams.length}
`);

		console.log(yellow("\n💡 For preview/production seeding, use:"));
		console.log(bold("  bun run scripts/trigger-seed.ts"));

		return true;
	} finally {
		sqlite.close();
	}
}

async function main() {
	const args = parseArgs();

	if (args.help) {
		printHelp();
		process.exit(0);
	}

	const workerDir = resolve(import.meta.dir, "..");

	if (args.interactive) {
		const { action, members, matches } = await interactiveMenu();

		switch (action) {
			case "seed":
				await seedDatabase(members, matches, true);
				break;
			case "reset-seed":
				if (await resetDatabase(workerDir)) {
					await seedDatabase(members, matches, true);
				}
				break;
			case "exit":
				console.log("Goodbye!");
				process.exit(0);
		}
	} else {
		if (args.reset) {
			if (!(await resetDatabase(workerDir))) {
				process.exit(1);
			}
		}

		const success = await seedDatabase(args.members, args.matches, false);
		process.exit(success ? 0 : 1);
	}
}

main().catch((error) => {
	console.error(red("Seed script failed:"), error);
	process.exit(1);
});
