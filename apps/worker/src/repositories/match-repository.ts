import { and, desc, eq, sql } from "drizzle-orm";
import * as EloLib from "@ihs7/ts-elo";
import { newId } from "@coding-cowboys/scorebrawl-util/id-util";
import type { DrizzleDB } from "../db";
import { user } from "../db/schema/auth-schema";
import {
	seasonPlayer,
	season,
	match,
	matchPlayer,
	type matchResult,
	player,
	leagueTeamPlayer,
	leagueTeam,
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

export const create = async ({ db, input }: { db: DrizzleDB; input: MatchCreateInput }) => {
	const now = new Date();
	const matchId = input.id ?? newId("match");

	// Get season data for ELO calculation
	const [seasonData] = await db
		.select({
			scoreType: season.scoreType,
			kFactor: season.kFactor,
			initialScore: season.initialScore,
		})
		.from(season)
		.where(eq(season.id, input.seasonId));

	if (!seasonData) {
		throw new Error("Season not found");
	}

	// Get current scores for all players
	const allPlayerIds = [...input.homeTeamPlayerIds, ...input.awayTeamPlayerIds];
	const seasonPlayerData = await db
		.select({
			id: seasonPlayer.id,
			score: seasonPlayer.score,
		})
		.from(seasonPlayer)
		.where(
			and(eq(seasonPlayer.seasonId, input.seasonId), sql`${seasonPlayer.id} IN ${allPlayerIds}`)
		);

	const playerScoreMap = new Map(seasonPlayerData.map((p) => [p.id, p.score]));

	// Prepare players data for ELO calculation
	const homePlayers = input.homeTeamPlayerIds.map((id) => ({
		id,
		score: playerScoreMap.get(id) || seasonData.initialScore,
	}));

	const awayPlayers = input.awayTeamPlayerIds.map((id) => ({
		id,
		score: playerScoreMap.get(id) || seasonData.initialScore,
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
	// Remove match players first
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
	const matches = await db
		.select()
		.from(match)
		.where(eq(match.seasonId, seasonId))
		.orderBy(desc(match.createdAt))
		.limit(limit)
		.offset(offset);

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
			teamName: sql<string | null>`(
				SELECT ${leagueTeam.name} FROM ${leagueTeamPlayer}
				INNER JOIN ${leagueTeam} ON ${leagueTeam.id} = ${leagueTeamPlayer.leagueTeamId}
				WHERE ${leagueTeamPlayer.playerId} = ${player.id}
				AND ${leagueTeam.leagueId} = ${player.leagueId}
				LIMIT 1
			)`.as("team_name"),
		})
		.from(matchPlayer)
		.innerJoin(seasonPlayer, eq(matchPlayer.seasonPlayerId, seasonPlayer.id))
		.innerJoin(player, eq(seasonPlayer.playerId, player.id))
		.innerJoin(user, eq(player.userId, user.id))
		.where(eq(matchPlayer.matchId, matchId));

	return {
		...matchData[0],
		players,
	};
};
