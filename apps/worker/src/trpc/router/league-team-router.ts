import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { and, count, eq, gt } from "drizzle-orm";
import { z } from "zod";
import { user } from "../../db/schema/auth-schema";
import { leagueTeam, leagueTeamPlayer, player } from "../../db/schema/league-schema";
import {
	generateTeamLogoKey,
	getExtensionFromContentType,
	isValidImageType,
	MAX_AVATAR_SIZE,
} from "../../lib/asset-util";
import { activeOrgProcedure, leagueProcedure, type LeagueContext } from "../trpc";
import * as teamRepository from "../../repositories/team-repository";

/**
 * Base64 regex pattern - validates base64 data URL format
 * Matches: data:image/{type};base64,{data}
 */
const BASE64_IMAGE_REGEX = /^data:image\/(jpeg|png|webp);base64,/;

export const leagueTeamRouter = {
	list: activeOrgProcedure
		.input(
			z.object({
				cursor: z.string().optional(),
				limit: z.number().min(1).max(100).default(50),
			})
		)
		.query(async ({ ctx: { db, organizationId }, input }) => {
			const { cursor, limit } = input;

			const whereCondition = cursor
				? and(eq(leagueTeam.leagueId, organizationId), gt(leagueTeam.id, cursor))
				: eq(leagueTeam.leagueId, organizationId);

			const [teams, [totalCountResult]] = await Promise.all([
				db
					.select({
						id: leagueTeam.id,
						name: leagueTeam.name,
						logo: leagueTeam.logo,
						createdAt: leagueTeam.createdAt,
						updatedAt: leagueTeam.updatedAt,
					})
					.from(leagueTeam)
					.where(whereCondition)
					.orderBy(leagueTeam.name)
					.limit(limit + 1),
				db
					.select({ count: count() })
					.from(leagueTeam)
					.where(eq(leagueTeam.leagueId, organizationId)),
			]);

			// Fetch players for each team
			const teamsWithPlayers = await Promise.all(
				teams.map(async (team) => {
					const players = await db
						.select({
							id: player.id,
							userId: player.userId,
							name: user.name,
						})
						.from(leagueTeamPlayer)
						.innerJoin(player, eq(leagueTeamPlayer.playerId, player.id))
						.innerJoin(user, eq(player.userId, user.id))
						.where(eq(leagueTeamPlayer.leagueTeamId, team.id));

					return {
						...team,
						players,
					};
				})
			);

			let nextCursor: string | null = null;
			if (teams.length > limit) {
				const nextItem = teams.pop();
				nextCursor = nextItem?.id ?? null;
			}

			return {
				teams: teamsWithPlayers,
				totalCount: totalCountResult?.count ?? 0,
				nextCursor,
			};
		}),

	edit: leagueProcedure
		.input(
			z.object({
				teamId: z.string(),
				name: z.string().min(1).max(100),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const typedCtx = ctx as unknown as LeagueContext;
			const { db, organizationId, role } = typedCtx;
			const { teamId, name } = input;
			const userId = typedCtx.authentication.user.id;

			// Verify team exists in this league
			const [existingTeam] = await db
				.select({
					id: leagueTeam.id,
					name: leagueTeam.name,
				})
				.from(leagueTeam)
				.where(and(eq(leagueTeam.id, teamId), eq(leagueTeam.leagueId, organizationId)))
				.limit(1);

			if (!existingTeam) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Team not found",
				});
			}

			// Check permissions
			const isEditor = role === "owner" || role === "admin" || role === "editor";

			if (!isEditor) {
				// Member must be part of the team to edit it
				// First, get the player's ID for this user in this league
				const [playerRecord] = await db
					.select({ id: player.id })
					.from(player)
					.where(and(eq(player.leagueId, organizationId), eq(player.userId, userId)))
					.limit(1);

				if (!playerRecord) {
					throw new TRPCError({
						code: "FORBIDDEN",
						message: "You are not authorized to update this team",
					});
				}

				// Check if player is part of this team
				const [teamMembership] = await db
					.select({ id: leagueTeamPlayer.id })
					.from(leagueTeamPlayer)
					.where(
						and(
							eq(leagueTeamPlayer.leagueTeamId, teamId),
							eq(leagueTeamPlayer.playerId, playerRecord.id)
						)
					)
					.limit(1);

				if (!teamMembership) {
					throw new TRPCError({
						code: "FORBIDDEN",
						message: "You can only edit teams you are a member of",
					});
				}
			}

			// Update the team
			const [updatedTeam] = await db
				.update(leagueTeam)
				.set({
					name,
					updatedAt: new Date(),
				})
				.where(and(eq(leagueTeam.id, teamId), eq(leagueTeam.leagueId, organizationId)))
				.returning({
					id: leagueTeam.id,
					name: leagueTeam.name,
					createdAt: leagueTeam.createdAt,
					updatedAt: leagueTeam.updatedAt,
				});

			return { team: updatedTeam };
		}),

	uploadLogo: leagueProcedure
		.input(
			z.object({
				teamId: z.string(),
				imageData: z
					.string()
					.regex(
						BASE64_IMAGE_REGEX,
						"Invalid image data format. Expected base64 data URL (data:image/jpeg;base64,... or data:image/png;base64,...)"
					),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const typedCtx = ctx as unknown as LeagueContext;
			const { db, organizationId, role, userAssets } = typedCtx;
			const { teamId, imageData } = input;
			const userId = typedCtx.authentication.user.id;

			// Verify team exists in this league
			const [existingTeam] = await db
				.select({
					id: leagueTeam.id,
					name: leagueTeam.name,
					logo: leagueTeam.logo,
				})
				.from(leagueTeam)
				.where(and(eq(leagueTeam.id, teamId), eq(leagueTeam.leagueId, organizationId)))
				.limit(1);

			if (!existingTeam) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Team not found",
				});
			}

			// Check permissions
			const isEditor = role === "owner" || role === "admin" || role === "editor";

			if (!isEditor) {
				// Member must be part of the team to edit it
				const [playerRecord] = await db
					.select({ id: player.id })
					.from(player)
					.where(and(eq(player.leagueId, organizationId), eq(player.userId, userId)))
					.limit(1);

				if (!playerRecord) {
					throw new TRPCError({
						code: "FORBIDDEN",
						message: "You are not authorized to update this team",
					});
				}

				// Check if player is part of this team
				const [teamMembership] = await db
					.select({ id: leagueTeamPlayer.id })
					.from(leagueTeamPlayer)
					.where(
						and(
							eq(leagueTeamPlayer.leagueTeamId, teamId),
							eq(leagueTeamPlayer.playerId, playerRecord.id)
						)
					)
					.limit(1);

				if (!teamMembership) {
					throw new TRPCError({
						code: "FORBIDDEN",
						message: "You can only edit teams you are a member of",
					});
				}
			}

			// Extract content type from base64 data URL
			const contentTypeMatch = imageData.match(/^data:(image\/\w+);base64,/);
			if (!contentTypeMatch) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Could not extract content type from image data",
				});
			}

			const contentType = contentTypeMatch[1];

			// Validate content type
			if (!isValidImageType(contentType)) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Invalid image type. Allowed: image/jpeg, image/png, image/webp",
				});
			}

			// Extract base64 data
			const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "");

			// Decode base64 to binary
			let binaryData: Uint8Array;
			try {
				const binaryString = atob(base64Data);
				binaryData = new Uint8Array(binaryString.length);
				for (let i = 0; i < binaryString.length; i++) {
					binaryData[i] = binaryString.charCodeAt(i);
				}
			} catch {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Invalid base64 image data",
				});
			}

			// Check file size
			const approximateSize = (base64Data.length * 3) / 4;
			if (approximateSize > MAX_AVATAR_SIZE) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: `Image too large. Maximum size is ${MAX_AVATAR_SIZE / 1024 / 1024}MB`,
				});
			}

			// Generate key and upload to R2
			const extension = getExtensionFromContentType(contentType);
			const key = generateTeamLogoKey(organizationId, teamId, extension);

			// Upload to R2 bucket
			const bucket = userAssets.bucket;
			await bucket.put(key, binaryData, {
				httpMetadata: {
					contentType,
				},
			});

			// Delete old logo if exists
			if (existingTeam.logo) {
				const oldKey = existingTeam.logo;
				// Only delete if it starts with organization's path (safety check)
				if (oldKey.startsWith(`organization/${organizationId}/`)) {
					try {
						await bucket.delete(oldKey);
					} catch {
						// Ignore deletion errors - file might not exist
					}
				}
			}

			// Update team's logo field in database
			await db
				.update(leagueTeam)
				.set({ logo: key })
				.where(and(eq(leagueTeam.id, teamId), eq(leagueTeam.leagueId, organizationId)));

			return {
				success: true,
				key,
			};
		}),

	deleteLogo: leagueProcedure
		.input(z.object({ teamId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const typedCtx = ctx as unknown as LeagueContext;
			const { db, organizationId, role, userAssets } = typedCtx;
			const { teamId } = input;
			const userId = typedCtx.authentication.user.id;

			// Verify team exists in this league
			const [existingTeam] = await db
				.select({
					id: leagueTeam.id,
					logo: leagueTeam.logo,
				})
				.from(leagueTeam)
				.where(and(eq(leagueTeam.id, teamId), eq(leagueTeam.leagueId, organizationId)))
				.limit(1);

			if (!existingTeam) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Team not found",
				});
			}

			// Check permissions
			const isEditor = role === "owner" || role === "admin" || role === "editor";

			if (!isEditor) {
				// Member must be part of the team to edit it
				const [playerRecord] = await db
					.select({ id: player.id })
					.from(player)
					.where(and(eq(player.leagueId, organizationId), eq(player.userId, userId)))
					.limit(1);

				if (!playerRecord) {
					throw new TRPCError({
						code: "FORBIDDEN",
						message: "You are not authorized to update this team",
					});
				}

				// Check if player is part of this team
				const [teamMembership] = await db
					.select({ id: leagueTeamPlayer.id })
					.from(leagueTeamPlayer)
					.where(
						and(
							eq(leagueTeamPlayer.leagueTeamId, teamId),
							eq(leagueTeamPlayer.playerId, playerRecord.id)
						)
					)
					.limit(1);

				if (!teamMembership) {
					throw new TRPCError({
						code: "FORBIDDEN",
						message: "You can only edit teams you are a member of",
					});
				}
			}

			// Delete logo from R2 if exists
			if (existingTeam.logo) {
				const key = existingTeam.logo;
				// Verify the key belongs to this organization before deleting
				if (key.startsWith(`organization/${organizationId}/`)) {
					const bucket = userAssets.bucket;
					try {
						await bucket.delete(key);
					} catch {
						// Ignore deletion errors - file might not exist
					}
				}
			}

			// Clear the logo field in database
			await db
				.update(leagueTeam)
				.set({ logo: null })
				.where(and(eq(leagueTeam.id, teamId), eq(leagueTeam.leagueId, organizationId)));

			return { success: true };
		}),

	// Team profile endpoints
	getById: leagueProcedure.input(z.object({ teamId: z.string() })).query(async ({ input, ctx }) => {
		const team = await teamRepository.getById({
			db: ctx.db,
			teamId: input.teamId,
			organizationId: ctx.organizationId,
		});

		if (!team) {
			throw new TRPCError({
				code: "NOT_FOUND",
				message: "Team not found",
			});
		}

		return team;
	}),

	getPlayers: leagueProcedure
		.input(z.object({ teamId: z.string() }))
		.query(async ({ input, ctx }) => {
			// First verify team belongs to this organization
			const team = await teamRepository.getById({
				db: ctx.db,
				teamId: input.teamId,
				organizationId: ctx.organizationId,
			});

			if (!team) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Team not found",
				});
			}

			return teamRepository.getTeamPlayersWithDetails({
				db: ctx.db,
				teamId: input.teamId,
			});
		}),

	getAllTimeStats: leagueProcedure
		.input(z.object({ teamId: z.string() }))
		.query(async ({ input, ctx }) => {
			const team = await teamRepository.getById({
				db: ctx.db,
				teamId: input.teamId,
				organizationId: ctx.organizationId,
			});

			if (!team) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Team not found",
				});
			}

			return teamRepository.getAllTimeStats({
				db: ctx.db,
				teamId: input.teamId,
			});
		}),

	getBestSeason: leagueProcedure
		.input(z.object({ teamId: z.string() }))
		.query(async ({ input, ctx }) => {
			const team = await teamRepository.getById({
				db: ctx.db,
				teamId: input.teamId,
				organizationId: ctx.organizationId,
			});

			if (!team) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Team not found",
				});
			}

			return teamRepository.getBestSeason({
				db: ctx.db,
				teamId: input.teamId,
			});
		}),

	getSeasonHistory: leagueProcedure
		.input(z.object({ teamId: z.string() }))
		.query(async ({ input, ctx }) => {
			const team = await teamRepository.getById({
				db: ctx.db,
				teamId: input.teamId,
				organizationId: ctx.organizationId,
			});

			if (!team) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Team not found",
				});
			}

			return teamRepository.getSeasonHistory({
				db: ctx.db,
				teamId: input.teamId,
			});
		}),

	getRecentMatches: leagueProcedure
		.input(z.object({ teamId: z.string(), limit: z.number().default(10) }))
		.query(async ({ input, ctx }) => {
			const team = await teamRepository.getById({
				db: ctx.db,
				teamId: input.teamId,
				organizationId: ctx.organizationId,
			});

			if (!team) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Team not found",
				});
			}

			return teamRepository.getRecentMatches({
				db: ctx.db,
				teamId: input.teamId,
				limit: input.limit,
			});
		}),

	getRivalTeams: leagueProcedure
		.input(z.object({ teamId: z.string() }))
		.query(async ({ input, ctx }) => {
			const team = await teamRepository.getById({
				db: ctx.db,
				teamId: input.teamId,
				organizationId: ctx.organizationId,
			});

			if (!team) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Team not found",
				});
			}

			return teamRepository.getRivalTeams({
				db: ctx.db,
				teamId: input.teamId,
			});
		}),
} satisfies TRPCRouterRecord;
