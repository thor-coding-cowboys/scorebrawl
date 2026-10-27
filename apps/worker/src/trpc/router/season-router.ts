import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createOptionalIdSchema } from "@coding-cowboys/scorebrawl-util/id-util";
import * as seasonRepository from "../../repositories/season-repository";
import * as playerRepository from "../../repositories/player-repository";
import * as seasonPlayerRepository from "../../repositories/season-player-repository";
import * as seasonTeamRepository from "../../repositories/season-team-repository";
import * as achievementRepository from "../../repositories/achievement-repository";
import { seasonProcedure, leagueEditorProcedure, leagueProcedure } from "../trpc";

const validateStartBeforeEnd = ({ startDate, endDate }: { startDate?: Date; endDate?: Date }) => {
	if (endDate && startDate && startDate > endDate) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "End date must be after start date",
		});
	}
};

// Schema for optional season ID validation
const seasonIdSchema = createOptionalIdSchema("season");

export const seasonRouter = {
	getBySlug: seasonProcedure.query(({ ctx }) => ({
		id: ctx.season.id,
		slug: ctx.season.slug,
		name: ctx.season.name,
		initialScore: ctx.season.initialScore,
		scoreType: ctx.season.scoreType,
		kFactor: ctx.season.kFactor,
		startDate: ctx.season.startDate,
		endDate: ctx.season.endDate,
		rounds: ctx.season.rounds,
		closed: ctx.season.closed,
		archived: ctx.season.archived,
	})),

	getCountInfo: seasonProcedure.query(async ({ ctx }) => {
		return seasonRepository.getCountInfoById({
			db: ctx.db,
			seasonId: ctx.season.id,
		});
	}),

	findActive: leagueProcedure.query(async ({ ctx }) => {
		return seasonRepository.findActive({
			db: ctx.db,
			leagueId: ctx.organizationId,
		});
	}),

	findAllActive: leagueProcedure.query(async ({ ctx }) => {
		return seasonRepository.findAllActive({
			db: ctx.db,
			leagueId: ctx.organizationId,
		});
	}),

	getAll: leagueProcedure.query(async ({ ctx }) => {
		return seasonRepository.getAll({
			db: ctx.db,
			leagueId: ctx.organizationId,
		});
	}),

	checkSlugAvailability: leagueProcedure
		.input(z.object({ slug: z.string() }))
		.query(async ({ ctx, input }) => {
			try {
				await seasonRepository.getBySlug({
					db: ctx.db,
					seasonSlug: input.slug,
					leagueId: ctx.organizationId,
				});
				return { available: false };
			} catch {
				return { available: true };
			}
		}),

	getSummary: seasonProcedure.query(async ({ ctx }) => {
		const [players, teams, highlights, countInfo] = await Promise.all([
			seasonPlayerRepository.getStanding({ db: ctx.db, seasonId: ctx.season.id }),
			seasonTeamRepository.getStanding({ db: ctx.db, seasonId: ctx.season.id }),
			seasonRepository.getHighlights({ db: ctx.db, seasonId: ctx.season.id }),
			seasonRepository.getCountInfoById({ db: ctx.db, seasonId: ctx.season.id }),
		]);

		const toStat = <T extends { matchCount: number; winCount: number }>(entry: T) => ({
			...entry,
			winRate: entry.matchCount > 0 ? Math.round((entry.winCount / entry.matchCount) * 100) : 0,
		});
		const toPlayerRef = ({ id, playerId, name, image }: (typeof players)[number]) => ({
			id,
			playerId,
			name,
			image,
		});
		const playersById = new Map(players.map((p) => [p.id, p]));
		const resolvePlayers = (ids: string[]) =>
			ids.flatMap((id) => {
				const found = playersById.get(id);
				return found ? [toPlayerRef(found)] : [];
			});
		const resolvePlayer = (id: string) => resolvePlayers([id])[0] ?? null;

		const topScore = players[0]?.score;
		const mostActive = players.reduce<(typeof players)[number] | null>(
			(best, p) => (p.matchCount > (best?.matchCount ?? 0) ? p : best),
			null
		);
		const { longestWinStreak, biggestUpset, biggestGain } = highlights;
		const upsetHomeWon = biggestUpset ? biggestUpset.homeScore > biggestUpset.awayScore : false;
		const streakPlayer = longestWinStreak && resolvePlayer(longestWinStreak.seasonPlayerId);
		const gainPlayer = biggestGain && resolvePlayer(biggestGain.seasonPlayerId);

		return {
			matchCount: countInfo.matchCount,
			playerCount: countInfo.playerCount,
			champions:
				countInfo.matchCount > 0
					? players.filter((p) => p.score === topScore).map(toPlayerRef)
					: [],
			podium: players.slice(0, 3).map(toStat),
			teamPodium: teams
				.filter((t) => t.matchCount > 0)
				.slice(0, 3)
				.map(toStat),
			highlights: {
				longestWinStreak:
					longestWinStreak && streakPlayer
						? { player: streakPlayer, length: longestWinStreak.length }
						: null,
				biggestUpset: biggestUpset
					? {
							winners: resolvePlayers(
								upsetHomeWon ? biggestUpset.homeSeasonPlayerIds : biggestUpset.awaySeasonPlayerIds
							),
							losers: resolvePlayers(
								upsetHomeWon ? biggestUpset.awaySeasonPlayerIds : biggestUpset.homeSeasonPlayerIds
							),
							winnerScore: Math.max(biggestUpset.homeScore, biggestUpset.awayScore),
							loserScore: Math.min(biggestUpset.homeScore, biggestUpset.awayScore),
							winnerOdds: biggestUpset.winnerOdds,
						}
					: null,
				biggestGain:
					biggestGain && gainPlayer ? { player: gainPlayer, gain: biggestGain.gain } : null,
				mostMatches:
					mostActive && mostActive.matchCount > 0
						? { player: toPlayerRef(mostActive), matchCount: mostActive.matchCount }
						: null,
			},
		};
	}),

	getFixtures: seasonProcedure.query(async ({ ctx }) => {
		return seasonRepository.findFixtures({
			db: ctx.db,
			seasonId: ctx.season.id,
		});
	}),

	create: leagueEditorProcedure
		.input(
			z.object({
				id: seasonIdSchema,
				name: z.string().min(1).max(100),
				slug: z
					.string()
					.min(1)
					.max(100)
					.regex(/^[a-z0-9-]+$/, "Slug must only contain lowercase letters, numbers, and hyphens")
					.optional(),
				initialScore: z.number().int(),
				scoreType: z.enum(["elo", "3-1-0", "1-v-n-elo"]),
				kFactor: z.number().int(),
				startDate: z.date(),
				endDate: z.date().optional(),
				rounds: z.number().int().optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			validateStartBeforeEnd(input);

			if (input.scoreType === "1-v-n-elo" && input.rounds) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "1-v-n-elo seasons do not use rounds",
				});
			}

			// If an ID is provided, verify it doesn't already exist
			if (input.id) {
				try {
					await seasonRepository.getById({
						db: ctx.db,
						seasonId: input.id,
					});
					// If we get here, the season exists
					throw new TRPCError({
						code: "CONFLICT",
						message: "A season with this ID already exists",
					});
				} catch (error) {
					// If it's our conflict error, rethrow it
					if (error instanceof TRPCError) throw error;
					// Otherwise, the season doesn't exist (expected), continue
				}
			}

			// Check if at least 2 players exist
			const players = await playerRepository.getAll({
				db: ctx.db,
				leagueId: ctx.organizationId,
			});

			if (players.length < 2) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "League must have at least 2 players to create a season",
				});
			}

			return seasonRepository.create({
				db: ctx.db,
				id: input.id,
				...input,
				leagueId: ctx.organizationId,
				userId: ctx.authentication.user.id,
			});
		}),

	edit: leagueEditorProcedure
		.input(
			z.object({
				seasonSlug: z.string(),
				name: z.string().min(1).max(100).optional(),
				slug: z
					.string()
					.min(1)
					.max(100)
					.regex(/^[a-z0-9-]+$/, "Slug must only contain lowercase letters, numbers, and hyphens")
					.optional(),
				startDate: z.date().optional(),
				endDate: z.date().optional(),
				initialScore: z.number().int().optional(),
				kFactor: z.number().int().optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			validateStartBeforeEnd(input);

			// Get season to verify it exists
			const comp = await seasonRepository.getBySlug({
				db: ctx.db,
				seasonSlug: input.seasonSlug,
				leagueId: ctx.organizationId,
			});

			// Check if season has matches registered
			const countInfo = await seasonRepository.getCountInfoById({
				db: ctx.db,
				seasonId: comp.id,
			});

			if (countInfo.matchCount > 0) {
				const restrictedFields = [
					input.startDate,
					input.endDate,
					input.initialScore,
					input.kFactor,
				].some((f) => f !== undefined);

				if (restrictedFields) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "Can only update name, slug, and dates of a season with registered matches",
					});
				}
			}

			return seasonRepository.update({
				db: ctx.db,
				userId: ctx.authentication.user.id,
				seasonId: comp.id,
				...input,
			});
		}),

	updateClosedStatus: leagueEditorProcedure
		.input(
			z.object({
				seasonSlug: z.string(),
				closed: z.boolean(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const comp = await seasonRepository.getBySlug({
				db: ctx.db,
				seasonSlug: input.seasonSlug,
				leagueId: ctx.organizationId,
			});

			const updated = await seasonRepository.updateClosedStatus({
				db: ctx.db,
				seasonId: comp.id,
				userId: ctx.authentication.user.id,
				closed: input.closed,
			});

			if (input.closed) {
				await achievementRepository.awardSeasonWinner({
					db: ctx.db,
					seasonId: comp.id,
				});
			}

			return updated;
		}),
} satisfies TRPCRouterRecord;
