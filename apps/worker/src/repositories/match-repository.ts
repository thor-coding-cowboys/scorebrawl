import { and, desc, eq, gt, sql, inArray } from "drizzle-orm";
import { newId } from "@coding-cowboys/scorebrawl-util/id-util";
import { calculateElo } from "@coding-cowboys/scorebrawl-util/elo-util";
import type { DrizzleDB } from "../db";
import { withTransaction } from "../db";
import { user } from "../db/schema/auth-schema";
import {
	guest,
	seasonPlayer,
	season,
	match,
	matchPlayer,
	matchTeam,
	type matchResult,
	player,
	leagueTeamPlayer,
	leagueTeam,
	seasonTeam,
} from "../db/schema/league-schema";

// D1 allows max 100 bound parameters per query
const D1_BATCH_SIZE = 10;

export interface MatchCreateInput {
	id?: string;
	seasonId: string;
	homeScore: number;
	awayScore: number;
	homeTeamPlayerIds: string[];
	awayTeamPlayerIds: string[];
	userId: string;
}

type CalculateMatchTeamResult = {
	winningOdds: number;
	players: { id: string; scoreAfter: number }[];
};

type SeasonData = {
	scoreType: "elo" | "3-1-0" | "elo-individual-vs-team";
	kFactor: number;
	initialScore: number;
};

const calculateMatchResult = ({
	seasonData,
	homeScore,
	awayScore,
	homePlayers,
	awayPlayers,
}: {
	seasonData: SeasonData;
	homeScore: number;
	awayScore: number;
	homePlayers: { id: string; score: number }[];
	awayPlayers: { id: string; score: number }[];
}): {
	homeTeam: CalculateMatchTeamResult;
	awayTeam: CalculateMatchTeamResult;
} => {
	if (seasonData.scoreType === "elo" || seasonData.scoreType === "elo-individual-vs-team") {
		return calculateElo({
			kFactor: seasonData.kFactor,
			scoreType: seasonData.scoreType,
			homeScore,
			awayScore,
			homePlayers,
			awayPlayers,
		});
	}

	if (seasonData.scoreType === "3-1-0") {
		return calculate310(homePlayers, homeScore, awayScore, awayPlayers);
	}

	throw new Error("Invalid score type");
};

const calculate310 = (
	homePlayers: { id: string; score: number }[],
	homeScore: number,
	awayScore: number,
	awayPlayers: { id: string; score: number }[]
) => ({
	homeTeam: {
		winningOdds: 0.5,
		players: homePlayers.map((p) => ({
			id: p.id,
			scoreAfter: p.score + (homeScore > awayScore ? 3 : homeScore === awayScore ? 1 : 0),
		})),
	},
	awayTeam: {
		winningOdds: 0.5,
		players: awayPlayers.map((p) => ({
			id: p.id,
			scoreAfter: p.score + (awayScore > homeScore ? 3 : awayScore === homeScore ? 1 : 0),
		})),
	},
});

type DbOrTx = DrizzleDB | Parameters<Parameters<DrizzleDB["transaction"]>[0]>[0];

