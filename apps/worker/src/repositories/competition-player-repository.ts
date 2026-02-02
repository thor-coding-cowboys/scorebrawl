import { and, desc, eq, sql } from "drizzle-orm";
import type { DrizzleDB } from "../db";
import { user } from "../db/schema/auth-schema";
import { competitionPlayer, matchPlayer, player } from "../db/schema/competition-schema";

export const findAll = async ({ db, competitionId }: { db: DrizzleDB; competitionId: string }) => {
	return db
		.select({
			id: competitionPlayer.id,
			competitionId: competitionPlayer.competitionId,
			playerId: competitionPlayer.playerId,
			score: competitionPlayer.score,
			disabled: competitionPlayer.disabled,
			createdAt: competitionPlayer.createdAt,
			updatedAt: competitionPlayer.updatedAt,
			name: user.name,
			image: user.image,
			userId: player.userId,
		})
		.from(competitionPlayer)
		.innerJoin(player, eq(competitionPlayer.playerId, player.id))
		.innerJoin(user, eq(player.userId, user.id))
		.where(eq(competitionPlayer.competitionId, competitionId))
		.orderBy(desc(competitionPlayer.score));
};

export const getStanding = async ({
	db,
	competitionId,
}: {
	db: DrizzleDB;
	competitionId: string;
}) => {
	const results = await db
		.select({
			id: competitionPlayer.id,
			competitionId: competitionPlayer.competitionId,
			playerId: competitionPlayer.playerId,
			score: competitionPlayer.score,
			name: user.name,
			image: user.image,
			userId: player.userId,
			matchCount: sql<number>`(
				select count(*) from ${matchPlayer} 
				where ${matchPlayer.competitionPlayerId} = ${competitionPlayer.id}
			)`,
			winCount: sql<number>`(
				select count(*) from ${matchPlayer} 
				where ${matchPlayer.competitionPlayerId} = ${competitionPlayer.id} 
				and ${matchPlayer.result} = 'W'
			)`,
			lossCount: sql<number>`(
				select count(*) from ${matchPlayer} 
				where ${matchPlayer.competitionPlayerId} = ${competitionPlayer.id} 
				and ${matchPlayer.result} = 'L'
			)`,
			drawCount: sql<number>`(
				select count(*) from ${matchPlayer} 
				where ${matchPlayer.competitionPlayerId} = ${competitionPlayer.id} 
				and ${matchPlayer.result} = 'D'
			)`,
		})
		.from(competitionPlayer)
		.innerJoin(player, eq(competitionPlayer.playerId, player.id))
		.innerJoin(user, eq(player.userId, user.id))
		.where(eq(competitionPlayer.competitionId, competitionId))
		.orderBy(desc(competitionPlayer.score));

	return results.map((r, index) => ({
		...r,
		rank: index + 1,
		pointDiff: r.winCount * 3 + r.drawCount - (results[0]?.score || 0),
	}));
};

export const getTopPlayer = async ({
	db,
	competitionId,
}: {
	db: DrizzleDB;
	competitionId: string;
}) => {
	const [topPlayer] = await db
		.select({
			id: competitionPlayer.id,
			competitionId: competitionPlayer.competitionId,
			playerId: competitionPlayer.playerId,
			score: competitionPlayer.score,
			name: user.name,
			image: user.image,
		})
		.from(competitionPlayer)
		.innerJoin(player, eq(competitionPlayer.playerId, player.id))
		.innerJoin(user, eq(player.userId, user.id))
		.where(eq(competitionPlayer.competitionId, competitionId))
		.orderBy(desc(competitionPlayer.score))
		.limit(1);
	return topPlayer;
};

export const isUserInCompetition = async ({
	db,
	competitionId,
	userId,
}: {
	db: DrizzleDB;
	competitionId: string;
	userId: string;
}) => {
	const [cp] = await db
		.select({ id: competitionPlayer.id })
		.from(competitionPlayer)
		.innerJoin(player, eq(competitionPlayer.playerId, player.id))
		.where(and(eq(competitionPlayer.competitionId, competitionId), eq(player.userId, userId)))
		.limit(1);
	return !!cp;
};

export const getPointProgression = async ({
	db,
	competitionId,
}: {
	db: DrizzleDB;
	competitionId: string;
}) => {
	// Get all match players for this competition ordered by time
	return db
		.select({
			competitionPlayerId: matchPlayer.competitionPlayerId,
			scoreAfter: matchPlayer.scoreAfter,
			createdAt: matchPlayer.createdAt,
			name: user.name,
		})
		.from(matchPlayer)
		.innerJoin(competitionPlayer, eq(matchPlayer.competitionPlayerId, competitionPlayer.id))
		.innerJoin(player, eq(competitionPlayer.playerId, player.id))
		.innerJoin(user, eq(player.userId, user.id))
		.where(eq(competitionPlayer.competitionId, competitionId))
		.orderBy(matchPlayer.createdAt);
};
