import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { league, member, player, season, seasonPlayer, user } from "../db/schema";
import type { EnforcedAuthHonoEnv } from "../middleware/auth";
import {
	create as createMatch,
	checkStreakThresholds,
	checkTeamStreakThresholds,
} from "../repositories/match-repository";
import * as sessionRepository from "../repositories/session-repository";
import * as sessionService from "../services/session";

import { broadcastSeasonEvent } from "./sse-router";
import type { AchievementQueueMessage } from "../services/achievement-calculation";
import type { AuthType } from "../middleware/context";

/**
 * Device router - endpoints called by Tallyo devices using API key authentication.
 * Keys are user-scoped, so devices can access any league the user is a member of.
 * Key management is handled by Better Auth's built-in API key endpoints.
 */

type LeagueData = { id: string; name: string; slug: string };
type ActiveSeason = {
	id: string;
	name: string;
	slug: string;
	closed: boolean;
	archived: boolean;
} | null;

type LeagueEnv = EnforcedAuthHonoEnv & {
	Variables: {
		leagueData: LeagueData;
		activeSeason: ActiveSeason;
	};
};

const leagueMemberMiddleware = createMiddleware<LeagueEnv>(async (c, next) => {
	const db = c.get("db");
	const userId = c.get("authentication").user.id;
	const leagueSlug = c.req.param("leagueSlug");

	if (!leagueSlug) {
		throw new HTTPException(400, { message: "leagueSlug is required" });
	}

	const leagueData = await db
		.select({ id: league.id, name: league.name, slug: league.slug })
		.from(league)
		.where(eq(league.slug, leagueSlug))
		.get();

	if (!leagueData) {
		throw new HTTPException(404, { message: "League not found" });
	}

	const memberData = await db
		.select({ id: member.id })
		.from(member)
		.where(and(eq(member.organizationId, leagueData.id), eq(member.userId, userId)))
		.get();

	if (!memberData) {
		throw new HTTPException(403, { message: "Not a member of this league" });
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

	const activeSeason = seasons.find((s) => !s.closed) ?? null;

	c.set("leagueData", leagueData);
	c.set("activeSeason", activeSeason);

	await next();
});

function formatSessionState(
	fullSession: NonNullable<Awaited<ReturnType<typeof sessionRepository.getSessionById>>>,
	seasonSlug: string
) {
	const currentMatch = fullSession.matches.find((m) => m.result === null);
	const pendingCoinToss = fullSession.pendingCoinTosses[0] ?? null;

	const playerNameMap = new Map(fullSession.players.map((p) => [p.id, p.displayName]));
	const resolveNames = (ids: string[]) =>
		ids.map((id) => ({ sessionPlayerId: id, name: playerNameMap.get(id) ?? "Unknown" }));

	const resolveNamesFromSeasonPlayerIds = (seasonPlayerIds: string[]) =>
		seasonPlayerIds.map((spId) => {
			const sp = fullSession.players.find((p) => p.seasonPlayerId === spId);
			return { sessionPlayerId: sp?.id ?? "", name: sp?.displayName ?? "Unknown" };
		});

	let state: "proposed_lineup" | "match_in_progress" | "coin_toss_pending";
	if (pendingCoinToss) {
		state = "coin_toss_pending";
	} else if (currentMatch) {
		state = "match_in_progress";
	} else {
		state = "proposed_lineup";
	}

	const lineup = fullSession.proposedLineup;
	let proposedLineup = null;
	if (lineup) {
		const homeIds = lineup.selectedHomePlayerIds ?? lineup.homePlayerIds;
		const awayIds = lineup.selectedAwayPlayerIds ?? lineup.awayPlayerIds;
		proposedLineup = {
			home: resolveNames(homeIds),
			away: resolveNames(awayIds),
		};
	}

	const waitingPlayers = fullSession.players
		.filter((p) => p.status === "waiting")
		.sort((a, b) => a.queuePosition - b.queuePosition);

	const playingIds = new Set<string>();
	if (currentMatch) {
		for (const spId of currentMatch.homePlayerIds) {
			const sp = fullSession.players.find((p) => p.seasonPlayerId === spId);
			if (sp) playingIds.add(sp.id);
		}
		for (const spId of currentMatch.awayPlayerIds) {
			const sp = fullSession.players.find((p) => p.seasonPlayerId === spId);
			if (sp) playingIds.add(sp.id);
		}
	}
	if (lineup) {
		const homeIds = lineup.selectedHomePlayerIds ?? lineup.homePlayerIds;
		const awayIds = lineup.selectedAwayPlayerIds ?? lineup.awayPlayerIds;
		for (const id of [...homeIds, ...awayIds]) playingIds.add(id);
	}

	const queue = waitingPlayers
		.filter((p) => !playingIds.has(p.id))
		.map((p) => ({ sessionPlayerId: p.id, name: p.displayName }));

	return {
		session: {
			id: fullSession.id,
			seasonSlug,
			matchCount: fullSession.matches.length,
			teamSize: fullSession.teamSize,
			rotationMode: fullSession.rotationMode,
			state,
			currentMatch: currentMatch
				? {
						sessionMatchId: currentMatch.id,
						matchNumber: currentMatch.matchNumber,
						home: resolveNamesFromSeasonPlayerIds(currentMatch.homePlayerIds),
						away: resolveNamesFromSeasonPlayerIds(currentMatch.awayPlayerIds),
						homeScore: currentMatch.homeSessionScore,
						awayScore: currentMatch.awaySessionScore,
					}
				: null,
			proposedLineup,
			pendingCoinToss: pendingCoinToss
				? {
						id: pendingCoinToss.id,
						conflictType: pendingCoinToss.conflictType,
						candidates: resolveNames(pendingCoinToss.candidates),
					}
				: null,
			queue,
		},
	};
}

const createMatchSchema = z.object({
	seasonSlug: z.string().min(1),
	homePlayerNames: z.array(z.string()).min(1),
	awayPlayerNames: z.array(z.string()).min(1),
	homeScore: z.number().int().min(0),
	awayScore: z.number().int().min(0),
});

// Sub-router for all league-scoped endpoints. E is fixed to LeagueEnv at
// construction time, keeping chain type inference shallow.
const leagueRouter = new Hono<LeagueEnv>()
	.use("*", leagueMemberMiddleware)
	.get("/context", async (c) => {
		const db = c.get("db");
		const leagueData = c.get("leagueData");
		const activeSeason = c.get("activeSeason");

		if (!activeSeason) {
			return c.json({
				league: { id: leagueData.id, name: leagueData.name, slug: leagueData.slug },
				season: null,
				players: [],
			});
		}

		const players = await db
			.select({ id: seasonPlayer.id, name: user.name, score: seasonPlayer.score })
			.from(seasonPlayer)
			.innerJoin(player, eq(seasonPlayer.playerId, player.id))
			.innerJoin(user, eq(player.userId, user.id))
			.where(and(eq(seasonPlayer.seasonId, activeSeason.id), eq(seasonPlayer.disabled, false)));

		return c.json({
			league: { id: leagueData.id, name: leagueData.name, slug: leagueData.slug },
			season: { id: activeSeason.id, name: activeSeason.name, slug: activeSeason.slug },
			players: players.map((p) => ({ id: p.id, name: p.name, score: p.score })),
		});
	})
	.get("/session/active", async (c) => {
		const db = c.get("db");
		const activeSeason = c.get("activeSeason");

		if (!activeSeason) {
			return c.json({ session: null });
		}

		const fullSession = await sessionRepository.getActiveSessionFull({
			db,
			seasonId: activeSeason.id,
		});

		if (!fullSession) {
			return c.json({ session: null });
		}

		return c.json(formatSessionState(fullSession, activeSeason.slug));
	})
	.post("/session/start-match", async (c) => {
		const db = c.get("db");
		const userId = c.get("authentication").user.id;
		const leagueData = c.get("leagueData");
		const activeSeason = c.get("activeSeason");

		if (!activeSeason) {
			throw new HTTPException(400, { message: "No active season" });
		}

		const fullSession = await sessionRepository.getActiveSessionFull({
			db,
			seasonId: activeSeason.id,
		});

		if (!fullSession) {
			throw new HTTPException(400, { message: "No active session" });
		}

		const inProgressMatch = fullSession.matches.find((m) => m.result === null);
		if (inProgressMatch) {
			throw new HTTPException(400, { message: "Match already in progress" });
		}

		const lineup = fullSession.proposedLineup;
		if (!lineup) {
			throw new HTTPException(400, { message: "No proposed lineup" });
		}

		const homeSessionPlayerIds = lineup.selectedHomePlayerIds ?? lineup.homePlayerIds;
		const awaySessionPlayerIds = lineup.selectedAwayPlayerIds ?? lineup.awayPlayerIds;

		const playerMap = new Map(fullSession.players.map((p) => [p.id, p.seasonPlayerId]));
		const homeSeasonPlayerIds = homeSessionPlayerIds.map((id) => playerMap.get(id)!);
		const awaySeasonPlayerIds = awaySessionPlayerIds.map((id) => playerMap.get(id)!);

		const sessionMatch = await sessionService.startNextMatch(
			db,
			fullSession.id,
			homeSeasonPlayerIds,
			awaySeasonPlayerIds
		);

		c.executionCtx.waitUntil(
			broadcastSeasonEvent(c.env, leagueData.slug, activeSeason.slug, {
				type: "session:update",
				data: { sessionId: fullSession.id, match: sessionMatch },
				user: { id: userId, name: c.get("authentication").user.name },
			})
		);

		return c.json({ success: true, matchNumber: sessionMatch.matchNumber });
	})
	.post("/session/record-result", async (c) => {
		const db = c.get("db");
		const userId = c.get("authentication").user.id;
		const leagueData = c.get("leagueData");
		const activeSeason = c.get("activeSeason");
		const scoreParsed = z
			.object({
				homeScore: z.coerce.number().int().min(0).max(99),
				awayScore: z.coerce.number().int().min(0).max(99),
			})
			.safeParse(c.req.query());
		if (!scoreParsed.success) {
			throw new HTTPException(400, { message: "Invalid query params" });
		}
		const { homeScore, awayScore } = scoreParsed.data;

		if (!activeSeason) {
			throw new HTTPException(400, { message: "No active season" });
		}

		const fullSession = await sessionRepository.getActiveSessionFull({
			db,
			seasonId: activeSeason.id,
		});

		if (!fullSession) {
			throw new HTTPException(400, { message: "No active session" });
		}

		const sessionMatch = fullSession.matches.find((m) => m.result === null);
		if (!sessionMatch) {
			throw new HTTPException(400, { message: "No match in progress" });
		}

		const result: "home" | "away" | "draw" =
			homeScore > awayScore ? "home" : awayScore > homeScore ? "away" : "draw";

		const serviceResult = await sessionService.recordResult(db, {
			sessionId: fullSession.id,
			sessionMatchId: sessionMatch.id,
			result,
			homeScore,
			awayScore,
			seasonId: activeSeason.id,
			leagueId: leagueData.id,
		});

		await c.env.ACHIEVEMENT_QUEUE.send({
			seasonPlayerIds: [
				...serviceResult.streakData.homePlayerIds,
				...serviceResult.streakData.awayPlayerIds,
			],
		} satisfies AchievementQueueMessage);

		const userName = c.get("authentication").user.name;
		await broadcastSeasonEvent(c.env, leagueData.slug, activeSeason.slug, {
			type: "session:update",
			data: {
				sessionId: fullSession.id,
				match: { id: serviceResult.match.id },
				players: [],
				proposedLineup: serviceResult.proposedLineup,
			},
			user: { id: userId, name: userName },
		});

		const [streakPlayers, streakTeams] = await Promise.all([
			checkStreakThresholds({
				db,
				seasonPlayerIds: [
					...serviceResult.streakData.homePlayerIds,
					...serviceResult.streakData.awayPlayerIds,
				],
			}),
			checkTeamStreakThresholds({
				db,
				matchId: serviceResult.streakData.matchId,
			}),
		]);

		const userInfo = { id: userId, name: userName };
		const timestamp = Date.now();
		const streakEvents = [
			...streakPlayers.map((p) => ({
				type: "streak" as const,
				data: {
					playerId: p.playerId,
					playerName: p.playerName,
					playerImage: p.playerImage,
					streak: p.streak,
					timestamp,
				},
				user: userInfo,
			})),
			...streakTeams.map((t) => ({
				type: "streak" as const,
				data: {
					playerId: t.seasonTeamId,
					playerName: t.teamName,
					playerImage: t.teamLogo,
					streak: t.streak,
					timestamp,
					isTeam: true,
				},
				user: userInfo,
			})),
		];
		await Promise.all(
			streakEvents.map((event) =>
				broadcastSeasonEvent(c.env, leagueData.slug, activeSeason.slug, event)
			)
		);

		const refreshedSession = await sessionRepository.getActiveSessionFull({
			db,
			seasonId: activeSeason.id,
		});
		if (!refreshedSession) {
			throw new HTTPException(500, { message: "Failed to reload session" });
		}
		return c.json(formatSessionState(refreshedSession, activeSeason.slug));
	})
	.post("/session/resolve-coin-toss", async (c) => {
		const db = c.get("db");
		const userId = c.get("authentication").user.id;
		const leagueData = c.get("leagueData");
		const activeSeason = c.get("activeSeason");
		const queryParsed = z
			.object({ coinTossId: z.string(), winnerIds: z.string().min(1) })
			.safeParse(c.req.query());
		if (!queryParsed.success) {
			throw new HTTPException(400, { message: "Invalid query params" });
		}
		const { coinTossId, winnerIds: winnerIdsRaw } = queryParsed.data;
		const winnerIds = winnerIdsRaw.split(",");

		if (!activeSeason) {
			throw new HTTPException(400, { message: "No active season" });
		}

		const fullSession = await sessionRepository.getActiveSessionFull({
			db,
			seasonId: activeSeason.id,
		});

		if (!fullSession) {
			throw new HTTPException(400, { message: "No active session" });
		}

		const coinToss = fullSession.pendingCoinTosses.find((ct) => ct.id === coinTossId);

		if (!coinToss) {
			throw new HTTPException(404, { message: "Coin toss not found" });
		}

		if (!winnerIds.every((id) => coinToss.candidates.includes(id))) {
			throw new HTTPException(400, { message: "Invalid winner IDs" });
		}

		const serviceResult = await sessionService.resolveCoinToss(db, {
			sessionId: fullSession.id,
			coinTossId,
			winnerIds,
		});

		const userName = c.get("authentication").user.name;
		await broadcastSeasonEvent(c.env, leagueData.slug, activeSeason.slug, {
			type: "session:update",
			data: {
				sessionId: fullSession.id,
				resolvedCoinToss: serviceResult.resolved,
				proposedLineup: serviceResult.proposedLineup,
			},
			user: { id: userId, name: userName },
		});

		const refreshedSession = await sessionRepository.getActiveSessionFull({
			db,
			seasonId: activeSeason.id,
		});
		if (!refreshedSession) {
			throw new HTTPException(500, { message: "Failed to reload session" });
		}
		return c.json(formatSessionState(refreshedSession, activeSeason.slug));
	})
	.post("/session/update-score", async (c) => {
		const db = c.get("db");
		const userId = c.get("authentication").user.id;
		const leagueData = c.get("leagueData");
		const activeSeason = c.get("activeSeason");
		const scoreParsed = z
			.object({
				homeScore: z.coerce.number().int().min(0).max(99),
				awayScore: z.coerce.number().int().min(0).max(99),
			})
			.safeParse(c.req.query());
		if (!scoreParsed.success) {
			throw new HTTPException(400, { message: "Invalid query params" });
		}
		const { homeScore, awayScore } = scoreParsed.data;

		if (!activeSeason) {
			throw new HTTPException(400, { message: "No active season" });
		}

		const fullSession = await sessionRepository.getActiveSessionFull({
			db,
			seasonId: activeSeason.id,
		});

		if (!fullSession) {
			throw new HTTPException(400, { message: "No active session" });
		}

		const sessionMatch = fullSession.matches.find((m) => m.result === null);
		if (!sessionMatch) {
			throw new HTTPException(400, { message: "No match in progress" });
		}

		await sessionService.updateMatchScore(db, {
			sessionId: fullSession.id,
			sessionMatchId: sessionMatch.id,
			homeScore,
			awayScore,
		});

		await broadcastSeasonEvent(c.env, leagueData.slug, activeSeason.slug, {
			type: "session:score-update",
			data: {
				sessionId: fullSession.id,
				sessionMatchId: sessionMatch.id,
				homeScore,
				awayScore,
			},
			user: { id: userId, name: c.get("authentication").user.name },
		});

		return c.json({ success: true });
	})
	.post("/session/shuffle-lineup", async (c) => {
		const db = c.get("db");
		const activeSeason = c.get("activeSeason");

		if (!activeSeason) {
			throw new HTTPException(400, { message: "No active season" });
		}

		const fullSession = await sessionRepository.getActiveSessionFull({
			db,
			seasonId: activeSeason.id,
		});

		if (!fullSession) {
			throw new HTTPException(400, { message: "No active session" });
		}

		const currentMatch = fullSession.matches.find((m) => m.result === null);
		if (currentMatch) {
			throw new HTTPException(400, { message: "Match already in progress" });
		}

		const lineup = fullSession.proposedLineup;
		if (!lineup) {
			throw new HTTPException(400, { message: "No proposed lineup" });
		}

		const allPlayerIds = [...lineup.homePlayerIds, ...lineup.awayPlayerIds];

		const shuffled = [...allPlayerIds];
		for (let i = shuffled.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
		}

		const teamSize = shuffled.length / 2;
		const newHomeIds = shuffled.slice(0, teamSize);
		const newAwayIds = shuffled.slice(teamSize);

		const newLineup = {
			homePlayerIds: newHomeIds,
			awayPlayerIds: newAwayIds,
			rotatedOut: lineup.rotatedOut,
			coinTossNeeded: lineup.coinTossNeeded,
			selectedHomePlayerIds: newHomeIds,
			selectedAwayPlayerIds: newAwayIds,
		};

		await sessionRepository.updateProposedLineup({
			db,
			sessionId: fullSession.id,
			proposedLineup: newLineup,
		});

		const refreshedSession = await sessionRepository.getActiveSessionFull({
			db,
			seasonId: activeSeason.id,
		});

		if (!refreshedSession) {
			throw new HTTPException(500, { message: "Failed to reload session" });
		}

		return c.json(formatSessionState(refreshedSession, activeSeason.slug));
	})
	.post("/matches", async (c) => {
		const db = c.get("db");
		const userId = c.get("authentication").user.id;
		const leagueData = c.get("leagueData");
		const bodyParsed = createMatchSchema.safeParse(await c.req.json());
		if (!bodyParsed.success) {
			throw new HTTPException(400, { message: "Invalid request body" });
		}
		const { seasonSlug, homePlayerNames, awayPlayerNames, homeScore, awayScore } = bodyParsed.data;

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

		const players = await db
			.select({ id: seasonPlayer.id, name: user.name })
			.from(seasonPlayer)
			.innerJoin(player, eq(seasonPlayer.playerId, player.id))
			.innerJoin(user, eq(player.userId, user.id))
			.where(and(eq(seasonPlayer.seasonId, seasonData.id), eq(seasonPlayer.disabled, false)));

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

		const match = await createMatch({
			db,
			input: {
				seasonId: seasonData.id,
				homeScore,
				awayScore,
				homeTeamPlayerIds,
				awayTeamPlayerIds,
				userId,
			},
		});

		const seasonPlayerIds = [...homeTeamPlayerIds, ...awayTeamPlayerIds];
		await c.env.ACHIEVEMENT_QUEUE.send({
			seasonPlayerIds,
		} satisfies AchievementQueueMessage);

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
	});

const deviceRouter = new Hono<EnforcedAuthHonoEnv>()
	.use("*", async (c, next) => {
		const betterAuth = c.get("betterAuth");
		const apiKey = c.req.header("x-api-key");

		if (!apiKey) {
			throw new HTTPException(401, { message: "Missing API key" });
		}

		let session;
		try {
			session = await betterAuth.api.getSession({
				headers: new Headers({ "x-api-key": apiKey }),
			});
		} catch {
			throw new HTTPException(401, { message: "Invalid API key" });
		}

		if (!session) {
			throw new HTTPException(401, { message: "Invalid API key" });
		}

		c.set("authentication", session as AuthType);

		await next();
	})
	.get("/leagues", async (c) => {
		const db = c.get("db");
		const userId = c.get("authentication").user.id;

		const userLeagues = await db
			.select({
				id: league.id,
				name: league.name,
				slug: league.slug,
				logo: league.logo,
			})
			.from(member)
			.innerJoin(league, eq(member.organizationId, league.id))
			.where(eq(member.userId, userId));

		return c.json({ leagues: userLeagues });
	})
	.route("/leagues/:leagueSlug", leagueRouter);

export { deviceRouter };
