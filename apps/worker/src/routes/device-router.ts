import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { league, member, player, season, seasonPlayer, user } from "../db/schema";
import type { HonoEnv } from "../middleware/context";
import { create as createMatch } from "../repositories/match-repository";

type DeviceAuthHonoEnv = HonoEnv & {
	Variables: HonoEnv["Variables"] & {
		deviceAuth: {
			apiKey: {
				id: string;
				userId: string;
			};
			user: typeof user.$inferSelect;
		};
	};
};

/**
 * Device router - endpoints called by Tallyo devices using API key authentication.
 * Keys are user-scoped, so devices can access any league the user is a member of.
 * Key management is handled by Better Auth's built-in API key endpoints.
 */
const deviceRouter = new Hono<DeviceAuthHonoEnv>()
	.use("*", async (c, next) => {
		const betterAuth = c.get("betterAuth");
		const db = c.get("db");
		const authHeader = c.req.header("x-api-key") || c.req.header("Authorization")?.slice(7);

		if (!authHeader) {
			return c.json({ error: "Missing API key" }, 401);
		}

		const result = await betterAuth.api.verifyApiKey({
			body: { key: authHeader },
		});

		if (!result.valid || !result.key) {
			return c.json({ error: result.error?.message || "Invalid API key" }, 401);
		}

		const userData = await db.select().from(user).where(eq(user.id, result.key.userId)).get();

		if (!userData) {
			return c.json({ error: "User not found" }, 404);
		}

		c.set("deviceAuth", {
			apiKey: {
				id: result.key.id,
				userId: result.key.userId,
			},
			user: userData,
		});

		await next();
	})
	.get("/leagues", async (c) => {
		const db = c.get("db");
		const { user: deviceUser } = c.get("deviceAuth");

		const userLeagues = await db
			.select({
				id: league.id,
				name: league.name,
				slug: league.slug,
				logo: league.logo,
			})
			.from(member)
			.innerJoin(league, eq(member.organizationId, league.id))
			.where(eq(member.userId, deviceUser.id));

		return c.json({ leagues: userLeagues });
	})
	.get("/leagues/:leagueSlug/context", async (c) => {
		const db = c.get("db");
		const { user: deviceUser } = c.get("deviceAuth");
		const { leagueSlug } = c.req.param();

		// Verify user is a member of this league
		const leagueData = await db
			.select({ id: league.id, name: league.name, slug: league.slug })
			.from(league)
			.where(eq(league.slug, leagueSlug))
			.get();

		if (!leagueData) {
			return c.json({ error: "League not found" }, 404);
		}

		const memberData = await db
			.select({ id: member.id })
			.from(member)
			.where(and(eq(member.organizationId, leagueData.id), eq(member.userId, deviceUser.id)))
			.get();

		if (!memberData) {
			return c.json({ error: "Not a member of this league" }, 403);
		}

		const seasons = await db
			.select({
				id: season.id,
				name: season.name,
				slug: season.slug,
				closed: season.closed,
				archived: season.archived,
			})
			.from(season)
			.where(and(eq(season.leagueId, leagueData.id), eq(season.archived, false)));

		const activeSeason = seasons.find((s) => !s.closed) || seasons[0];

		if (!activeSeason) {
			return c.json({
				league: {
					id: leagueData.id,
					name: leagueData.name,
					slug: leagueData.slug,
				},
				season: null,
				players: [],
			});
		}

		const players = await db
			.select({
				id: seasonPlayer.id,
				name: user.name,
				score: seasonPlayer.score,
			})
			.from(seasonPlayer)
			.innerJoin(player, eq(seasonPlayer.playerId, player.id))
			.innerJoin(user, eq(player.userId, user.id))
			.where(and(eq(seasonPlayer.seasonId, activeSeason.id), eq(seasonPlayer.disabled, false)));

		return c.json({
			league: {
				id: leagueData.id,
				name: leagueData.name,
				slug: leagueData.slug,
			},
			season: {
				id: activeSeason.id,
				name: activeSeason.name,
				slug: activeSeason.slug,
			},
			players: players.map((p) => ({
				id: p.id,
				name: p.name,
				score: p.score,
			})),
		});
	});

const createMatchSchema = z.object({
	seasonSlug: z.string().min(1),
	homePlayerNames: z.array(z.string()).min(1),
	awayPlayerNames: z.array(z.string()).min(1),
	homeScore: z.number().int().min(0),
	awayScore: z.number().int().min(0),
});

