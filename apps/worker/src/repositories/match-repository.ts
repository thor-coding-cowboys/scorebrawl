import { and, desc, eq, sql } from "drizzle-orm";
import type { DrizzleDB } from "../db";
import { user } from "../db/schema/auth-schema";
import {
	seasonPlayer,
	match,
	matchPlayer,
	matchResult,
	player,
	orgTeamPlayer,
	orgTeam,
} from "../db/schema/league-schema";

export interface MatchCreateInput {
	seasonId: string;
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
		seasonId: input.seasonId,
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
			seasonPlayerId: id,
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
			seasonPlayerId: id,
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
				SELECT ${orgTeam.name} FROM ${orgTeamPlayer}
				INNER JOIN ${orgTeam} ON ${orgTeam.id} = ${orgTeamPlayer.orgTeamId}
				WHERE ${orgTeamPlayer.playerId} = ${player.id}
				AND ${orgTeam.leagueId} = ${player.leagueId}
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