const getOrInsertTeam = async ({
	db,
	seasonData,
	players,
	now,
}: {
	db: DbOrTx;
	seasonData: SeasonData & { id: string; leagueId: string };
	players: { id: string; playerId: string; name: string }[];
	now: Date;
}): Promise<{ seasonTeamId: string; score: number }> => {
	// Find team by matching all player IDs
	const [teamIdResult] = await db
		.select({ leagueTeamId: leagueTeamPlayer.leagueTeamId })
		.from(leagueTeamPlayer)
		.where(
			inArray(
				leagueTeamPlayer.playerId,
				players.map((p) => p.playerId)
			)
		)
		.groupBy(leagueTeamPlayer.leagueTeamId)
		.having(sql`COUNT(DISTINCT ${leagueTeamPlayer.playerId}) = ${players.length}`);

	let leagueTeamId = teamIdResult?.leagueTeamId;

	// Create league team if doesn't exist
	if (!leagueTeamId) {
		leagueTeamId = newId("team");
		const teamName = players.map((p) => p.name.split(" ")[0]).join(" & ");

		await db.insert(leagueTeam).values({
			id: leagueTeamId,
			name: teamName,
			leagueId: seasonData.leagueId,
			createdAt: now,
			updatedAt: now,
		});

		const teamPlayerValues = players.map((p) => ({
			id: newId("team"),
			leagueTeamId: leagueTeamId as string,
			playerId: p.playerId,
			createdAt: now,
			updatedAt: now,
		}));
		for (let i = 0; i < teamPlayerValues.length; i += D1_BATCH_SIZE) {
			await db.insert(leagueTeamPlayer).values(teamPlayerValues.slice(i, i + D1_BATCH_SIZE));
		}
	}

	// Check if season team exists
	const [existingSeasonTeam] = await db
		.select({ id: seasonTeam.id, score: seasonTeam.score })
		.from(seasonTeam)
		.where(and(eq(seasonTeam.leagueTeamId, leagueTeamId), eq(seasonTeam.seasonId, seasonData.id)))
		.limit(1);

	if (existingSeasonTeam) {
		return { seasonTeamId: existingSeasonTeam.id, score: existingSeasonTeam.score };
	}

	// Create season team
	const seasonTeamId = newId("team");
	await db.insert(seasonTeam).values({
		id: seasonTeamId,
		leagueTeamId,
		seasonId: seasonData.id,
		score: seasonData.initialScore,
		createdAt: now,
		updatedAt: now,
	});

	return { seasonTeamId, score: seasonData.initialScore };
};

