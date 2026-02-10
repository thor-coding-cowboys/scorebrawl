import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { count, eq } from "drizzle-orm";
import { z } from "zod";
import { user } from "../../db/schema/auth-schema";
import { matchPlayer, player, seasonPlayer } from "../../db/schema/league-schema";
import {
	generateUserAvatarKey,
	getExtensionFromContentType,
	isValidImageType,
	MAX_AVATAR_SIZE,
} from "../../lib/asset-util";
import { protectedProcedure } from "../trpc";

/**
 * Base64 regex pattern - validates base64 data URL format
 * Matches: data:image/{type};base64,{data}
 */
const BASE64_IMAGE_REGEX = /^data:image\/(jpeg|png|webp);base64,/;

export const userRouter = {
	uploadAvatar: protectedProcedure
		.input(
			z.object({
				imageData: z
					.string()
					.regex(
						BASE64_IMAGE_REGEX,
						"Invalid image data format. Expected base64 data URL (data:image/jpeg;base64,... or data:image/png;base64,...)"
					),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.authentication.user.id;

			// Extract content type from base64 data URL
			const contentTypeMatch = input.imageData.match(/^data:(image\/\w+);base64,/);
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
			const base64Data = input.imageData.replace(/^data:image\/\w+;base64,/, "");

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

			// Check file size (after base64 decoding it's larger, so check original size)
			const approximateSize = (base64Data.length * 3) / 4;
			if (approximateSize > MAX_AVATAR_SIZE) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: `Image too large. Maximum size is ${MAX_AVATAR_SIZE / 1024 / 1024}MB`,
				});
			}

			// Generate key and upload to R2
			const extension = getExtensionFromContentType(contentType);
			const key = generateUserAvatarKey(userId, extension);

			// Upload to R2 bucket
			const bucket = ctx.userAssets.bucket;
			await bucket.put(key, binaryData, {
				httpMetadata: {
					contentType,
				},
			});

			// Delete old avatar if exists
			const userData = await ctx.db
				.select({ image: user.image })
				.from(user)
				.where(eq(user.id, userId))
				.limit(1);

			if (userData.length > 0 && userData[0].image) {
				const oldKey = userData[0].image;
				// Only delete if it starts with user's path (safety check)
				if (oldKey.startsWith(`user/${userId}/`)) {
					try {
						await bucket.delete(oldKey);
					} catch {
						// Ignore deletion errors - file might not exist
					}
				}
			}

			// Update user's image field in database with just the key
			await ctx.db.update(user).set({ image: key }).where(eq(user.id, userId));

			return {
				success: true,
				key,
			};
		}),

	deleteAvatar: protectedProcedure.mutation(async ({ ctx }) => {
		const userId = ctx.authentication.user.id;

		// Get current avatar key
		const userData = await ctx.db
			.select({ image: user.image })
			.from(user)
			.where(eq(user.id, userId))
			.limit(1);

		if (userData.length === 0 || !userData[0].image) {
			return { success: true };
		}

		const key = userData[0].image;

		// Verify the key belongs to this user before deleting
		if (key.startsWith(`user/${userId}/`)) {
			const bucket = ctx.userAssets.bucket;
			try {
				await bucket.delete(key);
			} catch {
				// Ignore deletion errors - file might not exist
			}
		}

		// Clear the image field in database
		await ctx.db.update(user).set({ image: null }).where(eq(user.id, userId));

		return { success: true };
	}),

	getTotalMatches: protectedProcedure.query(async ({ ctx }) => {
		const userId = ctx.authentication.user.id;

		// Count all matches the user has participated in
		// Join matchPlayer -> seasonPlayer -> player to filter by userId
		const result = await ctx.db
			.select({ count: count() })
			.from(matchPlayer)
			.innerJoin(seasonPlayer, eq(matchPlayer.seasonPlayerId, seasonPlayer.id))
			.innerJoin(player, eq(seasonPlayer.playerId, player.id))
			.where(eq(player.userId, userId));

		return result[0]?.count || 0;
	}),
} satisfies TRPCRouterRecord;
