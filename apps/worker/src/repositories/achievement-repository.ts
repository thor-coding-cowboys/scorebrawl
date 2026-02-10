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
	// First verify the player belongs to this league
	const [playerRecord] = await db
		.select({ id: player.id })
		.from(player)
		.where(and(eq(player.id, playerId), eq(player.leagueId, leagueId)))
		.limit(1);

	if (!playerRecord) {
		return [];
	}

	const achievements = await db
		.select({
			type: playerAchievement.type,
		})
		.from(playerAchievement)
		.where(eq(playerAchievement.playerId, playerId));

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
