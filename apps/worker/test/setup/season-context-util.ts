import { env } from "cloudflare:test";
import { randNumber, randSlug, randSports, randUuid } from "@ngneat/falso";
import { eq } from "drizzle-orm";
import { getDb } from "../../src/db/index";
import { player } from "../../src/db/schema/competition-schema";
import { createUser, type AuthContext } from "./auth-context-util";

export interface SeasonInput {
	name?: string;
	slug?: string;
	initialScore?: number;
	scoreType?: "elo" | "3-1-0" | "elo-individual-vs-team";
	kFactor?: number;
	rounds?: number;
}

export interface PlayerInput {
	userId: string;
	disabled?: boolean;
}

/**
 * Generate season input with defaults
 */
export function aSeason(overrides: CompetitionInput = {}): Required<CompetitionInput> {
	const name = overrides.name ?? randSports();
	return {
		name,
		slug: overrides.slug ?? randSlug(),
		initialScore: overrides.initialScore ?? 1000,
		scoreType: overrides.scoreType ?? "elo",
		kFactor: overrides.kFactor ?? 32,
		rounds: overrides.rounds ?? randNumber({ min: 1, max: 5 }),
	};
}

/**
 * Generate player input with defaults
 */
export function aPlayer(
	userId: string,
	overrides: Omit<PlayerInput, "userId"> = {}
): Required<PlayerInput> {
	return {
		userId,
		disabled: overrides.disabled ?? false,
	};
}

/**
 * Create a player for a league
 */
export async function createPlayer(
	authContext: AuthContext,
	userId: string,
	overrides: Omit<PlayerInput, "userId"> = {}
) {
	const db = getDb(env.DB);
	const now = new Date();

	const playerInput = aPlayer(userId, overrides);

	const [p] = await db
		.insert(player)
		.values({
			id: randUuid(),
			userId: playerInput.userId,
			organizationId: authContext.league.id,
			disabled: playerInput.disabled,
			createdAt: now,
			updatedAt: now,
			deletedAt: null,
		})
		.returning();

	if (!p) throw new Error("Failed to create player");

	return p;
}

/**
 * Create multiple players for a league using the authenticated user's ID
 */
export async function createPlayers(authContext: AuthContext, count: number) {
	const userPromises = Array.from({ length: count }, async (_, i) =>
		i === 0 ? authContext.user.id : (await createUser()).user.id
	);
	const userIds = await Promise.all(userPromises);

	const playerPromises = userIds.map((userId) => createPlayer(authContext, userId));
	return Promise.all(playerPromises);
}

/**
 * Get all players for a league
 */
export async function getPlayers(authContext: AuthContext) {
	const db = getDb(env.DB);
	return db.select().from(player).where(eq(player.organizationId, authContext.league.id));
}

/**
 * Create auth headers with session token
 */
export function authHeaders(sessionToken: string): Record<string, string> {
	return {
		Cookie: `better-auth.session_token=${sessionToken}`,
	};
}
