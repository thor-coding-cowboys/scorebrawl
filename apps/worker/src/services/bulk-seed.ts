import { sql, eq } from "drizzle-orm";
import type { DrizzleDB } from "../db";
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
} from "../db/schema";
import { createId } from "../utils/id-util";
import { hashPassword } from "../lib/password";
import { calculateEloMatch, determineMatchResult } from "@coding-cowboys/scorebrawl-util/elo-util";

// Seed configuration
const SEED_USER = {
	email: "seed@scorebrawl.com",
	password: "Test.1234",
	name: "Seed User",
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

// Batch size for bulk inserts
const BATCH_SIZE = 1000;

export type SeedQueueMessage = {
	action: "bulk-seed";
	memberCount: number;
	matchCount: number;
};

// Generate random email
function generateEmail(index: number): string {
	return `seed-${index}-${Math.random().toString(36).substring(2, 8)}@example.com`;
}

// Generate random name
function generateName(index: number): string {
	const firstNames = [
		"James",
		"Mary",
		"John",
		"Patricia",
		"Robert",
		"Jennifer",
		"Michael",
		"Linda",
		"William",
		"Elizabeth",
		"David",
		"Barbara",
		"Richard",
		"Susan",
		"Joseph",
		"Jessica",
		"Thomas",
		"Sarah",
		"Charles",
		"Karen",
		"Christopher",
		"Nancy",
		"Daniel",
		"Lisa",
		"Matthew",
		"Betty",
		"Anthony",
		"Margaret",
		"Mark",
		"Sandra",
		"Donald",
		"Ashley",
		"Steven",
		"Kimberly",
		"Paul",
		"Emily",
		"Andrew",
		"Donna",
		"Joshua",
		"Michelle",
		"Kenneth",
		"Dorothy",
		"Kevin",
		"Carol",
		"Brian",
		"Amanda",
		"George",
		"Melissa",
		"Edward",
		"Deborah",
		"Ronald",
		"Stephanie",
		"Timothy",
		"Rebecca",
		"Jason",
		"Sharon",
		"Jeffrey",
		"Laura",
		"Ryan",
		"Cynthia",
		"Jacob",
		"Kathleen",
		"Gary",
		"Amy",
		"Nicholas",
		"Shirley",
		"Eric",
		"Angela",
		"Jonathan",
		"Helen",
		"Stephen",
		"Anna",
		"Larry",
		"Brenda",
		"Justin",
		"Pamela",
		"Scott",
		"Nicole",
		"Brandon",
		"Emma",
	];
	const lastNames = [
		"Smith",
		"Johnson",
		"Williams",
		"Brown",
		"Jones",
		"Garcia",
		"Miller",
		"Davis",
		"Rodriguez",
		"Martinez",
		"Hernandez",
		"Lopez",
		"Gonzalez",
		"Wilson",
		"Anderson",
		"Thomas",
		"Taylor",
		"Moore",
		"Jackson",
		"Martin",
		"Lee",
		"Perez",
		"Thompson",
		"White",
		"Harris",
		"Sanchez",
		"Clark",
		"Ramirez",
		"Lewis",
		"Robinson",
		"Walker",
		"Young",
		"Allen",
		"King",
		"Wright",
		"Scott",
		"Torres",
		"Nguyen",
		"Hill",
		"Flores",
	];
	const firstName = firstNames[index % firstNames.length];
	const lastName = lastNames[Math.floor(index / firstNames.length) % lastNames.length];
	return `${firstName} ${lastName}`;
}

// Generate random scores (0-10)
function generateScore(): number {
	return Math.floor(Math.random() * 11);
}

export async function runBulkSeed(
	db: DrizzleDB,
	{ memberCount, matchCount }: { memberCount: number; matchCount: number }
): Promise<{ success: boolean; message: string; stats: Record<string, number> }> {
	const now = new Date();
	const stats = {
		users: 0,
		accounts: 0,
		members: 0,
		players: 0,
		seasonPlayers: 0,
		matches: 0,
		matchTeams: 0,
		matchPlayers: 0,
		leagueTeams: 0,
		seasonTeams: 0,
	};

	try {
		// Step 1: Create main seed user (owner)
		const ownerUserId = createId();
		await db.insert(user).values({
			id: ownerUserId,
			name: SEED_USER.name,
			email: SEED_USER.email,
			emailVerified: true,
			createdAt: now,
			updatedAt: now,
		});
		stats.users++;

		// Create owner account
		const hashedPassword = await hashPassword(SEED_USER.password);
		await db.insert(account).values({
			id: createId(),
			accountId: ownerUserId,
			providerId: "credential",
			userId: ownerUserId,
			password: hashedPassword,
			createdAt: now,
			updatedAt: now,
		});
		stats.accounts++;

		// Step 2: Create league
		const leagueId = createId();
		await db.insert(league).values({
			id: leagueId,
			name: SEED_LEAGUE.name,
			slug: SEED_LEAGUE.slug,
			createdAt: now,
		});

		// Create member (owner role)
		await db.insert(member).values({
			id: createId(),
			organizationId: leagueId,
			userId: ownerUserId,
			role: "owner",
			createdAt: now,
		});
		stats.members++;

		// Create owner player
		const ownerPlayerId = createId();
		await db.insert(player).values({
			id: ownerPlayerId,
			userId: ownerUserId,
			leagueId: leagueId,
			disabled: false,
			createdAt: now,
			updatedAt: now,
		});
		stats.players++;

		// Step 3: Create season
		const seasonId = createId();
		const startDate = new Date();
		startDate.setDate(startDate.getDate() - 7);

		await db.insert(season).values({
			id: seasonId,
			name: SEED_SEASON.name,
			slug: SEED_SEASON.slug,
			initialScore: SEED_SEASON.initialScore,
			scoreType: SEED_SEASON.scoreType,
			kFactor: SEED_SEASON.kFactor,
			startDate: startDate,
			endDate: null,
			leagueId: leagueId,
			archived: false,
			closed: false,
			createdBy: ownerUserId,
			updatedBy: ownerUserId,
			createdAt: now,
			updatedAt: now,
		});

		// Add owner as season player
		await db.insert(seasonPlayer).values({
			id: createId(),
			seasonId: seasonId,
			playerId: ownerPlayerId,
			score: SEED_SEASON.initialScore,
			disabled: false,
			createdAt: now,
			updatedAt: now,
		});
		stats.seasonPlayers++;

		// Step 4: Create additional members in batches
		if (memberCount > 0) {
			const userBatch: (typeof user.$inferInsert)[] = [];
			const accountBatch: (typeof account.$inferInsert)[] = [];
			const memberBatch: (typeof member.$inferInsert)[] = [];
			const playerBatch: (typeof player.$inferInsert)[] = [];
			const seasonPlayerBatch: (typeof seasonPlayer.$inferInsert)[] = [];

			for (let i = 0; i < memberCount; i++) {
				const newUserId = createId();
				const newPlayerId = createId();

				userBatch.push({
					id: newUserId,
					name: generateName(i),
					email: generateEmail(i),
					emailVerified: true,
					createdAt: now,
					updatedAt: now,
				});

				accountBatch.push({
					id: createId(),
					accountId: newUserId,
					providerId: "credential",
					userId: newUserId,
					password: hashedPassword,
					createdAt: now,
					updatedAt: now,
				});

				memberBatch.push({
					id: createId(),
					organizationId: leagueId,
					userId: newUserId,
					role: "member",
					createdAt: now,
				});

				playerBatch.push({
					id: newPlayerId,
					userId: newUserId,
					leagueId: leagueId,
					disabled: false,
					createdAt: now,
					updatedAt: now,
				});

				seasonPlayerBatch.push({
					id: createId(),
					seasonId: seasonId,
					playerId: newPlayerId,
					score: SEED_SEASON.initialScore,
					disabled: false,
					createdAt: now,
					updatedAt: now,
				});

				// Insert batch when full
				if (userBatch.length >= BATCH_SIZE) {
					await db.insert(user).values(userBatch);
					await db.insert(account).values(accountBatch);
					await db.insert(member).values(memberBatch);
					await db.insert(player).values(playerBatch);
					await db.insert(seasonPlayer).values(seasonPlayerBatch);

					stats.users += userBatch.length;
					stats.accounts += accountBatch.length;
					stats.members += memberBatch.length;
					stats.players += playerBatch.length;
					stats.seasonPlayers += seasonPlayerBatch.length;

					userBatch.length = 0;
					accountBatch.length = 0;
					memberBatch.length = 0;
					playerBatch.length = 0;
					seasonPlayerBatch.length = 0;
				}
			}

			// Insert remaining batch
			if (userBatch.length > 0) {
				await db.insert(user).values(userBatch);
				await db.insert(account).values(accountBatch);
				await db.insert(member).values(memberBatch);
				await db.insert(player).values(playerBatch);
				await db.insert(seasonPlayer).values(seasonPlayerBatch);

				stats.users += userBatch.length;
				stats.accounts += accountBatch.length;
				stats.members += memberBatch.length;
				stats.players += playerBatch.length;
				stats.seasonPlayers += seasonPlayerBatch.length;
			}
		}

		// Step 5: Create matches (requires at least 4 players for 2v2)
		if (matchCount > 0) {
			const allSeasonPlayers = await db
				.select({
					id: seasonPlayer.id,
					score: seasonPlayer.score,
					playerId: seasonPlayer.playerId,
				})
				.from(seasonPlayer)
				.where(sql`${seasonPlayer.seasonId} = ${seasonId}`);

			if (allSeasonPlayers.length >= 4) {
				const playerScores = new Map(allSeasonPlayers.map((p) => [p.id, p.score]));
				const playerIdMap = new Map(allSeasonPlayers.map((p) => [p.id, p.playerId]));
				const teamScores = new Map<string, number>();

				const matchBatch: (typeof match.$inferInsert)[] = [];
				const matchTeamBatch: (typeof matchTeam.$inferInsert)[] = [];
				const matchPlayerBatch: (typeof matchPlayer.$inferInsert)[] = [];
				const leagueTeamBatch: (typeof leagueTeam.$inferInsert)[] = [];
				const leagueTeamPlayerBatch: (typeof leagueTeamPlayer.$inferInsert)[] = [];
				const seasonTeamBatch: (typeof seasonTeam.$inferInsert)[] = [];

				// Track league teams and season teams for deduplication
				const leagueTeamMap = new Map<string, string>(); // playerIds hash -> leagueTeamId
				const seasonTeamMap = new Map<string, string>(); // leagueTeamId -> seasonTeamId

				for (let i = 0; i < matchCount; i++) {
					// Select 4 random players
					const shuffled = [...allSeasonPlayers].sort(() => Math.random() - 0.5);
					const selected = shuffled.slice(0, 4);
					const homeSeasonPlayerIds = [selected[0].id, selected[1].id];
					const awaySeasonPlayerIds = [selected[2].id, selected[3].id];

					const homeScore = generateScore();
					const awayScore = generateScore();

					// Get or create teams
					const homeTeamResult = await getOrCreateTeamBatch(
						leagueId,
						seasonId,
						homeSeasonPlayerIds,
						playerIdMap,
						leagueTeamMap,
						seasonTeamMap,
						teamScores,
						leagueTeamBatch,
						leagueTeamPlayerBatch,
						seasonTeamBatch,
						now
					);

					const awayTeamResult = await getOrCreateTeamBatch(
						leagueId,
						seasonId,
						awaySeasonPlayerIds,
						playerIdMap,
						leagueTeamMap,
						seasonTeamMap,
						teamScores,
						leagueTeamBatch,
						leagueTeamPlayerBatch,
						seasonTeamBatch,
						now
					);

					// Get player scores for ELO calculation
					const homePlayers = homeSeasonPlayerIds.map((id) => ({
						id,
						score: playerScores.get(id) ?? SEED_SEASON.initialScore,
					}));
					const awayPlayers = awaySeasonPlayerIds.map((id) => ({
						id,
						score: playerScores.get(id) ?? SEED_SEASON.initialScore,
					}));

					// Calculate ELO
					const eloResult = calculateEloMatch({
						scoreType: SEED_SEASON.scoreType,
						kFactor: SEED_SEASON.kFactor,
						homeScore,
						awayScore,
						homePlayers,
						awayPlayers,
					});

					// Create match
					const matchId = createId();
					matchBatch.push({
						id: matchId,
						seasonId: seasonId,
						homeScore,
						awayScore,
						createdBy: ownerUserId,
						createdAt: new Date(now.getTime() - (matchCount - i) * 1000 * 60 * 60), // Spread over time
						updatedBy: ownerUserId,
						updatedAt: now,
					});

					// Determine results
					const { homeResult, awayResult } = determineMatchResult(homeScore, awayScore);

					// Create match teams
					const homeMatchTeamId = createId();
					const awayMatchTeamId = createId();

					matchTeamBatch.push({
						id: homeMatchTeamId,
						matchId: matchId,
						seasonTeamId: homeTeamResult.seasonTeamId,
						result: homeResult,
						createdAt: now,
						updatedAt: now,
					});

					matchTeamBatch.push({
						id: awayMatchTeamId,
						matchId: matchId,
						seasonTeamId: awayTeamResult.seasonTeamId,
						result: awayResult,
						createdAt: now,
						updatedAt: now,
					});

					// Update team scores
					const homeScoreAfter =
						eloResult.homeTeam.players.reduce((sum, p) => sum + p.scoreAfter, 0) /
						homePlayers.length;
					const awayScoreAfter =
						eloResult.awayTeam.players.reduce((sum, p) => sum + p.scoreAfter, 0) /
						awayPlayers.length;
					teamScores.set(homeTeamResult.seasonTeamId, homeScoreAfter);
					teamScores.set(awayTeamResult.seasonTeamId, awayScoreAfter);

					// Create match players
					for (let j = 0; j < homeSeasonPlayerIds.length; j++) {
						const seasonPlayerId = homeSeasonPlayerIds[j];
						const playerId = playerIdMap.get(seasonPlayerId);
						if (!playerId) continue;

						const scoreBefore = playerScores.get(seasonPlayerId) ?? SEED_SEASON.initialScore;
						const scoreAfter =
							eloResult.homeTeam.players.find((p) => p.id === seasonPlayerId)?.scoreAfter ??
							scoreBefore;
						playerScores.set(seasonPlayerId, scoreAfter);

						matchPlayerBatch.push({
							id: createId(),
							matchId: matchId,
							seasonPlayerId: seasonPlayerId,
							homeTeam: true,
							result: homeResult,
							scoreBefore,
							scoreAfter,
							createdAt: now,
							updatedAt: now,
						});
					}

					for (let j = 0; j < awaySeasonPlayerIds.length; j++) {
						const seasonPlayerId = awaySeasonPlayerIds[j];
						const playerId = playerIdMap.get(seasonPlayerId);
						if (!playerId) continue;

						const scoreBefore = playerScores.get(seasonPlayerId) ?? SEED_SEASON.initialScore;
						const scoreAfter =
							eloResult.awayTeam.players.find((p) => p.id === seasonPlayerId)?.scoreAfter ??
							scoreBefore;
						playerScores.set(seasonPlayerId, scoreAfter);

						matchPlayerBatch.push({
							id: createId(),
							matchId: matchId,
							seasonPlayerId: seasonPlayerId,
							homeTeam: false,
							result: awayResult,
							scoreBefore,
							scoreAfter,
							createdAt: now,
							updatedAt: now,
						});
					}

					// Insert batches when full
					if (matchBatch.length >= BATCH_SIZE) {
						await insertMatchBatches(
							db,
							matchBatch,
							matchTeamBatch,
							matchPlayerBatch,
							leagueTeamBatch,
							leagueTeamPlayerBatch,
							seasonTeamBatch
						);
						stats.matches += matchBatch.length;
						stats.matchTeams += matchTeamBatch.length;
						stats.matchPlayers += matchPlayerBatch.length;
						stats.leagueTeams += leagueTeamBatch.length;
						stats.seasonTeams += seasonTeamBatch.length;

						matchBatch.length = 0;
						matchTeamBatch.length = 0;
						matchPlayerBatch.length = 0;
						leagueTeamBatch.length = 0;
						leagueTeamPlayerBatch.length = 0;
						seasonTeamBatch.length = 0;
					}
				}

				// Insert remaining batches
				if (matchBatch.length > 0) {
					await insertMatchBatches(
						db,
						matchBatch,
						matchTeamBatch,
						matchPlayerBatch,
						leagueTeamBatch,
						leagueTeamPlayerBatch,
						seasonTeamBatch
					);
					stats.matches += matchBatch.length;
					stats.matchTeams += matchTeamBatch.length;
					stats.matchPlayers += matchPlayerBatch.length;
					stats.leagueTeams += leagueTeamBatch.length;
					stats.seasonTeams += seasonTeamBatch.length;
				}

				// Update all player scores
				for (const [seasonPlayerId, score] of playerScores) {
					await db.update(seasonPlayer).set({ score }).where(eq(seasonPlayer.id, seasonPlayerId));
				}

				// Update all team scores
				for (const [seasonTeamId, score] of teamScores) {
					await db.update(seasonTeam).set({ score }).where(eq(seasonTeam.id, seasonTeamId));
				}
			}
		}

		return {
			success: true,
			message: "Bulk seed completed successfully",
			stats,
		};
	} catch (error) {
		console.error("Bulk seed failed:", error);
		return {
			success: false,
			message: `Bulk seed failed: ${error instanceof Error ? error.message : "Unknown error"}`,
			stats,
		};
	}
}

async function getOrCreateTeamBatch(
	leagueId: string,
	seasonId: string,
	seasonPlayerIds: string[],
	playerIdMap: Map<string, string>,
	leagueTeamMap: Map<string, string>,
	seasonTeamMap: Map<string, string>,
	teamScores: Map<string, number>,
	leagueTeamBatch: (typeof leagueTeam.$inferInsert)[],
	leagueTeamPlayerBatch: (typeof leagueTeamPlayer.$inferInsert)[],
	seasonTeamBatch: (typeof seasonTeam.$inferInsert)[],
	now: Date
): Promise<{ seasonTeamId: string; score: number }> {
	const playerIdsKey = seasonPlayerIds.sort().join(",");
	let leagueTeamId = leagueTeamMap.get(playerIdsKey);

	if (!leagueTeamId) {
		// Create new league team
		leagueTeamId = createId();
		const teamName = seasonPlayerIds
			.map((id) => {
				const playerId = playerIdMap.get(id);
				return playerId ? `Player${playerId.slice(0, 4)}` : "Unknown";
			})
			.join(" & ");

		leagueTeamBatch.push({
			id: leagueTeamId,
			name: teamName,
			leagueId,
			createdAt: now,
			updatedAt: now,
		});

		for (const seasonPlayerId of seasonPlayerIds) {
			const playerId = playerIdMap.get(seasonPlayerId);
			if (playerId) {
				leagueTeamPlayerBatch.push({
					id: createId(),
					leagueTeamId,
					playerId,
					createdAt: now,
					updatedAt: now,
				});
			}
		}

		leagueTeamMap.set(playerIdsKey, leagueTeamId);
	}

	let seasonTeamId = seasonTeamMap.get(leagueTeamId);
	if (!seasonTeamId) {
		seasonTeamId = createId();
		seasonTeamBatch.push({
			id: seasonTeamId,
			leagueTeamId,
			seasonId,
			score: 1000,
			createdAt: now,
			updatedAt: now,
		});
		seasonTeamMap.set(leagueTeamId, seasonTeamId);
		teamScores.set(seasonTeamId, 1000);
	}

	const score = teamScores.get(seasonTeamId) ?? 1000;
	return { seasonTeamId, score };
}

async function insertMatchBatches(
	db: DrizzleDB,
	matchBatch: (typeof match.$inferInsert)[],
	matchTeamBatch: (typeof matchTeam.$inferInsert)[],
	matchPlayerBatch: (typeof matchPlayer.$inferInsert)[],
	leagueTeamBatch: (typeof leagueTeam.$inferInsert)[],
	leagueTeamPlayerBatch: (typeof leagueTeamPlayer.$inferInsert)[],
	seasonTeamBatch: (typeof seasonTeam.$inferInsert)[]
) {
	if (leagueTeamBatch.length > 0) {
		await db.insert(leagueTeam).values(leagueTeamBatch).onConflictDoNothing();
	}
	if (leagueTeamPlayerBatch.length > 0) {
		await db.insert(leagueTeamPlayer).values(leagueTeamPlayerBatch).onConflictDoNothing();
	}
	if (seasonTeamBatch.length > 0) {
		await db.insert(seasonTeam).values(seasonTeamBatch).onConflictDoNothing();
	}
	if (matchBatch.length > 0) {
		await db.insert(match).values(matchBatch);
	}
	if (matchTeamBatch.length > 0) {
		await db.insert(matchTeam).values(matchTeamBatch);
	}
	if (matchPlayerBatch.length > 0) {
		await db.insert(matchPlayer).values(matchPlayerBatch);
	}
}
