import { TRPCError } from "@trpc/server";
import type { DrizzleDB } from "../db";
import * as seasonRepository from "../repositories/season-repository";
import * as matchRepository from "../repositories/match-repository";
import * as seasonPlayerRepository from "../repositories/season-player-repository";
import { broadcastSeasonEvent } from "../routes/sse-router";
import type { AchievementQueueMessage } from "../services/achievement-calculation";
import { buildMatchInsertData, type SeasonScoreType } from "../services/match-events";

export interface MatchCreationContext {
	db: DrizzleDB;
	env: Pick<Env, "SEASON_SSE" | "ACHIEVEMENT_QUEUE">;
	waitUntil: (promise: Promise<unknown>) => void;
	organization: { slug: string };
	user: { id: string; name: string };
}

type StreakBroadcastEvent = {
	type: "streak";
	data: {
		playerId: string;
		playerName: string;
		playerImage: string | null;
		streak: number;
		timestamp: number;
		isTeam?: boolean;
	};
	user: { id: string; name: string };
};

function buildStreakBroadcastEvents(
	streakPlayers: Array<{
		playerId: string;
		playerName: string;
		playerImage: string | null;
		streak: number;
	}>,
	streakTeams: Array<{
		seasonTeamId: string;
		teamName: string;
		teamLogo: string | null;
		streak: number;
	}>,
	user: { id: string; name: string }
): StreakBroadcastEvent[] {
	const events: StreakBroadcastEvent[] = [];
	const timestamp = Date.now();

	for (const player of streakPlayers) {
		events.push({
			type: "streak",
			data: {
				playerId: player.playerId,
				playerName: player.playerName,
				playerImage: player.playerImage,
				streak: player.streak,
				timestamp,
			},
			user,
		});
	}

	for (const team of streakTeams) {
		events.push({
			type: "streak",
			data: {
				playerId: team.seasonTeamId,
				playerName: team.teamName,
				playerImage: team.teamLogo,
				streak: team.streak,
				timestamp,
				isTeam: true,
			},
			user,
		});
	}

	return events;
}

function broadcastStreakEvents(
	waitUntil: (promise: Promise<unknown>) => void,
	env: Pick<Env, "SEASON_SSE">,
	leagueSlug: string,
	seasonSlug: string,
	streakPlayers: Array<{
		playerId: string;
		playerName: string;
		playerImage: string | null;
		streak: number;
	}>,
	streakTeams: Array<{
		seasonTeamId: string;
		teamName: string;
		teamLogo: string | null;
		streak: number;
	}>,
	user: { id: string; name: string }
) {
	const events = buildStreakBroadcastEvents(streakPlayers, streakTeams, user);
	waitUntil(
		Promise.all(events.map((event) => broadcastSeasonEvent(env, leagueSlug, seasonSlug, event)))
	);
}

export async function finalizeMatchCreation({
	ctx,
	seasonSlug,
	seasonId,
	createdMatch,
	seasonPlayerIds,
	scoreType,
}: {
	ctx: MatchCreationContext;
	seasonSlug: string;
	seasonId: string;
	createdMatch: {
		id: string;
		seasonId: string;
		homeScore: number;
		awayScore: number;
		createdAt: Date;
	};
	seasonPlayerIds: string[];
	scoreType: SeasonScoreType;
}) {
	const standings = await seasonPlayerRepository.getStanding({
		db: ctx.db,
		seasonId,
	});

	const data = await buildMatchInsertData(ctx.db, {
		match: createdMatch,
		scoreType,
		standings,
	});

	ctx.waitUntil(
		broadcastSeasonEvent(ctx.env, ctx.organization.slug, seasonSlug, {
			type: "match:insert",
			data,
			user: {
				id: ctx.user.id,
				name: ctx.user.name,
			},
		})
	);

	const [streakPlayers, streakTeams] = await Promise.all([
		matchRepository.checkStreakThresholds({
			db: ctx.db,
			seasonPlayerIds,
		}),
		matchRepository.checkTeamStreakThresholds({
			db: ctx.db,
			matchId: createdMatch.id,
		}),
	]);

	broadcastStreakEvents(
		ctx.waitUntil.bind(ctx),
		ctx.env,
		ctx.organization.slug,
		seasonSlug,
		streakPlayers,
		streakTeams,
		{
			id: ctx.user.id,
			name: ctx.user.name,
		}
	);

	await ctx.env.ACHIEVEMENT_QUEUE.send({
		seasonPlayerIds,
		leagueSlug: ctx.organization.slug,
		seasonSlug,
	} satisfies AchievementQueueMessage);

	return createdMatch;
}

export async function createOneVnMatch({
	ctx,
	seasonSlug,
	id,
	winnerId,
	loserIds,
}: {
	ctx: MatchCreationContext;
	seasonSlug: string;
	id?: string;
	winnerId: string;
	loserIds: string[];
}) {
	const comp = await seasonRepository.getBySlug({
		db: ctx.db,
		seasonSlug,
	});

	if (comp.closed) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "This season is closed",
		});
	}

	if (comp.scoreType !== "1-v-n-elo") {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "1-v-n games can only be recorded in 1-v-n-elo seasons",
		});
	}

	const allIds = [winnerId, ...loserIds];
	if (allIds.length < 2) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "A 1-v-n game needs at least 2 players",
		});
	}

	if (loserIds.includes(winnerId)) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Winner cannot also be a loser",
		});
	}

	if (new Set(allIds).size !== allIds.length) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Duplicate players in game",
		});
	}

	const seasonPlayers = await seasonPlayerRepository.findAll({
		db: ctx.db,
		seasonId: comp.id,
	});
	const validIds = new Set(seasonPlayers.map((p) => p.id));
	if (!allIds.every((id) => validIds.has(id))) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "All players must be in this season",
		});
	}

	if (id) {
		const existing = await matchRepository.findById({
			db: ctx.db,
			matchId: id,
			seasonId: comp.id,
		});
		if (existing) {
			throw new TRPCError({
				code: "CONFLICT",
				message: "A match with this ID already exists",
			});
		}
	}

	const createdMatch = await matchRepository.create({
		db: ctx.db,
		input: {
			id,
			seasonId: comp.id,
			homeScore: 1,
			awayScore: loserIds.length,
			homeTeamPlayerIds: [winnerId],
			awayTeamPlayerIds: loserIds,
			userId: ctx.user.id,
		},
	});

	return finalizeMatchCreation({
		ctx,
		seasonSlug,
		seasonId: comp.id,
		createdMatch,
		seasonPlayerIds: allIds,
		scoreType: comp.scoreType,
	});
}
