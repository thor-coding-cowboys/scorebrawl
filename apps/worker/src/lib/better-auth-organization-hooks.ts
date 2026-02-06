import { eq, and, or, gt, isNull } from "drizzle-orm";
import type { DB } from "better-auth/adapters/drizzle";
import { player, season, seasonPlayer } from "../db/schema";
import { createId } from "../utils/id-util";

/**
 * Creates a player record for a user in an organization and adds them to ongoing/future seasons
 */
async function createPlayerForUser({
	db,
	userId,
	organizationId,
}: {
	db: DB;
	userId: string;
	organizationId: string;
}) {
	const now = new Date();

	// Insert into player table
	const playerId = createId();
	await db.insert(player).values({
		id: playerId,
		userId: userId,
		leagueId: organizationId,
		disabled: false,
		createdAt: now,
		updatedAt: now,
	});

	// Find future or ongoing seasons
	const ongoingAndFutureSeasons = await db
		.select({ id: season.id, initialScore: season.initialScore })
		.from(season)
		.where(
			and(eq(season.leagueId, organizationId), or(gt(season.endDate, now), isNull(season.endDate)))
		);

	// Insert into seasonPlayer for each ongoing season
	if (ongoingAndFutureSeasons.length > 0) {
		await db.insert(seasonPlayer).values(
			ongoingAndFutureSeasons.map((s: { id: string; initialScore: number }) => ({
				id: createId(),
				seasonId: s.id,
				playerId,
				score: s.initialScore,
				disabled: false,
				createdAt: now,
				updatedAt: now,
			}))
		);
	}
}

/**
 * Hook that runs after a user accepts an organization invitation
 * Automatically creates a player record for non-viewer roles
 */
export const afterAcceptInvitation = async ({
	invitation,
	member: _member,
	user,
	db,
}: {
	invitation: { role: string; organizationId: string };
	member: unknown;
	user: { id: string };
	db: DB;
}) => {
	// Skip for viewer role
	if (invitation.role === "viewer") {
		return;
	}

	await createPlayerForUser({
		db,
		userId: user.id,
		organizationId: invitation.organizationId,
	});
};

/**
 * Hook that runs after a user creates an organization
 * Automatically creates a player record for the organization creator
 */
export const afterCreateOrganization = async ({
	organization,
	user,
	db,
}: {
	organization: { id: string };
	user: { id: string };
	db: DB;
}) => {
	await createPlayerForUser({
		db,
		userId: user.id,
		organizationId: organization.id,
	});
};