export const create = async ({ db, input }: { db: DrizzleDB; input: MatchCreateInput }) => {
	return withTransaction(db, async (tx) => {
		const now = new Date();
		const matchId = input.id ?? newId("match");

		// Get season data for ELO calculation
		const [seasonData] = await tx
			.select({
				id: season.id,
				scoreType: season.scoreType,
				kFactor: season.kFactor,
				initialScore: season.initialScore,
				leagueId: season.leagueId,
			})
			.from(season)
			.where(eq(season.id, input.seasonId));

		if (!seasonData) {
			throw new Error("Season not found");
		}

		// Get current scores for all players with their names
		const allPlayerIds = [...input.homeTeamPlayerIds, ...input.awayTeamPlayerIds];
		const seasonPlayerData = await tx
			.select({
				id: seasonPlayer.id,
				score: seasonPlayer.score,
				playerId: seasonPlayer.playerId,
				name: sql<string>`COALESCE(${user.name}, ${guest.displayName})`.as("name"),
			})
			.from(seasonPlayer)
			.innerJoin(player, eq(seasonPlayer.playerId, player.id))
			.leftJoin(user, eq(player.userId, user.id))
			.leftJoin(guest, eq(player.guestId, guest.id))
			.where(
				and(eq(seasonPlayer.seasonId, input.seasonId), sql`${seasonPlayer.id} IN ${allPlayerIds}`)
			);

		const playerDataMap = new Map(seasonPlayerData.map((p) => [p.id, p]));

		// Prepare players data for ELO calculation
		const homePlayers = input.homeTeamPlayerIds.map((id) => ({
			id,
			score: playerDataMap.get(id)?.score || seasonData.initialScore,
			playerId: playerDataMap.get(id)?.playerId || "",
			name: playerDataMap.get(id)?.name || "",
		}));

		const awayPlayers = input.awayTeamPlayerIds.map((id) => ({
			id,
			score: playerDataMap.get(id)?.score || seasonData.initialScore,
			playerId: playerDataMap.get(id)?.playerId || "",
			name: playerDataMap.get(id)?.name || "",
		}));

		// Calculate ELO scores
		const eloResult = calculateMatchResult({
			seasonData,
			homeScore: input.homeScore,
			awayScore: input.awayScore,
			homePlayers,
			awayPlayers,
		});

		// Create match
		await tx.insert(match).values({
			id: matchId,
			seasonId: input.seasonId,
			homeScore: input.homeScore,
			awayScore: input.awayScore,
			homeExpectedElo: eloResult.homeTeam.winningOdds,
			awayExpectedElo: eloResult.awayTeam.winningOdds,
			createdBy: input.userId,
			updatedBy: input.userId,
			createdAt: now,
			updatedAt: now,
		});

		// Determine match result
		let homeMatchResult: (typeof matchResult)[number];
		let awayMatchResult: (typeof matchResult)[number];

		if (input.homeScore > input.awayScore) {
			homeMatchResult = "W";
			awayMatchResult = "L";
		} else if (input.homeScore < input.awayScore) {
			homeMatchResult = "L";
			awayMatchResult = "W";
		} else {
			homeMatchResult = "D";
			awayMatchResult = "D";
		}

		// Create match players with calculated ELO scores
		const matchPlayerValues = [
			...input.homeTeamPlayerIds.map((id, index) => {
				const playerResult = eloResult.homeTeam.players.find((p) => p.id === id);
				return {
					id: newId("matchPlayer"),
					matchId,
					seasonPlayerId: id,
					homeTeam: true,
					result: homeMatchResult,
					scoreBefore: homePlayers[index]?.score || seasonData.initialScore,
					scoreAfter: playerResult?.scoreAfter || seasonData.initialScore,
					createdAt: now,
					updatedAt: now,
				};
			}),
			...input.awayTeamPlayerIds.map((id, index) => {
				const playerResult = eloResult.awayTeam.players.find((p) => p.id === id);
				return {
					id: newId("matchPlayer"),
					matchId,
					seasonPlayerId: id,
					homeTeam: false,
					result: awayMatchResult,
					scoreBefore: awayPlayers[index]?.score || seasonData.initialScore,
					scoreAfter: playerResult?.scoreAfter || seasonData.initialScore,
					createdAt: now,
					updatedAt: now,
				};
			}),
		];

		for (let i = 0; i < matchPlayerValues.length; i += D1_BATCH_SIZE) {
			await tx.insert(matchPlayer).values(matchPlayerValues.slice(i, i + D1_BATCH_SIZE));
		}

		// Update season player scores with new ELO ratings (single CASE-based UPDATE)
		const allPlayerResults = [...eloResult.homeTeam.players, ...eloResult.awayTeam.players];
		const playerCaseParts = allPlayerResults
			.map((p) => sql`WHEN ${seasonPlayer.id} = ${p.id} THEN ${p.scoreAfter}`)
			.reduce((acc, part) => sql`${acc} ${part}`);
		await tx
			.update(seasonPlayer)
			.set({ score: sql`CASE ${playerCaseParts} END` })
			.where(
				inArray(
					seasonPlayer.id,
					allPlayerResults.map((p) => p.id)
				)
			);

		// Handle team creation and scoring for 2+ player matches
		if (homePlayers.length > 1 && awayPlayers.length > 1) {
			const [homeTeamResult, awayTeamResult] = await Promise.all([
				getOrInsertTeam({
					db: tx,
					seasonData,
					players: homePlayers,
					now,
				}),
				getOrInsertTeam({
					db: tx,
					seasonData,
					players: awayPlayers,
					now,
				}),
			]);

			const { seasonTeamId: homeSeasonTeamId, score: homeSeasonTeamScore } = homeTeamResult;
			const { seasonTeamId: awaySeasonTeamId, score: awaySeasonTeamScore } = awayTeamResult;

			// Calculate team scores
			const teamMatchResult = calculateMatchResult({
				seasonData,
				homeScore: input.homeScore,
				awayScore: input.awayScore,
				homePlayers: [{ id: homeSeasonTeamId, score: homeSeasonTeamScore }],
				awayPlayers: [{ id: awaySeasonTeamId, score: awaySeasonTeamScore }],
			});

			// Create match team records
			await tx.insert(matchTeam).values([
				{
					id: newId("team"),
					matchId,
					seasonTeamId: homeSeasonTeamId,
					scoreBefore: homeSeasonTeamScore,
					scoreAfter:
						teamMatchResult.homeTeam.players.find((r) => r.id === homeSeasonTeamId)?.scoreAfter ||
						homeSeasonTeamScore,
					result: homeMatchResult,
					createdAt: now,
					updatedAt: now,
				},
				{
					id: newId("team"),
					matchId,
					seasonTeamId: awaySeasonTeamId,
					scoreBefore: awaySeasonTeamScore,
					scoreAfter:
						teamMatchResult.awayTeam.players.find((r) => r.id === awaySeasonTeamId)?.scoreAfter ||
						awaySeasonTeamScore,
					result: awayMatchResult,
					createdAt: now,
					updatedAt: now,
				},
			]);

			// Update season team scores (single CASE-based UPDATE)
			const allTeamResults = [
				...teamMatchResult.homeTeam.players,
				...teamMatchResult.awayTeam.players,
			];
			const teamCaseParts = allTeamResults
				.map((t) => sql`WHEN ${seasonTeam.id} = ${t.id} THEN ${t.scoreAfter}`)
				.reduce((acc, part) => sql`${acc} ${part}`);
			await tx
				.update(seasonTeam)
				.set({ score: sql`CASE ${teamCaseParts} END` })
				.where(
					inArray(
						seasonTeam.id,
						allTeamResults.map((t) => t.id)
					)
				);
		}

		return {
			id: matchId,
			seasonId: input.seasonId,
			homeScore: input.homeScore,
			awayScore: input.awayScore,
			createdAt: now,
		};
	});
};

