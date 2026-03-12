import { and, eq, inArray, sql } from "drizzle-orm";
import { randEmail, randFullName } from "@ngneat/falso";
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

const SEED_SEASON_DEFAULTS = {
	name: "Season 1",
	slug: "season-1",
	initialScore: 1000,
	scoreType: "elo" as const,
	kFactor: 32,
};

export interface SeedInput {
	leagueName: string;
	leagueSlug: string;
	memberCount: number;
	matchCount: number;
	userId: string;
}

export interface SeedResult {
	leagueId: string;
	seasonId: string;
	membersCreated: number;
	matchesCreated: number;
}

async function getOrCreateTeam({
	db,
	leagueId,
	seasonId,
	seasonData,
	players,
	teamScores,
	now,
}: {
	db: DrizzleDB;
	leagueId: string;
	seasonId: string;
	seasonData: { initialScore: number };
	players: { playerId: string; name: string }[];
	teamScores: Map<string, number>;
	now: Date;
}): Promise<{ seasonTeamId: string; score: number }> {
	const playerIds = players.map((p) => p.playerId);

	const [teamIdResult] = await db
		.select({ leagueTeamId: leagueTeamPlayer.leagueTeamId })
		.from(leagueTeamPlayer)
		.where(inArray(leagueTeamPlayer.playerId, playerIds))
		.groupBy(leagueTeamPlayer.leagueTeamId)
		.having(sql`COUNT(DISTINCT ${leagueTeamPlayer.playerId}) = ${players.length}`);

	let leagueTeamId = teamIdResult?.leagueTeamId;

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

	const [existingSeasonTeam] = await db
		.select({ id: seasonTeam.id, score: seasonTeam.score })
		.from(seasonTeam)
		.where(and(eq(seasonTeam.leagueTeamId, leagueTeamId), eq(seasonTeam.seasonId, seasonId)))
		.limit(1);

	if (existingSeasonTeam) {
		const trackedScore = teamScores.get(existingSeasonTeam.id);
		return {
			seasonTeamId: existingSeasonTeam.id,
			score: trackedScore ?? existingSeasonTeam.score,
		};
	}

	const seasonTeamId = createId();
	await db.insert(seasonTeam).values({
		id: seasonTeamId,
		leagueTeamId,
		seasonId,
		score: seasonData.initialScore,
		createdAt: now,
		updatedAt: now,
	});

	teamScores.set(seasonTeamId, seasonData.initialScore);

	return { seasonTeamId, score: seasonData.initialScore };
}

