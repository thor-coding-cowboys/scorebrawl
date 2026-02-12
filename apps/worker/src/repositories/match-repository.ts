import { and, desc, eq, sql, inArray } from "drizzle-orm";
import * as EloLib from "@ihs7/ts-elo";
import { newId } from "@coding-cowboys/scorebrawl-util/id-util";
import type { DrizzleDB } from "../db";
import { user } from "../db/schema/auth-schema";
import {
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
		return calculateElo(seasonData, homeScore, homePlayers, awayScore, awayPlayers);
	}

	if (seasonData.scoreType === "3-1-0") {
		return calculate310(homePlayers, homeScore, awayScore, awayPlayers);
	}

	throw new Error("Invalid score type");
};

const calculateElo = (
	seasonData: SeasonData,
	homeScore: number,
	homePlayers: { id: string; score: number }[],
	awayScore: number,
	awayPlayers: { id: string; score: number }[]
) => {
	const eloMatch = new EloLib.TeamMatch({
		kFactor: seasonData.kFactor,
		calculationStrategy:
			seasonData.scoreType === "elo"
				? EloLib.CalculationStrategy.TEAM_VS_TEAM
				: EloLib.CalculationStrategy.INDIVIDUAL_VS_TEAM,
	});

	const eloHomeTeam = eloMatch.addTeam("home", homeScore);
	for (const p of homePlayers) {
		eloHomeTeam.addPlayer(new EloLib.Player(p.id, p.score));
	}

	const eloAwayTeam = eloMatch.addTeam("away", awayScore);
	for (const p of awayPlayers) {
		eloAwayTeam.addPlayer(new EloLib.Player(p.id, p.score));
	}

	const eloMatchResult = eloMatch.calculate();

	return {
		homeTeam: {
			winningOdds: eloHomeTeam.expectedScoreAgainst(eloAwayTeam),
			players: eloHomeTeam.players.map((p: { identifier: string }) => ({
				id: p.identifier,
				scoreAfter: eloMatchResult.results.find(
					(r: { identifier: string; rating: number }) => r.identifier === p.identifier
				)?.rating as number,
			})),
		},
		awayTeam: {
			winningOdds: eloAwayTeam.expectedScoreAgainst(eloHomeTeam),
			players: eloAwayTeam.players.map((p: { identifier: string }) => ({
				id: p.identifier,
				scoreAfter: eloMatchResult.results.find(
					(r: { identifier: string; rating: number }) => r.identifier === p.identifier
				)?.rating as number,
			})),
		},
	};
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

const getOrInsertTeam = async ({
	db,
	seasonData,
	players,
	now,
}: {
	db: DrizzleDB;
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

		await db.insert(leagueTeamPlayer).values(
			players.map((p) => ({
				id: newId("team"),
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
	const now = new Date();
	const matchId = input.id ?? newId("match");

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
		.where(eq(season.id, input.seasonId));

	if (!seasonData) {
		throw new Error("Season not found");
	}

	// Get current scores for all players with their names
	const allPlayerIds = [...input.homeTeamPlayerIds, ...input.awayTeamPlayerIds];
	const seasonPlayerData = await db
		.select({
			id: seasonPlayer.id,
			score: seasonPlayer.score,
			playerId: seasonPlayer.playerId,
			name: user.name,
		})
		.from(seasonPlayer)
		.innerJoin(player, eq(seasonPlayer.playerId, player.id))
		.innerJoin(user, eq(player.userId, user.id))
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
	await db.insert(match).values({
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

	await db.insert(matchPlayer).values(matchPlayerValues);

	// Update season player scores with new ELO ratings
	const updatePromises = [...eloResult.homeTeam.players, ...eloResult.awayTeam.players].map(
		(playerResult) =>
			db
				.update(seasonPlayer)
				.set({ score: playerResult.scoreAfter })
				.where(eq(seasonPlayer.id, playerResult.id))
	);
	await Promise.all(updatePromises);

	// Handle team creation and scoring for 2+ player matches
	if (homePlayers.length > 1 && awayPlayers.length > 1) {
		const { seasonTeamId: homeSeasonTeamId, score: homeSeasonTeamScore } = await getOrInsertTeam({
			db,
			seasonData,
			players: homePlayers,
			now,
		});

		const { seasonTeamId: awaySeasonTeamId, score: awaySeasonTeamScore } = await getOrInsertTeam({
			db,
			seasonData,
			players: awayPlayers,
			now,
		});

		// Calculate team scores
		const teamMatchResult = calculateMatchResult({
			seasonData,
			homeScore: input.homeScore,
			awayScore: input.awayScore,
			homePlayers: [{ id: homeSeasonTeamId, score: homeSeasonTeamScore }],
			awayPlayers: [{ id: awaySeasonTeamId, score: awaySeasonTeamScore }],
		});

		// Create match team records
		await db.insert(matchTeam).values([
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

		// Update season team scores
		for (const teamResult of [
			...teamMatchResult.homeTeam.players,
			...teamMatchResult.awayTeam.players,
		]) {
			await db
				.update(seasonTeam)
				.set({ score: teamResult.scoreAfter })
				.where(eq(seasonTeam.id, teamResult.id));
		}
	}

	return {
		id: matchId,
		seasonId: input.seasonId,
		homeScore: input.homeScore,
		awayScore: input.awayScore,
		createdAt: now,
	};
};

export const remove = async ({
	db,
	matchId,
	seasonId,
}: {
	db: DrizzleDB;
	matchId: string;
	seasonId: string;
}) => {
	// Revert player scores
	const matchPlayers = await db
		.select({
			id: matchPlayer.id,
			seasonPlayerId: matchPlayer.seasonPlayerId,
			scoreBefore: matchPlayer.scoreBefore,
		})
		.from(matchPlayer)
		.where(eq(matchPlayer.matchId, matchId));

	for (const mp of matchPlayers) {
		await db
			.update(seasonPlayer)
			.set({ score: mp.scoreBefore })
			.where(eq(seasonPlayer.id, mp.seasonPlayerId));
	}

	// Revert team scores
	const matchTeams = await db
		.select({
			id: matchTeam.id,
			seasonTeamId: matchTeam.seasonTeamId,
			scoreBefore: matchTeam.scoreBefore,
		})
		.from(matchTeam)
		.where(eq(matchTeam.matchId, matchId));

	for (const mt of matchTeams) {
		await db
			.update(seasonTeam)
			.set({ score: mt.scoreBefore })
			.where(eq(seasonTeam.id, mt.seasonTeamId));
	}

	// Remove match teams
	await db.delete(matchTeam).where(eq(matchTeam.matchId, matchId));

	// Remove match players
	await db.delete(matchPlayer).where(eq(matchPlayer.matchId, matchId));

	// Remove match
	await db.delete(match).where(and(eq(match.id, matchId), eq(match.seasonId, seasonId)));
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
	// Get matches with pagination
	const matchRows = await db
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
		.offset(offset);

	if (matchRows.length === 0) {
		const [countResult] = await db
			.select({ count: sql<number>`count(*)` })
			.from(match)
			.where(eq(match.seasonId, seasonId));
		return { matches: [], total: countResult?.count || 0 };
	}

	const matchIds = matchRows.map((m) => m.id);

	// Get all players for these matches in one query
	const playerRows = await db
		.select({
			matchId: matchPlayer.matchId,
			playerId: matchPlayer.id,
			seasonPlayerId: matchPlayer.seasonPlayerId,
			homeTeam: matchPlayer.homeTeam,
			result: matchPlayer.result,
			scoreBefore: matchPlayer.scoreBefore,
			scoreAfter: matchPlayer.scoreAfter,
			playerName: user.name,
			playerImage: user.image,
		})
		.from(matchPlayer)
		.innerJoin(seasonPlayer, eq(matchPlayer.seasonPlayerId, seasonPlayer.id))
		.innerJoin(player, eq(seasonPlayer.playerId, player.id))
		.innerJoin(user, eq(player.userId, user.id))
		.where(inArray(matchPlayer.matchId, matchIds));

	// Get all teams for these matches in one query
	const teamRows = await db
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
		.where(inArray(matchTeam.matchId, matchIds));

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

	const [countResult] = await db
		.select({ count: sql<number>`count(*)` })
		.from(match)
		.where(eq(match.seasonId, seasonId));

	return {
		matches,
		total: countResult?.count || 0,
	};
};

export const getMatchWithPlayers = async ({ db, matchId }: { db: DrizzleDB; matchId: string }) => {
	const matchData = await db
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

	if (!matchData[0]) return null;

	// Get teams for this match (ordered by creation - home first, away second)
	const teams = await db
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
		.orderBy(matchTeam.createdAt);

	// Determine which team is home vs away based on result and score
	const homeTeamData =
		matchData[0].homeScore > matchData[0].awayScore
			? teams.find((t) => t.result === "W")
			: matchData[0].homeScore < matchData[0].awayScore
				? teams.find((t) => t.result === "L")
				: teams[0]; // Draw - use first (home was inserted first)

	const awayTeamData = teams.find((t) => t.id !== homeTeamData?.id);

	const players = await db
		.select({
			id: matchPlayer.id,
			seasonPlayerId: matchPlayer.seasonPlayerId,
			homeTeam: matchPlayer.homeTeam,
			result: matchPlayer.result,
			scoreBefore: matchPlayer.scoreBefore,
			scoreAfter: matchPlayer.scoreAfter,
			name: user.name,
			image: user.image,
		})
		.from(matchPlayer)
		.innerJoin(seasonPlayer, eq(matchPlayer.seasonPlayerId, seasonPlayer.id))
		.innerJoin(player, eq(seasonPlayer.playerId, player.id))
		.innerJoin(user, eq(player.userId, user.id))
		.where(eq(matchPlayer.matchId, matchId));

	// Add team info to players based on homeTeam flag
	const playersWithTeam = players.map((p) => ({
		...p,
		teamName: p.homeTeam ? (homeTeamData?.teamName ?? null) : (awayTeamData?.teamName ?? null),
		teamLogo: p.homeTeam ? (homeTeamData?.teamLogo ?? null) : (awayTeamData?.teamLogo ?? null),
	}));

	return {
		...matchData[0],
		players: playersWithTeam,
	};
};