export const checkStreakThresholds = async ({
	db,
	seasonPlayerIds,
}: {
	db: DrizzleDB;
	seasonPlayerIds: string[];
}): Promise<
	Array<{
		seasonPlayerId: string;
		playerId: string;
		playerName: string;
		playerImage: string | null;
		streak: number;
	}>
> => {
	if (seasonPlayerIds.length === 0) return [];

	const allMatches = await db.all<{
		seasonPlayerId: string;
		result: "W" | "L" | "D";
		playerId: string;
		playerName: string | null;
		playerImage: string | null;
	}>(sql`
		SELECT
			mp.season_player_id as seasonPlayerId,
			mp.result,
			p.id as playerId,
			u.name as playerName,
			u.image as playerImage
		FROM (
			SELECT
				season_player_id,
				result,
				created_at,
				ROW_NUMBER() OVER (PARTITION BY season_player_id ORDER BY created_at DESC) as rn
			FROM match_player
			WHERE season_player_id IN ${seasonPlayerIds}
		) mp
		INNER JOIN season_player sp ON mp.season_player_id = sp.id
		INNER JOIN player p ON sp.player_id = p.id
		INNER JOIN user u ON p.user_id = u.id
		WHERE mp.rn <= 16
		ORDER BY mp.season_player_id, mp.created_at DESC
	`);

	const matchesByPlayer = new Map<string, typeof allMatches>();
	for (const match of allMatches) {
		const existing = matchesByPlayer.get(match.seasonPlayerId) || [];
		existing.push(match);
		matchesByPlayer.set(match.seasonPlayerId, existing);
	}

	const results: Array<{
		seasonPlayerId: string;
		playerId: string;
		playerName: string;
		playerImage: string | null;
		streak: number;
	}> = [];

	for (const [seasonPlayerId, recentMatches] of matchesByPlayer) {
		const thresholdResult = checkThresholds(recentMatches);
		if (thresholdResult) {
			results.push({
				seasonPlayerId,
				playerId: thresholdResult.playerId,
				playerName: thresholdResult.playerName,
				playerImage: thresholdResult.playerImage,
				streak: thresholdResult.streak,
			});
		}
	}

	return results;
};

