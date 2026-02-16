import { eq, and } from "drizzle-orm";
import type { DrizzleDB } from "../db";
import { playerAchievement, player, type achievementType } from "../db/schema/league-schema";

type AchievementType = (typeof achievementType)[number];

export const getAchievements = async ({
	db,
	playerId,
	leagueId,
}: {
	db: DrizzleDB;
	playerId: string;
	leagueId: string;
}): Promise<{ type: AchievementType }[]> => {
	// Single query with join to verify player belongs to league
	const achievements = await db
		.select({
			type: playerAchievement.type,
		})
		.from(playerAchievement)
		.innerJoin(player, eq(playerAchievement.playerId, player.id))
		.where(and(eq(playerAchievement.playerId, playerId), eq(player.leagueId, leagueId)));

	return achievements as { type: AchievementType }[];
};

export const addAchievement = async ({
	db,
	playerId,
	type,
}: {
	db: DrizzleDB;
	playerId: string;
	type: AchievementType;
}) => {
	const now = new Date();
	return db
		.insert(playerAchievement)
		.values({
			id: crypto.randomUUID(),
			playerId,
			type,
			createdAt: now,
			updatedAt: now,
		})
		.onConflictDoNothing();
};
