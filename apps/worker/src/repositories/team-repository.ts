import { and, eq } from "drizzle-orm";
import type { DrizzleDB } from "../db";
import { orgTeam, orgTeamPlayer, player } from "../db/schema/league-schema";

export const getAll = async ({ db, organizationId }: { db: DrizzleDB; organizationId: string }) => {
	return db.select().from(orgTeam).where(eq(orgTeam.leagueId, organizationId));
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
		.from(orgTeam)
		.where(and(eq(orgTeam.id, teamId), eq(orgTeam.leagueId, organizationId)))
		.limit(1);
	return t;
};

export const getTeamPlayers = async ({ db, teamId }: { db: DrizzleDB; teamId: string }) => {
	return db
		.select({
			id: player.id,
			userId: player.userId,
		})
		.from(orgTeamPlayer)
		.innerJoin(player, eq(orgTeamPlayer.playerId, player.id))
		.where(eq(orgTeamPlayer.orgTeamId, teamId));
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
	await db.insert(orgTeamPlayer).values({
		id: crypto.randomUUID(),
		orgTeamId: teamId,
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
		.delete(orgTeamPlayer)
		.where(and(eq(orgTeamPlayer.orgTeamId, teamId), eq(orgTeamPlayer.playerId, playerId)));
};