function detectStreak(results: string[]): number {
	for (const threshold of [15, 10, 5]) {
		if (results.length < threshold) continue;

		const firstN = results.slice(0, threshold);
		const nextOne = results[threshold];

		const allWins = firstN.every((r) => r === "W");
		const allLosses = firstN.every((r) => r === "L");

		if (allWins && (!nextOne || nextOne !== "W")) {
			return threshold;
		}
		if (allLosses && (!nextOne || nextOne !== "L")) {
			return -threshold;
		}
	}
	return 0;
}

function checkThresholds(
	recentMatches: Array<{
		result: string;
		playerId: string;
		playerName: string | null;
		playerImage: string | null;
	}>
): { playerId: string; playerName: string; playerImage: string | null; streak: number } | null {
	const results = recentMatches.map((m) => m.result);
	const streak = detectStreak(results);
	if (streak === 0) return null;

	const firstMatch = recentMatches[0];
	return {
		playerId: firstMatch.playerId,
		playerName: firstMatch.playerName || "Unknown",
		playerImage: firstMatch.playerImage,
		streak,
	};
}

export const checkTeamStreakThresholds = async ({
	db,
	matchId,
}: {
	db: DrizzleDB;
	matchId: string;
}): Promise<
	Array<{
		seasonTeamId: string;
		teamName: string;
		teamLogo: string | null;
		streak: number;
	}>
> => {
	const teams = await db
		.select({ seasonTeamId: matchTeam.seasonTeamId })
		.from(matchTeam)
		.where(eq(matchTeam.matchId, matchId));

	if (teams.length === 0) return [];

	const seasonTeamIds = teams.map((t) => t.seasonTeamId);

	const allMatches = await db.all<{
		seasonTeamId: string;
		result: "W" | "L" | "D";
		teamName: string;
		teamLogo: string | null;
	}>(sql`
		SELECT
			mt.season_team_id as seasonTeamId,
			mt.result,
			lt.name as teamName,
			lt.logo as teamLogo
		FROM (
			SELECT
				season_team_id,
				result,
				created_at,
				ROW_NUMBER() OVER (PARTITION BY season_team_id ORDER BY created_at DESC) as rn
			FROM match_team
			WHERE season_team_id IN ${seasonTeamIds}
		) mt
		INNER JOIN season_team st ON mt.season_team_id = st.id
		INNER JOIN league_team lt ON st.league_team_id = lt.id
		WHERE mt.rn <= 16
		ORDER BY mt.season_team_id, mt.created_at DESC
	`);

	const matchesByTeam = new Map<string, typeof allMatches>();
	for (const match of allMatches) {
		const existing = matchesByTeam.get(match.seasonTeamId) || [];
		existing.push(match);
		matchesByTeam.set(match.seasonTeamId, existing);
	}

	const results: Array<{
		seasonTeamId: string;
		teamName: string;
		teamLogo: string | null;
		streak: number;
	}> = [];

	for (const [seasonTeamId, recentMatches] of matchesByTeam) {
		const thresholdResult = checkTeamThresholds(recentMatches);
		if (thresholdResult) {
			results.push({
				seasonTeamId,
				teamName: thresholdResult.teamName,
				teamLogo: thresholdResult.teamLogo,
				streak: thresholdResult.streak,
			});
		}
	}

	return results;
};

function checkTeamThresholds(
	recentMatches: Array<{
		result: string;
		teamName: string;
		teamLogo: string | null;
	}>
): { teamName: string; teamLogo: string | null; streak: number } | null {
	const results = recentMatches.map((m) => m.result);
	const streak = detectStreak(results);
	if (streak === 0) return null;

	const firstMatch = recentMatches[0];
	return {
		teamName: firstMatch.teamName,
		teamLogo: firstMatch.teamLogo,
		streak,
	};
}