// Simple seeded PRNG (mulberry32) for deterministic randomness
function mulberry32(initialSeed: number) {
	let state = initialSeed;
	return () => {
		state += 0x6d2b79f5;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export async function seedLeague(db: DrizzleDB, input: SeedInput): Promise<SeedResult> {
	const { leagueName, leagueSlug, memberCount, matchCount, userId } = input;
	const now = new Date();
	const rng = mulberry32(Date.now());

	// Verify the user exists
	const [existingUser] = await db.select().from(user).where(eq(user.id, userId));
	if (!existingUser) {
		throw new Error(`User ${userId} not found`);
	}

	// Check slug uniqueness
	const [existingLeague] = await db.select().from(league).where(eq(league.slug, leagueSlug));
	if (existingLeague) {
		throw new Error(`League with slug "${leagueSlug}" already exists`);
	}

	const leagueId = createId();
	const seasonId = createId();

	// Create league
	await db.insert(league).values({
		id: leagueId,
		name: leagueName,
		slug: leagueSlug,
		createdAt: now,
	});

	// Create owner member
	const memberId = createId();
	await db.insert(member).values({
		id: memberId,
		organizationId: leagueId,
		userId,
		role: "owner",
		createdAt: now,
	});

	// Create owner player
	const ownerPlayerId = createId();
	await db.insert(player).values({
		id: ownerPlayerId,
		userId,
		leagueId,
		disabled: false,
		createdAt: now,
		updatedAt: now,
	});

	// Create season
	const startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
	await db.insert(season).values({
		id: seasonId,
		name: SEED_SEASON_DEFAULTS.name,
		slug: SEED_SEASON_DEFAULTS.slug,
		initialScore: SEED_SEASON_DEFAULTS.initialScore,
		scoreType: SEED_SEASON_DEFAULTS.scoreType,
		kFactor: SEED_SEASON_DEFAULTS.kFactor,
		startDate,
		endDate: null,
		leagueId,
		archived: false,
		closed: false,
		createdBy: userId,
		updatedBy: userId,
		createdAt: now,
		updatedAt: now,
	});

	// Add owner as season player
	const ownerSeasonPlayerId = createId();
	await db.insert(seasonPlayer).values({
		id: ownerSeasonPlayerId,
		seasonId,
		playerId: ownerPlayerId,
		score: SEED_SEASON_DEFAULTS.initialScore,
		disabled: false,
		createdAt: now,
		updatedAt: now,
	});

	// Create additional members
	let membersCreated = 0;

	const allSeasonPlayers: {
		id: string;
		score: number;
		playerId: string;
	}[] = [
		{ id: ownerSeasonPlayerId, score: SEED_SEASON_DEFAULTS.initialScore, playerId: ownerPlayerId },
	];

	const playerNameMap = new Map<string, string>();
	playerNameMap.set(ownerPlayerId, existingUser.name);

	for (let i = 0; i < memberCount; i++) {
		const name = randFullName();
		const email = randEmail();
		const newUserId = createId();

		// Check if email already exists
		const [existing] = await db.select().from(user).where(eq(user.email, email));
		let memberUserId: string;

		if (existing) {
			memberUserId = existing.id;
		} else {
			memberUserId = newUserId;
			await db.insert(user).values({
				id: newUserId,
				name,
				email,
				emailVerified: true,
				createdAt: now,
				updatedAt: now,
			});

			const hashedPassword = await hashPassword("Test.1234");
			await db.insert(account).values({
				id: createId(),
				accountId: newUserId,
				providerId: "credential",
				userId: newUserId,
				password: hashedPassword,
				createdAt: now,
				updatedAt: now,
			});
		}

		await db.insert(member).values({
			id: createId(),
			organizationId: leagueId,
			userId: memberUserId,
			role: "member",
			createdAt: now,
		});

		const newPlayerId = createId();
		await db.insert(player).values({
			id: newPlayerId,
			userId: memberUserId,
			leagueId,
			disabled: false,
			createdAt: now,
			updatedAt: now,
		});

		const spId = createId();
		await db.insert(seasonPlayer).values({
			id: spId,
			seasonId,
			playerId: newPlayerId,
			score: SEED_SEASON_DEFAULTS.initialScore,
			disabled: false,
			createdAt: now,
			updatedAt: now,
		});

		allSeasonPlayers.push({
			id: spId,
			score: SEED_SEASON_DEFAULTS.initialScore,
			playerId: newPlayerId,
		});

		playerNameMap.set(newPlayerId, name);
		membersCreated++;
	}

	// Create matches (need at least 4 players)
	let matchesCreated = 0;
	if (matchCount > 0 && allSeasonPlayers.length >= 4) {
		const seasonData = {
			initialScore: SEED_SEASON_DEFAULTS.initialScore,
			scoreType: SEED_SEASON_DEFAULTS.scoreType,
			kFactor: SEED_SEASON_DEFAULTS.kFactor,
			leagueId,
		};

		const playerScores = new Map(allSeasonPlayers.map((p) => [p.id, p.score]));
		const playerIdMap = new Map(allSeasonPlayers.map((p) => [p.id, p.playerId]));
		const teamScores = new Map<string, number>();
		const existingTeams: Array<{ players: string[]; seasonTeamId: string }> = [];

		for (let i = 0; i < matchCount; i++) {
			let homePlayerIds: string[];
			let awayPlayerIds: string[];

			if (i > 5 && rng() < 0.6 && existingTeams.length >= 2) {
				const shuffledTeams = [...existingTeams].sort(() => rng() - 0.5);
				homePlayerIds = shuffledTeams[0].players;
				awayPlayerIds = shuffledTeams[1].players;
			} else {
				const shuffled = [...allSeasonPlayers].sort(() => rng() - 0.5);
				homePlayerIds = [shuffled[0].id, shuffled[1].id];
				awayPlayerIds = [shuffled[2].id, shuffled[3].id];
			}

			const homeScore = Math.floor(rng() * 11);
			const awayScore = Math.floor(rng() * 11);
			const matchId = createId();

			const homePlayers = homePlayerIds.map((id) => ({
				id,
				score: playerScores.get(id) ?? seasonData.initialScore,
				playerId: playerIdMap.get(id) ?? "",
				name: playerNameMap.get(playerIdMap.get(id) ?? "") ?? "",
			}));
			const awayPlayers = awayPlayerIds.map((id) => ({
				id,
				score: playerScores.get(id) ?? seasonData.initialScore,
				playerId: playerIdMap.get(id) ?? "",
				name: playerNameMap.get(playerIdMap.get(id) ?? "") ?? "",
			}));

			const eloResult = calculateEloMatch({
				scoreType: seasonData.scoreType as "elo",
				kFactor: seasonData.kFactor,
				homeScore,
				awayScore,
				homePlayers: homePlayers.map((p) => ({ id: p.id, score: p.score })),
				awayPlayers: awayPlayers.map((p) => ({ id: p.id, score: p.score })),
			});

			const { homeResult, awayResult } = determineMatchResult(homeScore, awayScore);
			const matchNow = new Date(now.getTime() - (matchCount - i) * 5 * 60000);

			await db.insert(match).values({
				id: matchId,
				seasonId,
				homeScore,
				awayScore,
				homeExpectedElo: eloResult.homeTeam.winningOdds,
				awayExpectedElo: eloResult.awayTeam.winningOdds,
				createdBy: userId,
				updatedBy: userId,
				createdAt: matchNow,
				updatedAt: matchNow,
			});

			await db.insert(matchPlayer).values([
				...homePlayerIds.map((id, idx) => {
					const playerResult = eloResult.homeTeam.players.find((p) => p.id === id);
					return {
						id: createId(),
						matchId,
						seasonPlayerId: id,
						homeTeam: true,
						result: homeResult,
						scoreBefore: homePlayers[idx].score,
						scoreAfter: playerResult?.scoreAfter ?? homePlayers[idx].score,
						createdAt: matchNow,
						updatedAt: matchNow,
					};
				}),
				...awayPlayerIds.map((id, idx) => {
					const playerResult = eloResult.awayTeam.players.find((p) => p.id === id);
					return {
						id: createId(),
						matchId,
						seasonPlayerId: id,
						homeTeam: false,
						result: awayResult,
						scoreBefore: awayPlayers[idx].score,
						scoreAfter: playerResult?.scoreAfter ?? awayPlayers[idx].score,
						createdAt: matchNow,
						updatedAt: matchNow,
					};
				}),
			]);

			for (const pr of eloResult.homeTeam.players) {
				playerScores.set(pr.id, pr.scoreAfter);
			}
			for (const pr of eloResult.awayTeam.players) {
				playerScores.set(pr.id, pr.scoreAfter);
			}

			// Handle teams
			const homeTeamPlayersData = homePlayers.map((p) => ({
				playerId: p.playerId,
				name: p.name,
			}));
			const homeTeamResult = await getOrCreateTeam({
				db,
				leagueId,
				seasonId,
				seasonData,
				players: homeTeamPlayersData,
				teamScores,
				now: matchNow,
			});

			const awayTeamPlayersData = awayPlayers.map((p) => ({
				playerId: p.playerId,
				name: p.name,
			}));
			const awayTeamResult = await getOrCreateTeam({
				db,
				leagueId,
				seasonId,
				seasonData,
				players: awayTeamPlayersData,
				teamScores,
				now: matchNow,
			});

			const teamEloResult = calculateEloMatch({
				scoreType: seasonData.scoreType as "elo",
				kFactor: seasonData.kFactor,
				homeScore,
				awayScore,
				homePlayers: [{ id: homeTeamResult.seasonTeamId, score: homeTeamResult.score }],
				awayPlayers: [{ id: awayTeamResult.seasonTeamId, score: awayTeamResult.score }],
			});

			const homeTeamScoreAfter =
				teamEloResult.homeTeam.players.find((p) => p.id === homeTeamResult.seasonTeamId)
					?.scoreAfter ?? homeTeamResult.score;
			const awayTeamScoreAfter =
				teamEloResult.awayTeam.players.find((p) => p.id === awayTeamResult.seasonTeamId)
					?.scoreAfter ?? awayTeamResult.score;

			await db.insert(matchTeam).values([
				{
					id: createId(),
					matchId,
					seasonTeamId: homeTeamResult.seasonTeamId,
					scoreBefore: homeTeamResult.score,
					scoreAfter: homeTeamScoreAfter,
					result: homeResult,
					createdAt: matchNow,
					updatedAt: matchNow,
				},
				{
					id: createId(),
					matchId,
					seasonTeamId: awayTeamResult.seasonTeamId,
					scoreBefore: awayTeamResult.score,
					scoreAfter: awayTeamScoreAfter,
					result: awayResult,
					createdAt: matchNow,
					updatedAt: matchNow,
				},
			]);

			teamScores.set(homeTeamResult.seasonTeamId, homeTeamScoreAfter);
			teamScores.set(awayTeamResult.seasonTeamId, awayTeamScoreAfter);

			// Track teams for rivalries
			if (
				!existingTeams.find(
					(t) =>
						t.players.length === homePlayerIds.length &&
						t.players.every((p) => homePlayerIds.includes(p))
				)
			) {
				existingTeams.push({ players: homePlayerIds, seasonTeamId: homeTeamResult.seasonTeamId });
			}
			if (
				!existingTeams.find(
					(t) =>
						t.players.length === awayPlayerIds.length &&
						t.players.every((p) => awayPlayerIds.includes(p))
				)
			) {
				existingTeams.push({ players: awayPlayerIds, seasonTeamId: awayTeamResult.seasonTeamId });
			}

			matchesCreated++;
		}

		// Update all season player scores
		for (const [spId, score] of playerScores) {
			await db.update(seasonPlayer).set({ score }).where(eq(seasonPlayer.id, spId));
		}

		// Update all season team scores
		for (const [stId, score] of teamScores) {
			await db.update(seasonTeam).set({ score }).where(eq(seasonTeam.id, stId));
		}
	}

	return {
		leagueId,
		seasonId,
		membersCreated,
		matchesCreated,
	};
}
