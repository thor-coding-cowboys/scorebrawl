import { and, desc, eq, sql } from "drizzle-orm";
import type { DrizzleDB } from "../db";
import { user } from "../db/schema/auth-schema";
import { matchPlayer, player } from "../db/schema/competition-schema";

export const getAll = async ({ db, organizationId }: { db: DrizzleDB; organizationId: string }) => {
	return db
		.select({
			id: player.id,
			userId: player.userId,
			organizationId: player.organizationId,
			disabled: player.disabled,
			createdAt: player.createdAt,
			updatedAt: player.updatedAt,
			name: user.name,
			image: user.image,
		})
		.from(player)
		.innerJoin(user, eq(player.userId, user.id))
		.where(eq(player.organizationId, organizationId));
};

export const getById = async ({
	db,
	playerId,
	organizationId,
}: {
	db: DrizzleDB;
	playerId: string;
	organizationId: string;
}) => {
	const [p] = await db
		.select({
			id: player.id,
			userId: player.userId,
			organizationId: player.organizationId,
			disabled: player.disabled,
			createdAt: player.createdAt,
			updatedAt: player.updatedAt,
			name: user.name,
			image: user.image,
		})
		.from(player)
		.innerJoin(user, eq(player.userId, user.id))
		.where(and(eq(player.id, playerId), eq(player.organizationId, organizationId)))
		.limit(1);
	return p;
};

export const getPlayerEloProgression = async ({
	db,
	competitionPlayerId,
}: {
	db: DrizzleDB;
	competitionPlayerId: string;
}) => {
	return db
		.select({
			scoreBefore: matchPlayer.scoreBefore,
			scoreAfter: matchPlayer.scoreAfter,
			createdAt: matchPlayer.createdAt,
		})
		.from(matchPlayer)
		.where(eq(matchPlayer.competitionPlayerId, competitionPlayerId))
		.orderBy(desc(matchPlayer.createdAt));
};

export const getRecentMatches = async ({
	db,
	competitionPlayerId,
	limit,
}: {
	db: DrizzleDB;
	competitionPlayerId: string;
	limit: number;
}) => {
	return db
		.select({
			id: matchPlayer.id,
			matchId: matchPlayer.matchId,
			homeTeam: matchPlayer.homeTeam,
			scoreBefore: matchPlayer.scoreBefore,
			scoreAfter: matchPlayer.scoreAfter,
			result: matchPlayer.result,
			createdAt: matchPlayer.createdAt,
		})
		.from(matchPlayer)
		.where(eq(matchPlayer.competitionPlayerId, competitionPlayerId))
		.orderBy(desc(matchPlayer.createdAt))
		.limit(limit);
};

export const getPlayerStats = async ({
	db,
	competitionPlayerId,
}: {
	db: DrizzleDB;
	competitionPlayerId: string;
}) => {
	const stats = await db
		.select({
			total: sql<number>`count(*)`,
			wins: sql<number>`sum(case when ${matchPlayer.result} = 'W' then 1 else 0 end)`,
			losses: sql<number>`sum(case when ${matchPlayer.result} = 'L' then 1 else 0 end)`,
			draws: sql<number>`sum(case when ${matchPlayer.result} = 'D' then 1 else 0 end)`,
		})
		.from(matchPlayer)
		.where(eq(matchPlayer.competitionPlayerId, competitionPlayerId));

	return stats[0] || { total: 0, wins: 0, losses: 0, draws: 0 };
};