export const remove = async ({
	db,
	matchId,
	seasonId,
}: {
	db: DrizzleDB;
	matchId: string;
	seasonId: string;
}) => {
	return withTransaction(db, async (tx) => {
		// Revert player scores
		const matchPlayers = await tx
			.select({
				id: matchPlayer.id,
				seasonPlayerId: matchPlayer.seasonPlayerId,
				scoreBefore: matchPlayer.scoreBefore,
			})
			.from(matchPlayer)
			.where(eq(matchPlayer.matchId, matchId));

		for (const mp of matchPlayers) {
			await tx
				.update(seasonPlayer)
				.set({ score: mp.scoreBefore })
				.where(eq(seasonPlayer.id, mp.seasonPlayerId));
		}

		// Revert team scores
		const matchTeams = await tx
			.select({
				id: matchTeam.id,
				seasonTeamId: matchTeam.seasonTeamId,
				scoreBefore: matchTeam.scoreBefore,
			})
			.from(matchTeam)
			.where(eq(matchTeam.matchId, matchId));

		for (const mt of matchTeams) {
			await tx
				.update(seasonTeam)
				.set({ score: mt.scoreBefore })
				.where(eq(seasonTeam.id, mt.seasonTeamId));
		}

		// Remove match teams
		await tx.delete(matchTeam).where(eq(matchTeam.matchId, matchId));

		// Remove match players
		await tx.delete(matchPlayer).where(eq(matchPlayer.matchId, matchId));

		// Remove match
		await tx.delete(match).where(and(eq(match.id, matchId), eq(match.seasonId, seasonId)));
	});
};

export const findById = async ({
	db,
	matchId,
	seasonId,
}: {
	db: DrizzleDB;
	matchId: string;
	seasonId: string;
}) => {
	const [m] = await db
		.select()
		.from(match)
		.where(and(eq(match.id, matchId), eq(match.seasonId, seasonId)))
		.limit(1);
	return m;
};

export const findLatest = async ({ db, seasonId }: { db: DrizzleDB; seasonId: string }) => {
	const [m] = await db
		.select()
		.from(match)
		.where(eq(match.seasonId, seasonId))
		.orderBy(desc(match.createdAt))
		.limit(1);
	return m;
};

export const getMatchesAfter = async ({
	db,
	seasonId,
	createdAt,
}: {
	db: DrizzleDB;
	seasonId: string;
	createdAt: Date;
}) => {
	return db
		.select({
			id: match.id,
			seasonId: match.seasonId,
			homeScore: match.homeScore,
			awayScore: match.awayScore,
			createdAt: match.createdAt,
		})
		.from(match)
		.where(and(eq(match.seasonId, seasonId), gt(match.createdAt, createdAt)))
		.orderBy(desc(match.createdAt));
};

export const getMatchWithFullDetails = async ({
	db,
	matchId,
}: {
	db: DrizzleDB;
	matchId: string;
}) => {
	const [matchData] = await db
		.select({
			id: match.id,
			seasonId: match.seasonId,
			homeScore: match.homeScore,
			awayScore: match.awayScore,
			createdAt: match.createdAt,
		})
		.from(match)
		.where(eq(match.id, matchId))
		.limit(1);

	if (!matchData) return null;

	const players = await db
		.select({
			id: matchPlayer.id,
			seasonPlayerId: matchPlayer.seasonPlayerId,
			homeTeam: matchPlayer.homeTeam,
			scoreBefore: matchPlayer.scoreBefore,
			scoreAfter: matchPlayer.scoreAfter,
		})
		.from(matchPlayer)
		.where(eq(matchPlayer.matchId, matchId));

	return {
		...matchData,
		players,
	};
};

