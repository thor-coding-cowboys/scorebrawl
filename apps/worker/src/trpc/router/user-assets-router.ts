import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure } from "../trpc";
import { digitsAndLowercaseNanoId } from "../../utils/id-util";

export const userAssetRouter = {
	getUserAvatarUploadUrl: protectedProcedure
		.input(
			z.object({
				extension: z.string().optional().default("jpg"),
				contentType: z.string().optional().default("image/jpeg"),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const avatarsBucket = ctx.userAssetsBucket;
			if (!avatarsBucket) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "R2 bucket not configured",
				});
			}

			// Generate a unique key for the avatar
			const key = `user/${ctx.authentication.user.id}/avatars/${digitsAndLowercaseNanoId()}.${input.extension}`;

			// Generate presigned PUT URL for direct client upload
			// R2 supports S3-compatible presigned URLs
			// We'll use the R2 API to create a presigned URL
			// For now, we'll return the key and the client will upload via our proxy
			// In production, you'd generate a presigned URL here

			// Actually, R2 in Workers doesn't have a direct presigned URL API
			// We need to use the S3-compatible API or a custom domain
			// For now, let's use a simpler approach: return a signed upload endpoint

			// Generate a temporary upload token (we'll validate this on upload)
			const uploadToken = digitsAndLowercaseNanoId(32);
			const expiresAt = Date.now() + 3600000; // 1 hour

			return {
				uploadKey: key,
				uploadUrl: `/api/upload/avatar/put?key=${encodeURIComponent(key)}&token=${uploadToken}`,
				token: uploadToken,
				expiresAt,
			};
		}),

	deleteUserAvatar: protectedProcedure
		.input(
			z.object({
				key: z.string(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			// Verify the key belongs to this user
			if (!input.key.startsWith(`user/${ctx.authentication.user.id}/`)) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Invalid key",
				});
			}

			const avatarsBucket = ctx.userAssetsBucket;
			if (!avatarsBucket) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "R2 bucket not configured",
				});
			}

			await avatarsBucket.delete(input.key);
			return { success: true };
		}),
} satisfies TRPCRouterRecord;