deviceRouter.post(
	"/leagues/:leagueSlug/matches",
	zValidator("json", createMatchSchema),
	async (c) => {
		const db = c.get("db");
		const { user: deviceUser } = c.get("deviceAuth");
		const { leagueSlug } = c.req.param();

		// Verify user is a member of this league
		const leagueData = await db
			.select({ id: league.id })
			.from(league)
			.where(eq(league.slug, leagueSlug))
			.get();

		if (!leagueData) {
			return c.json({ error: "League not found" }, 404);
		}

		const memberData = await db
			.select({ id: member.id })
			.from(member)
			.where(and(eq(member.organizationId, leagueData.id), eq(member.userId, deviceUser.id)))
			.get();

		if (!memberData) {
			return c.json({ error: "Not a member of this league" }, 403);
		}

		const { seasonSlug, homePlayerNames, awayPlayerNames, homeScore, awayScore } =
			c.req.valid("json");

		const seasonData = await db
			.select({ id: season.id, closed: season.closed })
			.from(season)
			.where(and(eq(season.leagueId, leagueData.id), eq(season.slug, seasonSlug)))
			.get();

		if (!seasonData) {
			return c.json({ error: "Season not found" }, 404);
		}

		if (seasonData.closed) {
			return c.json({ error: "Season is closed" }, 400);
		}

		// Get all active players in the season for name matching
		const players = await db
			.select({
				id: seasonPlayer.id,
				name: user.name,
			})
			.from(seasonPlayer)
			.innerJoin(player, eq(seasonPlayer.playerId, player.id))
			.innerJoin(user, eq(player.userId, user.id))
			.where(and(eq(seasonPlayer.seasonId, seasonData.id), eq(seasonPlayer.disabled, false)));

		// Match player names to season player IDs (voice input may be fuzzy)
		const matchPlayersByName = (names: string[]) => {
			const matched: { id: string; name: string; originalName: string }[] = [];
			const unmatched: string[] = [];

			for (const name of names) {
				const normalizedInput = name.toLowerCase().trim();
				const exactMatch = players.find((p) => p.name.toLowerCase() === normalizedInput);

				if (exactMatch) {
					matched.push({ id: exactMatch.id, name: exactMatch.name, originalName: name });
					continue;
				}

				const partialMatches = players.filter((p) => {
					const playerNameLower = p.name.toLowerCase();
					const firstName = playerNameLower.split(" ")[0];
					return (
						playerNameLower.includes(normalizedInput) ||
						firstName === normalizedInput ||
						normalizedInput.includes(firstName)
					);
				});

				if (partialMatches.length === 1) {
					matched.push({
						id: partialMatches[0].id,
						name: partialMatches[0].name,
						originalName: name,
					});
				} else {
					unmatched.push(name);
				}
			}

			return { matched, unmatched };
		};

		const homeResult = matchPlayersByName(homePlayerNames);
		const awayResult = matchPlayersByName(awayPlayerNames);

		const allUnmatched = [...homeResult.unmatched, ...awayResult.unmatched];
		if (allUnmatched.length > 0) {
			return c.json(
				{
					error: "Could not match players",
					unmatchedPlayers: allUnmatched,
					availablePlayers: players.map((p) => p.name),
				},
				400
			);
		}

		const homeTeamPlayerIds = homeResult.matched.map((p) => p.id);
		const awayTeamPlayerIds = awayResult.matched.map((p) => p.id);

		if (homeTeamPlayerIds.length !== awayTeamPlayerIds.length) {
			return c.json({ error: "Teams must have equal number of players" }, 400);
		}

		// Uses shared match-repository.create - same logic as tRPC match.create
		const match = await createMatch({
			db,
			input: {
				seasonId: seasonData.id,
				homeScore,
				awayScore,
				homeTeamPlayerIds,
				awayTeamPlayerIds,
				userId: deviceUser.id,
			},
		});

		return c.json({
			success: true,
			match: {
				id: match.id,
				homeScore,
				awayScore,
				homePlayers: homeResult.matched.map((p) => p.name),
				awayPlayers: awayResult.matched.map((p) => p.name),
				createdAt: match.createdAt.toISOString(),
			},
		});
	}
);

export { deviceRouter };
