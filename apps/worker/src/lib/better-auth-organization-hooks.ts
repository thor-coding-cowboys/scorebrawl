import { eq, and, or, gt, isNull, ne } from "drizzle-orm";
import type { DB } from "better-auth/adapters/drizzle";
import { guest, player, season, seasonPlayer } from "../db/schema";
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
	invitation: { role: string; organizationId: string; email: string };
	member: unknown;
	user: { id: string; email: string };
	db: DB;
}) => {
	// Skip for viewer role
	if (invitation.role === "viewer") {
		return;
	}

	// Check for guest player to claim in this league
	const [guestPlayer] = await db
		.select({
			id: player.id,
			guestId: player.guestId,
			guestEmail: guest.email,
		})
		.from(player)
		.innerJoin(guest, eq(player.guestId, guest.id))
		.where(and(eq(player.leagueId, invitation.organizationId), eq(guest.email, user.email)))
		.limit(1);

	if (guestPlayer) {
		const guestId = guestPlayer.guestId as string;

		// Claim: convert guest player to user player
		await db
			.update(player)
			.set({ userId: user.id, guestId: null, updatedAt: new Date() })
			.where(eq(player.id, guestPlayer.id));

		// Check if guest has other players in other leagues
		const [otherPlayer] = await db
			.select({ id: player.id })
			.from(player)
			.where(and(eq(player.guestId, guestId), ne(player.id, guestPlayer.id)))
			.limit(1);

		// Only delete guest if no other players reference it
		if (!otherPlayer) {
			await db.delete(guest).where(eq(guest.id, guestId));
		}

		return;
	}

	// Check for existing user player
	const [existingPlayer] = await db
		.select({ id: player.id })
		.from(player)
		.where(and(eq(player.leagueId, invitation.organizationId), eq(player.userId, user.id)))
		.limit(1);

	if (existingPlayer) return;

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
	user: { id: string; email: string };
	db: DB;
}) => {
	// Check for guest player to claim
	const [guestPlayer] = await db
		.select({
			id: player.id,
			guestId: player.guestId,
		})
		.from(player)
		.innerJoin(guest, eq(player.guestId, guest.id))
		.where(and(eq(player.leagueId, organization.id), eq(guest.email, user.email)))
		.limit(1);

	if (guestPlayer) {
		const guestId = guestPlayer.guestId as string;

		await db
			.update(player)
			.set({ userId: user.id, guestId: null, updatedAt: new Date() })
			.where(eq(player.id, guestPlayer.id));

		const [otherPlayer] = await db
			.select({ id: player.id })
			.from(player)
			.where(and(eq(player.guestId, guestId), ne(player.id, guestPlayer.id)))
			.limit(1);

		if (!otherPlayer) {
			await db.delete(guest).where(eq(guest.id, guestId));
		}

		return;
	}

	await createPlayerForUser({
		db,
		userId: user.id,
		organizationId: organization.id,
	});
};
