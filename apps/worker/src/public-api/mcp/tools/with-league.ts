import { eq } from "drizzle-orm";
import { z } from "zod";
import { league, member } from "../../../db/schema/auth-schema";
import type { McpToolContext } from "../context";

export interface LeagueOption {
	id: string;
	slug: string;
	name: string;
	role: string;
}

/** The leagues the token subject belongs to. */
export async function leaguesForUser(ctx: McpToolContext): Promise<LeagueOption[]> {
	const userId = ctx.claims.sub;
	if (!userId) return [];
	return ctx.db
		.select({ id: league.id, slug: league.slug, name: league.name, role: member.role })
		.from(member)
		.innerJoin(league, eq(league.id, member.organizationId))
		.where(eq(member.userId, userId));
}

/**
 * Resolves the target league for a tool call. Returns `{ leagueId }` on success,
 * or `{ error }` with a human-readable message listing valid slugs.
 */
export async function resolveLeagueId(
	ctx: McpToolContext,
	requested?: string
): Promise<{ leagueId: string } | { error: string }> {
	const options = await leaguesForUser(ctx);
	if (options.length === 0) {
		return { error: "You are not a member of any league on Scorebrawl." };
	}
	if (requested) {
		const match = options.find((o) => o.id === requested || o.slug === requested);
		if (!match) {
			return {
				error: `Unknown league "${requested}". Available: ${options.map((o) => o.slug).join(", ")}`,
			};
		}
		return { leagueId: match.id };
	}
	if (options.length === 1) return { leagueId: options[0].id };
	return {
		error: `You belong to multiple leagues. Pass "league" as one of: ${options
			.map((o) => o.slug)
			.join(", ")}`,
	};
}

/** The optional `league` field every data tool exposes. */
export const leagueFieldSchema = {
	league: z
		.string()
		.describe("League slug or id to query. Optional when you belong to exactly one league.")
		.optional(),
};
