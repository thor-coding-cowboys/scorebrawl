import { and, desc, eq, sql } from "drizzle-orm";
import type { DrizzleDB } from "../db";
import { user } from "../db/schema/auth-schema";
import {
	competitionPlayer,
	match,
	matchPlayer,
	matchResult,
	player,
} from "../db/schema/competition-schema";

export interface MatchCreateInput {
	competitionId: string;
	homeScore: number;
	awayScore: number;
	homeTeamPlayerIds: string[];
	awayTeamPlayerIds: string[];
	userId: string;
}

export const create = async ({ db, input }: { db: DrizzleDB; input: MatchCreateInput }) => {
	const now = new Date();
	const matchId = crypto.randomUUID();

	// Create match
	await db.insert(match).values({
		id: matchId,
		competitionId: input.competitionId,
		homeScore: input.homeScore,
		awayScore: input.awayScore,
		createdBy: input.userId,
		updatedBy: input.userId,
		createdAt: now,
		updatedAt: now,
	});

	// Determine result
	let homeResult: (typeof matchResult)[number];
	let awayResult: (typeof matchResult)[number];

	if (input.homeScore > input.awayScore) {
		homeResult = "W";
		awayResult = "L";
	} else if (input.homeScore < input.awayScore) {
		homeResult = "L";
		awayResult = "W";
	} else {
		homeResult = "D";
		awayResult = "D";
	}

	// Create match players
	const matchPlayerValues = [
		...input.homeTeamPlayerIds.map((id) => ({
			id: crypto.randomUUID(),
			matchId,
			competitionPlayerId: id,
			homeTeam: true,
			result: homeResult,
			scoreBefore: 0, // Will be updated with actual score
			scoreAfter: 0,
			createdAt: now,
			updatedAt: now,
		})),
		...input.awayTeamPlayerIds.map((id) => ({
			id: crypto.randomUUID(),
			matchId,
			competitionPlayerId: id,
			homeTeam: false,
			result: awayResult,
			scoreBefore: 0,
			scoreAfter: 0,
			createdAt: now,
			updatedAt: now,
		})),
	];

	await db.insert(matchPlayer).values(matchPlayerValues);

	return {
		id: matchId,
		competitionId: input.competitionId,
		homeScore: input.homeScore,
		awayScore: input.awayScore,
		createdAt: now,
	};
};

export const remove = async ({
	db,
	matchId,
	competitionId,
}: {
	db: DrizzleDB;
	matchId: string;
	competitionId: string;
}) => {
	// Remove match players first
	await db.delete(matchPlayer).where(eq(matchPlayer.matchId, matchId));

	// Remove match
	await db.delete(match).where(and(eq(match.id, matchId), eq(match.competitionId, competitionId)));
};

export const findById = async ({
	db,
	matchId,
	competitionId,
}: {
	db: DrizzleDB;
	matchId: string;
	competitionId: string;
}) => {
	const [m] = await db
		.select()
		.from(match)
		.where(and(eq(match.id, matchId), eq(match.competitionId, competitionId)))
		.limit(1);
	return m;
};

export const findLatest = async ({
	db,
	competitionId,
}: {
	db: DrizzleDB;
	competitionId: string;
}) => {
	const [m] = await db
		.select()
		.from(match)
		.where(eq(match.competitionId, competitionId))
		.orderBy(desc(match.createdAt))
		.limit(1);
	return m;
};

export const getByCompetitionId = async ({
	db,
	competitionId,
	limit,
	offset,
}: {
	db: DrizzleDB;
	competitionId: string;
	limit: number;
	offset: number;
}) => {
	const matches = await db
		.select()
		.from(match)
		.where(eq(match.competitionId, competitionId))
		.orderBy(desc(match.createdAt))
		.limit(limit)
		.offset(offset);

	const [countResult] = await db
		.select({ count: sql<number>`count(*)` })
		.from(match)
		.where(eq(match.competitionId, competitionId));

	return {
		matches,
		total: countResult?.count || 0,
	};
};

export const getMatchWithPlayers = async ({ db, matchId }: { db: DrizzleDB; matchId: string }) => {
	const matchData = await db
		.select({
			id: match.id,
			competitionId: match.competitionId,
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
			competitionPlayerId: matchPlayer.competitionPlayerId,
			homeTeam: matchPlayer.homeTeam,
			result: matchPlayer.result,
			scoreBefore: matchPlayer.scoreBefore,
			scoreAfter: matchPlayer.scoreAfter,
			name: user.name,
			image: user.image,
		})
		.from(matchPlayer)
		.innerJoin(competitionPlayer, eq(matchPlayer.competitionPlayerId, competitionPlayer.id))
		.innerJoin(player, eq(competitionPlayer.playerId, player.id))
		.innerJoin(user, eq(player.userId, user.id))
		.where(eq(matchPlayer.matchId, matchId));

	return {
		...matchData[0],
		players,
	};
};
