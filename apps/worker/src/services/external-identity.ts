import { and, eq, inArray } from "drizzle-orm";
import { newId } from "@coding-cowboys/scorebrawl-util/id-util";
import { createId } from "../utils/id-util";
import type { DrizzleDB } from "../db";
import { user } from "../db/schema/auth-schema";
import { guest, player, seasonPlayer } from "../db/schema/league-schema";

export interface MatchParticipant {
	role: "winner" | "loser";
	externalUserId?: string;
	email?: string;
	name?: string;
}

export interface ResolvedParticipants {
	winnerSeasonPlayerId: string;
	loserSeasonPlayerIds: string[];
}

export class UnresolvedParticipantsError extends Error {
	constructor(public unresolved: string[]) {
		super(
			`Could not match participants: ${unresolved.join(", ")}. Provide an externalUserId or a league email for every player.`
		);
		this.name = "UnresolvedParticipantsError";
	}
}

function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}

export async function resolveParticipantsToSeasonPlayers({
	db,
	leagueId,
	seasonId,
	initialScore,
	participants,
}: {
	db: DrizzleDB;
	leagueId: string;
	seasonId: string;
	initialScore: number;
	participants: MatchParticipant[];
}): Promise<ResolvedParticipants> {
	const userIds = [
		...new Set(participants.map((p) => p.externalUserId).filter(Boolean) as string[]),
	];
	const emails = [
		...new Set(
			participants
				.map((p) => p.email)
				.filter((email): email is string => Boolean(email))
				.map(normalizeEmail)
		),
	];

	const [playersByUserRows, usersByEmailRows, guestsByEmailRows] = await Promise.all([
		userIds.length > 0
			? db
					.select({ id: player.id, userId: player.userId })
					.from(player)
					.where(and(eq(player.leagueId, leagueId), inArray(player.userId, userIds)))
			: Promise.resolve([]),
		emails.length > 0
			? db.select({ id: user.id, email: user.email }).from(user).where(inArray(user.email, emails))
			: Promise.resolve([]),
		emails.length > 0
			? db.select().from(guest).where(inArray(guest.email, emails))
			: Promise.resolve([]),
	]);

	const playerIdByUserId = new Map(playersByUserRows.map((r) => [r.userId, r.id]));
	const userIdByEmail = new Map(usersByEmailRows.map((r) => [r.email, r.id]));
	const guestByEmail = new Map(guestsByEmailRows.map((r) => [r.email, r]));

	const guestIds = [...new Set(guestsByEmailRows.map((g) => g.id))];
	const playersByGuestRows =
		guestIds.length > 0
			? await db
					.select({ id: player.id, guestId: player.guestId })
					.from(player)
					.where(and(eq(player.leagueId, leagueId), inArray(player.guestId, guestIds)))
			: [];
	const playerIdByGuestId = new Map(playersByGuestRows.map((r) => [r.guestId, r.id]));

	const now = new Date();
	const seasonPlayerIdsByPlayerId = new Map<string, string>();
	const existingSeasonPlayerRows =
		playersByUserRows.length + playersByGuestRows.length > 0
			? await db
					.select({ id: seasonPlayer.id, playerId: seasonPlayer.playerId })
					.from(seasonPlayer)
					.where(
						and(
							eq(seasonPlayer.seasonId, seasonId),
							inArray(
								seasonPlayer.playerId,
								[...playersByUserRows, ...playersByGuestRows].map((r) => r.id)
							)
						)
					)
			: [];
	for (const row of existingSeasonPlayerRows) {
		seasonPlayerIdsByPlayerId.set(row.playerId, row.id);
	}

	const unresolved: string[] = [];
	const needsGuest: MatchParticipant[] = [];
	const playerIdByParticipant = new Map<MatchParticipant, string>();

	for (const participant of participants) {
		let playerId: string | undefined;

		if (participant.externalUserId) {
			playerId = playerIdByUserId.get(participant.externalUserId);
		}

		if (!playerId && participant.email) {
			const email = normalizeEmail(participant.email);
			const userId = userIdByEmail.get(email);
			if (userId) {
				playerId = playerIdByUserId.get(userId);
			}
			if (!playerId) {
				const existingGuest = guestByEmail.get(email);
				if (existingGuest) {
					playerId = playerIdByGuestId.get(existingGuest.id);
				}
			}
		}

		if (playerId) {
			playerIdByParticipant.set(participant, playerId);
			continue;
		}

		if (participant.email) {
			needsGuest.push(participant);
			continue;
		}

		unresolved.push(participant.name || participant.externalUserId || "unknown");
	}

	if (unresolved.length > 0) {
		throw new UnresolvedParticipantsError(unresolved);
	}

	// Auto-create guest + player + seasonPlayer for participants matched by email
	// whose email isn't linked to any league player yet.
	for (const participant of needsGuest) {
		const email = normalizeEmail(participant.email!);
		let existingGuest = guestByEmail.get(email);
		if (!existingGuest) {
			const created = await db
				.insert(guest)
				.values({
					id: createId(),
					email,
					displayName: participant.name || email,
					createdAt: now,
					updatedAt: now,
				})
				.returning();
			existingGuest = created[0];
			guestByEmail.set(email, existingGuest);
		}

		const createdPlayer = await db
			.insert(player)
			.values({
				id: createId(),
				guestId: existingGuest.id,
				leagueId,
				disabled: false,
				createdAt: now,
				updatedAt: now,
			})
			.returning();
		playerIdByParticipant.set(participant, createdPlayer[0].id);
	}

	// Ensure a seasonPlayer row exists for every resolved player.
	const missingPlayerIds = [
		...new Set(
			[...playerIdByParticipant.values()].filter((id) => !seasonPlayerIdsByPlayerId.has(id))
		),
	];
	if (missingPlayerIds.length > 0) {
		const createdSeasonPlayers = await db
			.insert(seasonPlayer)
			.values(
				missingPlayerIds.map((playerId) => ({
					id: newId("seasonPlayer"),
					seasonId,
					playerId,
					score: initialScore,
					disabled: false,
					createdAt: now,
					updatedAt: now,
				}))
			)
			.returning();
		for (const row of createdSeasonPlayers) {
			seasonPlayerIdsByPlayerId.set(row.playerId, row.id);
		}
	}

	const winner = participants.find((p) => p.role === "winner");
	const losers = participants.filter((p) => p.role === "loser");
	if (!winner || losers.length === 0) {
		throw new Error("A push must include exactly one winner and at least one loser");
	}

	const winnerSeasonPlayerId = seasonPlayerIdsByPlayerId.get(playerIdByParticipant.get(winner)!);
	const loserSeasonPlayerIds = losers.map((l) =>
		seasonPlayerIdsByPlayerId.get(playerIdByParticipant.get(l)!)
	);

	if (!winnerSeasonPlayerId || loserSeasonPlayerIds.some((id) => !id)) {
		throw new Error("Failed to resolve all participants to season players");
	}

	return {
		winnerSeasonPlayerId,
		loserSeasonPlayerIds: loserSeasonPlayerIds as string[],
	};
}
