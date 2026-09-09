import { and, desc, eq, sql } from "drizzle-orm";
import type { DrizzleDB } from "../db";
import { user } from "../db/schema/auth-schema";
import {
	guest,
	player,
	playerAchievement,
	seasonPlayer,
	type achievementType,
} from "../db/schema/league-schema";

type AchievementType = (typeof achievementType)[number];

export type PlayerAchievement = {
	playerId: string;
	type: AchievementType;
	createdAt: Date;
};

export const getAchievements = async ({
	db,
	playerId,
	leagueId,
}: {
	db: DrizzleDB;
	playerId: string;
	leagueId: string;
}): Promise<PlayerAchievement[]> => {
	// Single query with join to verify player belongs to league
	const achievements = await db
		.select({
			playerId: playerAchievement.playerId,
			type: playerAchievement.type,
			createdAt: playerAchievement.createdAt,
		})
		.from(playerAchievement)
		.innerJoin(player, eq(playerAchievement.playerId, player.id))
		.where(and(eq(playerAchievement.playerId, playerId), eq(player.leagueId, leagueId)))
		.orderBy(desc(playerAchievement.createdAt));

	return achievements as PlayerAchievement[];
};

export const getLeagueBoard = async ({
	db,
	leagueId,
}: {
	db: DrizzleDB;
	leagueId: string;
}): Promise<Array<PlayerAchievement & { name: string; image: string | null }>> => {
	// Single query: every achievement in the league joined to player identity
	return db
		.select({
			playerId: playerAchievement.playerId,
			type: playerAchievement.type,
			createdAt: playerAchievement.createdAt,
			name: sql<string>`COALESCE(${user.name}, ${guest.displayName})`.as("name"),
			image: user.image,
		})
		.from(playerAchievement)
		.innerJoin(player, eq(playerAchievement.playerId, player.id))
		.leftJoin(user, eq(player.userId, user.id))
		.leftJoin(guest, eq(player.guestId, guest.id))
		.where(eq(player.leagueId, leagueId))
		.orderBy(desc(playerAchievement.createdAt));
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

export const awardSeasonWinner = async ({
	db,
	seasonId,
}: {
	db: DrizzleDB;
	seasonId: string;
}) => {
	// Top-scoring season players (all tied at the max score) become season winners
	const rows = await db
		.select({ playerId: seasonPlayer.playerId, score: seasonPlayer.score })
		.from(seasonPlayer)
		.where(eq(seasonPlayer.seasonId, seasonId))
		.orderBy(desc(seasonPlayer.score));

	if (rows.length === 0) return [];

	const maxScore = rows[0].score;
	const winners = rows.filter((r) => r.score === maxScore);

	const now = new Date();
	await db
		.insert(playerAchievement)
		.values(
			winners.map((w) => ({
				id: crypto.randomUUID(),
				playerId: w.playerId,
				type: "season_winner" as const,
				createdAt: now,
				updatedAt: now,
			}))
		)
		.onConflictDoNothing();

	return winners.map((w) => w.playerId);
};