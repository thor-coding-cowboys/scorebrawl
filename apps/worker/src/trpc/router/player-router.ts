import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import { z } from "zod";
import * as seasonPlayerRepository from "../../repositories/season-player-repository";
import * as seasonRepository from "../../repositories/season-repository";
import * as playerRepository from "../../repositories/player-repository";
import { withTransaction } from "../../db";
import { user } from "../../db/schema/auth-schema";
import { guest, player, season, seasonPlayer } from "../../db/schema/league-schema";
import { createId } from "../../utils/id-util";
import {
	seasonProcedure,
	leagueProcedure,
	leagueEditorProcedure,
	activeOrgProcedure,
} from "../trpc";

const checkSeasonSupportsPlayerProfiles = async ({
	db,
	leagueId,
}: {
	db: Parameters<typeof seasonRepository.findActive>[0]["db"];
	leagueId: string;
}) => {
	const activeSeason = await seasonRepository.findActive({
		db,
		leagueId,
	});

	if (!activeSeason) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "No active season found",
		});
	}

	if (activeSeason.scoreType === "3-1-0") {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Player profiles are not available for 3-1-0 seasons",
		});
	}

	return activeSeason;
};

export const playerRouter = {
	getMyPlayer: activeOrgProcedure.query(async ({ ctx }) => {
		const userId = ctx.authentication.user.id;
		return playerRepository.getByUserId({
			db: ctx.db,
			userId,
			leagueId: ctx.organizationId,
		});
	}),

	getAll: leagueProcedure.query(async ({ ctx }) => {
		return playerRepository.getAll({
			db: ctx.db,
			leagueId: ctx.organizationId,
		});
	}),

	getById: seasonProcedure
		.input(z.object({ seasonSlug: z.string(), playerId: z.string() }))
		.query(async ({ input, ctx }) => {
			await checkSeasonSupportsPlayerProfiles({
				db: ctx.db,
				leagueId: ctx.organizationId,
			});

			const player = await playerRepository.getById({
				db: ctx.db,
				playerId: input.playerId,
				leagueId: ctx.organizationId,
			});

			if (!player) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Player not found",
				});
			}

			return player;
		}),

	getEloProgression: seasonProcedure
		.input(z.object({ seasonSlug: z.string(), playerId: z.string() }))
		.query(async ({ input, ctx }) => {
			await checkSeasonSupportsPlayerProfiles({
				db: ctx.db,
				leagueId: ctx.organizationId,
			});

			// Get season player ID from player ID
			const seasonPlayers = await seasonPlayerRepository.findAll({
				db: ctx.db,
				seasonId: ctx.season.id,
			});

			const cp = seasonPlayers.find((p) => p.playerId === input.playerId);
			if (!cp) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Player not in season",
				});
			}

			return playerRepository.getPlayerEloProgression({
				db: ctx.db,
				seasonPlayerId: cp.id,
			});
		}),

	getRecentMatches: seasonProcedure
		.input(z.object({ seasonSlug: z.string(), playerId: z.string() }))
		.query(async ({ input, ctx }) => {
			await checkSeasonSupportsPlayerProfiles({
				db: ctx.db,
				leagueId: ctx.organizationId,
			});

			const seasonPlayers = await seasonPlayerRepository.findAll({
				db: ctx.db,
				seasonId: ctx.season.id,
			});

			const cp = seasonPlayers.find((p) => p.playerId === input.playerId);
			if (!cp) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Player not in season",
				});
			}

			return playerRepository.getRecentMatches({
				db: ctx.db,
				seasonPlayerId: cp.id,
				limit: 10,
			});
		}),

	getPlayerStats: seasonProcedure
		.input(z.object({ seasonSlug: z.string(), playerId: z.string() }))
		.query(async ({ input, ctx }) => {
			await checkSeasonSupportsPlayerProfiles({
				db: ctx.db,
				leagueId: ctx.organizationId,
			});

			const seasonPlayers = await seasonPlayerRepository.findAll({
				db: ctx.db,
				seasonId: ctx.season.id,
			});

			const cp = seasonPlayers.find((p) => p.playerId === input.playerId);
			if (!cp) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Player not in season",
				});
			}

			return playerRepository.getPlayerStats({
				db: ctx.db,
				seasonPlayerId: cp.id,
			});
		}),

	// New endpoints for player profile
	getBestSeason: leagueProcedure
		.input(z.object({ playerId: z.string() }))
		.query(async ({ input, ctx }) => {
			const player = await playerRepository.getById({
				db: ctx.db,
				playerId: input.playerId,
				leagueId: ctx.organizationId,
			});

			if (!player) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Player not found",
				});
			}

			return playerRepository.getBestSeason({
				db: ctx.db,
				playerId: input.playerId,
			});
		}),

	getBestTeammate: leagueProcedure
		.input(z.object({ playerId: z.string() }))
		.query(async ({ input, ctx }) => {
			const player = await playerRepository.getById({
				db: ctx.db,
				playerId: input.playerId,
				leagueId: ctx.organizationId,
			});

			if (!player) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Player not found",
				});
			}

			const analysis = await playerRepository.getTeammateAnalysis({
				db: ctx.db,
				playerId: input.playerId,
			});

			return analysis.bestTeammate;
		}),

	getWorstTeammate: leagueProcedure
		.input(z.object({ playerId: z.string() }))
		.query(async ({ input, ctx }) => {
			const player = await playerRepository.getById({
				db: ctx.db,
				playerId: input.playerId,
				leagueId: ctx.organizationId,
			});

			if (!player) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Player not found",
				});
			}

			const analysis = await playerRepository.getTeammateAnalysis({
				db: ctx.db,
				playerId: input.playerId,
			});

			return analysis.worstTeammate;
		}),

	getAllTimeStats: leagueProcedure
		.input(z.object({ playerId: z.string() }))
		.query(async ({ input, ctx }) => {
			const player = await playerRepository.getById({
				db: ctx.db,
				playerId: input.playerId,
				leagueId: ctx.organizationId,
			});

			if (!player) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Player not found",
				});
			}

			return playerRepository.getAllTimeStats({
				db: ctx.db,
				playerId: input.playerId,
			});
		}),

	getSeasonHistory: leagueProcedure
		.input(z.object({ playerId: z.string() }))
		.query(async ({ input, ctx }) => {
			const player = await playerRepository.getById({
				db: ctx.db,
				playerId: input.playerId,
				leagueId: ctx.organizationId,
			});

			if (!player) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Player not found",
				});
			}

			return playerRepository.getSeasonHistory({
				db: ctx.db,
				playerId: input.playerId,
			});
		}),

	getRecentMatchesWithTeams: seasonProcedure
		.input(z.object({ seasonSlug: z.string(), playerId: z.string() }))
		.query(async ({ input, ctx }) => {
			await checkSeasonSupportsPlayerProfiles({
				db: ctx.db,
				leagueId: ctx.organizationId,
			});

			const seasonPlayers = await seasonPlayerRepository.findAll({
				db: ctx.db,
				seasonId: ctx.season.id,
			});

			const cp = seasonPlayers.find((p) => p.playerId === input.playerId);
			if (!cp) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Player not in season",
				});
			}

			return playerRepository.getRecentMatchesWithTeams({
				db: ctx.db,
				seasonPlayerId: cp.id,
				limit: 10,
			});
		}),

	setDisabled: leagueEditorProcedure
		.input(z.object({ playerId: z.string(), disabled: z.boolean() }))
		.mutation(async ({ input, ctx }) => {
			const p = await playerRepository.getById({
				db: ctx.db,
				playerId: input.playerId,
				leagueId: ctx.organizationId,
			});

			if (!p) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Player not found",
				});
			}

			return playerRepository.setDisabled({
				db: ctx.db,
				playerId: input.playerId,
				leagueId: ctx.organizationId,
				disabled: input.disabled,
			});
		}),

	createGuestPlayer: leagueEditorProcedure
		.input(
			z.object({
				email: z.string().email().toLowerCase(),
				displayName: z.string().min(1).max(100),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const leagueId = ctx.organizationId;

			// Reject if a registered user with this email exists
			const [existingUser] = await ctx.db
				.select({ id: user.id })
				.from(user)
				.where(eq(user.email, input.email))
				.limit(1);

			if (existingUser) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "User with this email already exists. Invite them to the league instead.",
				});
			}

			// Check if guest player already exists in this league
			const existingGuestPlayer = await ctx.db
				.select({ id: player.id })
				.from(player)
				.innerJoin(guest, eq(player.guestId, guest.id))
				.where(and(eq(player.leagueId, leagueId), eq(guest.email, input.email)))
				.limit(1);

			if (existingGuestPlayer.length > 0) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Guest player with this email already exists in this league",
				});
			}

			return withTransaction(ctx.db, async (tx) => {
				const now = new Date();

				// Create or reuse guest, create player, add to seasons
				const [existingGuest] = await tx
					.select()
					.from(guest)
					.where(eq(guest.email, input.email))
					.limit(1);

				let guestId: string;
				if (existingGuest) {
					guestId = existingGuest.id;
					if (existingGuest.displayName !== input.displayName) {
						await tx
							.update(guest)
							.set({ displayName: input.displayName, updatedAt: now })
							.where(eq(guest.id, existingGuest.id));
					}
				} else {
					guestId = createId();
					await tx.insert(guest).values({
						id: guestId,
						email: input.email,
						displayName: input.displayName,
						createdAt: now,
						updatedAt: now,
					});
				}

				const playerId = createId();
				await tx.insert(player).values({
					id: playerId,
					userId: null,
					guestId,
					leagueId,
					disabled: false,
					createdAt: now,
					updatedAt: now,
				});

				// Auto-add to ongoing/future seasons
				const ongoingSeasons = await tx
					.select({ id: season.id, initialScore: season.initialScore })
					.from(season)
					.where(
						and(eq(season.leagueId, leagueId), or(gt(season.endDate, now), isNull(season.endDate)))
					);

				if (ongoingSeasons.length > 0) {
					await tx.insert(seasonPlayer).values(
						ongoingSeasons.map((s) => ({
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

				return { playerId, guestId };
			});
		}),

	comparePlayers: leagueProcedure
		.input(z.object({ player1Id: z.string(), player2Id: z.string() }))
		.query(async ({ input, ctx }) => {
			// Verify both players exist in this league
			const [player1, player2] = await Promise.all([
				playerRepository.getById({
					db: ctx.db,
					playerId: input.player1Id,
					leagueId: ctx.organizationId,
				}),
				playerRepository.getById({
					db: ctx.db,
					playerId: input.player2Id,
					leagueId: ctx.organizationId,
				}),
			]);

			if (!player1 || !player2) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "One or both players not found in this league",
				});
			}

			// Get comparison stats for both players
			const [stats1, stats2, headToHead] = await Promise.all([
				playerRepository.getPlayerComparisonStats({
					db: ctx.db,
					playerId: input.player1Id,
				}),
				playerRepository.getPlayerComparisonStats({
					db: ctx.db,
					playerId: input.player2Id,
				}),
				playerRepository.getHeadToHeadStats({
					db: ctx.db,
					player1Id: input.player1Id,
					player2Id: input.player2Id,
				}),
			]);

			return {
				player1: stats1,
				player2: stats2,
				headToHead,
			};
		}),

	editGuestPlayer: leagueEditorProcedure
		.input(
			z.object({
				playerId: z.string(),
				email: z.string().email().toLowerCase(),
				displayName: z.string().min(1).max(100),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const leagueId = ctx.organizationId;
			const now = new Date();

			// Get the player and verify it's a guest player in this league
			const [existingPlayer] = await ctx.db
				.select({
					playerId: player.id,
					guestId: player.guestId,
					userId: player.userId,
					currentEmail: guest.email,
					currentDisplayName: guest.displayName,
				})
				.from(player)
				.leftJoin(guest, eq(player.guestId, guest.id))
				.where(and(eq(player.id, input.playerId), eq(player.leagueId, leagueId)))
				.limit(1);

			if (!existingPlayer) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Player not found in this league",
				});
			}

			if (!existingPlayer.guestId || existingPlayer.userId) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Only guest players can be edited",
				});
			}

			// Check if email changed and if so, verify no conflicts
			const emailChanged = existingPlayer.currentEmail !== input.email;
			if (emailChanged) {
				// Check if a registered user with new email exists
				const [existingUser] = await ctx.db
					.select({ id: user.id })
					.from(user)
					.where(eq(user.email, input.email))
					.limit(1);

				if (existingUser) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "User with this email already exists. Invite them to the league instead.",
					});
				}

				// Check if another guest player with new email exists in this league
				const existingGuestPlayer = await ctx.db
					.select({ id: player.id })
					.from(player)
					.innerJoin(guest, eq(player.guestId, guest.id))
					.where(and(eq(player.leagueId, leagueId), eq(guest.email, input.email)))
					.limit(1);

				if (existingGuestPlayer.length > 0) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "Guest player with this email already exists in this league",
					});
				}
			}

			// Create new guest with new data
			const newGuestId = createId();
			await ctx.db.insert(guest).values({
				id: newGuestId,
				email: input.email,
				displayName: input.displayName,
				createdAt: now,
				updatedAt: now,
			});

			// Update player to reference new guest
			await ctx.db
				.update(player)
				.set({ guestId: newGuestId, updatedAt: now })
				.where(eq(player.id, input.playerId));

			// Check if old guest is referenced by any other players
			const otherPlayersWithOldGuest = await ctx.db
				.select({ id: player.id })
				.from(player)
				.where(eq(player.guestId, existingPlayer.guestId))
				.limit(1);

			// If no other players reference the old guest, delete it
			if (otherPlayersWithOldGuest.length === 0) {
				await ctx.db.delete(guest).where(eq(guest.id, existingPlayer.guestId));
			}

			return { playerId: input.playerId, guestId: newGuestId };
		}),
} satisfies TRPCRouterRecord;