export const getBySeasonId = async ({
	db,
	seasonId,
	limit,
	offset,
}: {
	db: DrizzleDB;
	seasonId: string;
	limit: number;
	offset: number;
}) => {
	// Get matches and count in parallel
	const [matchRows, [countResult]] = await Promise.all([
		db
			.select({
				id: match.id,
				seasonId: match.seasonId,
				homeScore: match.homeScore,
				awayScore: match.awayScore,
				createdAt: match.createdAt,
			})
			.from(match)
			.where(eq(match.seasonId, seasonId))
			.orderBy(desc(match.createdAt))
			.limit(limit)
			.offset(offset),
		db
			.select({ count: sql<number>`count(*)` })
			.from(match)
			.where(eq(match.seasonId, seasonId)),
	]);

	const total = countResult?.count || 0;

	if (matchRows.length === 0) {
		return { matches: [], total };
	}

	const matchIds = matchRows.map((m) => m.id);

	// Get players, teams in parallel
	const [playerRows, teamRows] = await Promise.all([
		db
			.select({
				matchId: matchPlayer.matchId,
				playerId: matchPlayer.id,
				seasonPlayerId: matchPlayer.seasonPlayerId,
				homeTeam: matchPlayer.homeTeam,
				result: matchPlayer.result,
				scoreBefore: matchPlayer.scoreBefore,
				scoreAfter: matchPlayer.scoreAfter,
				playerName: sql<string>`COALESCE(${user.name}, ${guest.displayName})`.as("player_name"),
				playerImage: user.image,
			})
			.from(matchPlayer)
			.innerJoin(seasonPlayer, eq(matchPlayer.seasonPlayerId, seasonPlayer.id))
			.innerJoin(player, eq(seasonPlayer.playerId, player.id))
			.leftJoin(user, eq(player.userId, user.id))
			.leftJoin(guest, eq(player.guestId, guest.id))
			.where(inArray(matchPlayer.matchId, matchIds)),
		db
			.select({
				matchId: matchTeam.matchId,
				seasonTeamId: matchTeam.seasonTeamId,
				result: matchTeam.result,
				teamName: leagueTeam.name,
				teamLogo: leagueTeam.logo,
			})
			.from(matchTeam)
			.innerJoin(seasonTeam, eq(matchTeam.seasonTeamId, seasonTeam.id))
			.innerJoin(leagueTeam, eq(seasonTeam.leagueTeamId, leagueTeam.id))
			.where(inArray(matchTeam.matchId, matchIds)),
	]);

	// Group players by match
	const playersByMatch = new Map<string, typeof playerRows>();
	for (const row of playerRows) {
		const existing = playersByMatch.get(row.matchId) || [];
		existing.push(row);
		playersByMatch.set(row.matchId, existing);
	}

	// Group teams by match
	const teamsByMatch = new Map<string, typeof teamRows>();
	for (const row of teamRows) {
		const existing = teamsByMatch.get(row.matchId) || [];
		existing.push(row);
		teamsByMatch.set(row.matchId, existing);
	}

	// Build final response
	const matches = matchRows.map((m) => {
		const players = playersByMatch.get(m.id) || [];
		const teams = teamsByMatch.get(m.id) || [];

		const homePlayers = players.filter((p) => p.homeTeam);
		const awayPlayers = players.filter((p) => !p.homeTeam);

		// Determine home/away teams based on result and score
		const homeTeamData =
			m.homeScore > m.awayScore
				? teams.find((t) => t.result === "W")
				: m.homeScore < m.awayScore
					? teams.find((t) => t.result === "L")
					: teams[0];
		const awayTeamData = teams.find((t) => t.seasonTeamId !== homeTeamData?.seasonTeamId);

		return {
			id: m.id,
			seasonId: m.seasonId,
			homeScore: m.homeScore,
			awayScore: m.awayScore,
			createdAt: m.createdAt,
			homeTeam: {
				name: homeTeamData?.teamName ?? null,
				logo: homeTeamData?.teamLogo ?? null,
				players: homePlayers.map((p) => ({
					id: p.playerId,
					seasonPlayerId: p.seasonPlayerId,
					result: p.result as "W" | "L" | "D",
					scoreBefore: p.scoreBefore,
					scoreAfter: p.scoreAfter,
					name: p.playerName,
					image: p.playerImage,
				})),
			},
			awayTeam: {
				name: awayTeamData?.teamName ?? null,
				logo: awayTeamData?.teamLogo ?? null,
				players: awayPlayers.map((p) => ({
					id: p.playerId,
					seasonPlayerId: p.seasonPlayerId,
					result: p.result as "W" | "L" | "D",
					scoreBefore: p.scoreBefore,
					scoreAfter: p.scoreAfter,
					name: p.playerName,
					image: p.playerImage,
				})),
			},
		};
	});

	return {
		matches,
		total,
	};
};

