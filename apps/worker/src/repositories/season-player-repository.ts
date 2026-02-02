import { and, desc, eq, sql } from "drizzle-orm";
import type { DrizzleDB } from "../db";
import { user } from "../db/schema/auth-schema";
import { seasonPlayer, matchPlayer, player } from "../db/schema/competition-schema";

export const findAll = async ({ db, seasonId }: { db: DrizzleDB; seasonId: string }) => {
	return db
		.select({
			id: seasonPlayer.id,
			seasonId: seasonPlayer.seasonId,
			playerId: seasonPlayer.playerId,
			score: seasonPlayer.score,
			disabled: seasonPlayer.disabled,
			createdAt: seasonPlayer.createdAt,
			updatedAt: seasonPlayer.updatedAt,
			name: user.name,
			image: user.image,
			userId: player.userId,
		})
		.from(seasonPlayer)
		.innerJoin(player, eq(seasonPlayer.playerId, player.id))
		.innerJoin(user, eq(player.userId, user.id))
		.where(eq(seasonPlayer.seasonId, seasonId))
		.orderBy(desc(seasonPlayer.score));
};

export const getStanding = async ({ db, seasonId }: { db: DrizzleDB; seasonId: string }) => {
	const results = await db
		.select({
			id: seasonPlayer.id,
			seasonId: seasonPlayer.seasonId,
			playerId: seasonPlayer.playerId,
			score: seasonPlayer.score,
			name: user.name,
			image: user.image,
			userId: player.userId,
			matchCount: sql<number>`(
				select count(*) from ${matchPlayer} 
				where ${matchPlayer.seasonPlayerId} = ${seasonPlayer.id}
			)`,
			winCount: sql<number>`(
				select count(*) from ${matchPlayer} 
				where ${matchPlayer.seasonPlayerId} = ${seasonPlayer.id} 
				and ${matchPlayer.result} = 'W'
			)`,
			lossCount: sql<number>`(
				select count(*) from ${matchPlayer} 
				where ${matchPlayer.seasonPlayerId} = ${seasonPlayer.id} 
				and ${matchPlayer.result} = 'L'
			)`,
			drawCount: sql<number>`(
				select count(*) from ${matchPlayer} 
				where ${matchPlayer.seasonPlayerId} = ${seasonPlayer.id} 
				and ${matchPlayer.result} = 'D'
			)`,
		})
		.from(seasonPlayer)
		.innerJoin(player, eq(seasonPlayer.playerId, player.id))
		.innerJoin(user, eq(player.userId, user.id))
		.where(eq(seasonPlayer.seasonId, seasonId))
		.orderBy(desc(seasonPlayer.score));

	return results.map((r, index) => ({
		...r,
		rank: index + 1,
		pointDiff: r.winCount * 3 + r.drawCount - (results[0]?.score || 0),
	}));
};

export const getTopPlayer = async ({ db, seasonId }: { db: DrizzleDB; seasonId: string }) => {
	const [topPlayer] = await db
		.select({
			id: seasonPlayer.id,
			seasonId: seasonPlayer.seasonId,
			playerId: seasonPlayer.playerId,
			score: seasonPlayer.score,
			name: user.name,
			image: user.image,
		})
		.from(seasonPlayer)
		.innerJoin(player, eq(seasonPlayer.playerId, player.id))
		.innerJoin(user, eq(player.userId, user.id))
		.where(eq(seasonPlayer.seasonId, seasonId))
		.orderBy(desc(seasonPlayer.score))
		.limit(1);
	return topPlayer;
};

export const isUserInSeason = async ({
	db,
	seasonId,
	userId,
}: {
	db: DrizzleDB;
	seasonId: string;
	userId: string;
}) => {
	const [cp] = await db
		.select({ id: seasonPlayer.id })
		.from(seasonPlayer)
		.innerJoin(player, eq(seasonPlayer.playerId, player.id))
		.where(and(eq(seasonPlayer.seasonId, seasonId), eq(player.userId, userId)))
		.limit(1);
	return !!cp;
};

export const getPointProgression = async ({
	db,
	seasonId,
}: {
	db: DrizzleDB;
	seasonId: string;
}) => {
	// Get all match players for this season ordered by time
	return db
		.select({
			seasonPlayerId: matchPlayer.seasonPlayerId,
			scoreAfter: matchPlayer.scoreAfter,
			createdAt: matchPlayer.createdAt,
			name: user.name,
		})
		.from(matchPlayer)
		.innerJoin(seasonPlayer, eq(matchPlayer.seasonPlayerId, seasonPlayer.id))
		.innerJoin(player, eq(seasonPlayer.playerId, player.id))
		.innerJoin(user, eq(player.userId, user.id))
		.where(eq(seasonPlayer.seasonId, seasonId))
		.orderBy(matchPlayer.createdAt);
};
