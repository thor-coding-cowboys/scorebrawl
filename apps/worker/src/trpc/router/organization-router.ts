import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { league as organization } from "../../db/schema/auth-schema";
import {
	generateOrgLogoKey,
	getExtensionFromContentType,
	isValidImageType,
	MAX_AVATAR_SIZE,
} from "../../lib/asset-util";
import { leagueEditorProcedure } from "../trpc";

/**
 * Base64 regex pattern - validates base64 data URL format
 * Matches: data:image/{type};base64,{data}
 */
const BASE64_IMAGE_REGEX = /^data:image\/(jpeg|png|webp);base64,/;

// Context type for procedures that use leagueEditorProcedure or leagueProcedure
interface LeagueContext {
	organizationId: string;
}

export const organizationRouter = {
	uploadLogo: leagueEditorProcedure
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
			const organizationId = (ctx as unknown as LeagueContext).organizationId;

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
			const key = generateOrgLogoKey(organizationId, extension);

			// Upload to R2 bucket
			const bucket = ctx.userAssets.bucket;
			await bucket.put(key, binaryData, {
				httpMetadata: {
					contentType,
				},
			});

			// Delete old logo if exists
			const orgData = await ctx.db
				.select({ logo: organization.logo })
				.from(organization)
				.where(eq(organization.id, organizationId))
				.limit(1);

			if (orgData.length > 0 && orgData[0].logo) {
				const oldKey = orgData[0].logo;
				// Only delete if it starts with organization's path (safety check)
				if (oldKey.startsWith(`organization/${organizationId}/`)) {
					try {
						await bucket.delete(oldKey);
					} catch {
						// Ignore deletion errors - file might not exist
					}
				}
			}

			// Update organization's logo field in database
			await ctx.db
				.update(organization)
				.set({ logo: key })
				.where(eq(organization.id, organizationId));

			return {
				success: true,
				key,
			};
		}),

	deleteLogo: leagueEditorProcedure.mutation(async ({ ctx }) => {
		const organizationId = (ctx as unknown as LeagueContext).organizationId;

		// Get current logo key
		const orgData = await ctx.db
			.select({ logo: organization.logo })
			.from(organization)
			.where(eq(organization.id, organizationId))
			.limit(1);

		if (orgData.length === 0 || !orgData[0].logo) {
			return { success: true };
		}

		const key = orgData[0].logo;

		// Verify the key belongs to this organization before deleting
		if (key.startsWith(`organization/${organizationId}/`)) {
			const bucket = ctx.userAssets.bucket;
			try {
				await bucket.delete(key);
			} catch {
				// Ignore deletion errors - file might not exist
			}
		}

		// Clear the logo field in database
		await ctx.db
			.update(organization)
			.set({ logo: null })
			.where(eq(organization.id, organizationId));

		return { success: true };
	}),
} satisfies TRPCRouterRecord;
