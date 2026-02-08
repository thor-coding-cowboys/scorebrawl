import { and, eq } from "drizzle-orm";
import type { DrizzleDB } from "../db";
import { leagueTeam, leagueTeamPlayer, player } from "../db/schema/league-schema";

export const getAll = async ({ db, organizationId }: { db: DrizzleDB; organizationId: string }) => {
	return db.select().from(leagueTeam).where(eq(leagueTeam.leagueId, organizationId));
};

export const getById = async ({
	db,
	teamId,
	organizationId,
}: {
	db: DrizzleDB;
	teamId: string;
	organizationId: string;
}) => {
	const [t] = await db
		.select()
		.from(leagueTeam)
		.where(and(eq(leagueTeam.id, teamId), eq(leagueTeam.leagueId, organizationId)))
		.limit(1);
	return t;
};

export const getTeamPlayers = async ({ db, teamId }: { db: DrizzleDB; teamId: string }) => {
	return db
		.select({
			id: player.id,
			userId: player.userId,
		})
		.from(leagueTeamPlayer)
		.innerJoin(player, eq(leagueTeamPlayer.playerId, player.id))
		.where(eq(leagueTeamPlayer.leagueTeamId, teamId));
};

export const addPlayerToTeam = async ({
	db,
	teamId,
	playerId,
}: {
	db: DrizzleDB;
	teamId: string;
	playerId: string;
}) => {
	const now = new Date();
	await db.insert(leagueTeamPlayer).values({
		id: crypto.randomUUID(),
		leagueTeamId: teamId,
		playerId,
		createdAt: now,
		updatedAt: now,
	});
};

export const removePlayerFromTeam = async ({
	db,
	teamId,
	playerId,
}: {
	db: DrizzleDB;
	teamId: string;
	playerId: string;
}) => {
	await db
		.delete(leagueTeamPlayer)
		.where(and(eq(leagueTeamPlayer.leagueTeamId, teamId), eq(leagueTeamPlayer.playerId, playerId)));
};