export const getMatchWithPlayers = async ({ db, matchId }: { db: DrizzleDB; matchId: string }) => {
	// Get match data and all related players/teams in parallel
	const [matchRows, players, teams] = await Promise.all([
		db
			.select({
				id: match.id,
				seasonId: match.seasonId,
				homeScore: match.homeScore,
				awayScore: match.awayScore,
				createdAt: match.createdAt,
			})
			.from(match)
			.where(eq(match.id, matchId))
			.limit(1),
		db
			.select({
				id: matchPlayer.id,
				seasonPlayerId: matchPlayer.seasonPlayerId,
				homeTeam: matchPlayer.homeTeam,
				result: matchPlayer.result,
				scoreBefore: matchPlayer.scoreBefore,
				scoreAfter: matchPlayer.scoreAfter,
				name: sql<string>`COALESCE(${user.name}, ${guest.displayName})`.as("name"),
				image: user.image,
			})
			.from(matchPlayer)
			.innerJoin(seasonPlayer, eq(matchPlayer.seasonPlayerId, seasonPlayer.id))
			.innerJoin(player, eq(seasonPlayer.playerId, player.id))
			.leftJoin(user, eq(player.userId, user.id))
			.leftJoin(guest, eq(player.guestId, guest.id))
			.where(eq(matchPlayer.matchId, matchId)),
		db
			.select({
				id: matchTeam.id,
				seasonTeamId: matchTeam.seasonTeamId,
				result: matchTeam.result,
				teamName: leagueTeam.name,
				teamLogo: leagueTeam.logo,
			})
			.from(matchTeam)
			.innerJoin(seasonTeam, eq(matchTeam.seasonTeamId, seasonTeam.id))
			.innerJoin(leagueTeam, eq(seasonTeam.leagueTeamId, leagueTeam.id))
			.where(eq(matchTeam.matchId, matchId))
			.orderBy(matchTeam.createdAt),
	]);

	if (!matchRows[0]) return null;
	const matchData = matchRows[0];

	// Determine which team is home vs away based on result and score
	const homeTeamData =
		matchData.homeScore > matchData.awayScore
			? teams.find((t) => t.result === "W")
			: matchData.homeScore < matchData.awayScore
				? teams.find((t) => t.result === "L")
				: teams[0]; // Draw - use first (home was inserted first)

	const awayTeamData = teams.find((t) => t.id !== homeTeamData?.id);

	// Add team info to players based on homeTeam flag
	const playersWithTeam = players.map((p) => ({
		...p,
		teamName: p.homeTeam ? (homeTeamData?.teamName ?? null) : (awayTeamData?.teamName ?? null),
		teamLogo: p.homeTeam ? (homeTeamData?.teamLogo ?? null) : (awayTeamData?.teamLogo ?? null),
	}));

	return {
		...matchData,
		players: playersWithTeam,
	};
};
