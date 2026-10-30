import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { DrizzleDB } from "../../db";
import {
	SHARE_LINK_EXPIRY_PRESETS,
	buildShareUrl,
	computeShareExpiry,
	generateShareToken,
	hashShareToken,
	type ShareLinkExpiryPreset,
} from "../../lib/share-links";
import * as seasonRepository from "../../repositories/season-repository";
import * as shareLinkRepository from "../../repositories/share-link-repository";
import { leagueEditorProcedure, leagueOwnerProcedure } from "../trpc";

async function resolveSeason(ctx: { db: DrizzleDB; organizationId: string }, seasonSlug: string) {
	try {
		return await seasonRepository.getBySlug({
			db: ctx.db,
			seasonSlug,
			leagueId: ctx.organizationId,
		});
	} catch {
		throw new TRPCError({ code: "NOT_FOUND", message: "Season not found" });
	}
}

const expirySchema = z.enum(SHARE_LINK_EXPIRY_PRESETS);

export const shareLinkRouter = {
	create: leagueEditorProcedure
		.input(z.object({ seasonSlug: z.string().min(1), expiresIn: expirySchema }))
		.mutation(async ({ ctx, input }) => {
			const season = await resolveSeason(ctx, input.seasonSlug);
			const { allowPublicShares } = await shareLinkRepository.getLeagueShareSetting({
				db: ctx.db,
				leagueId: ctx.organizationId,
			});

			if (!allowPublicShares) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Public sharing is disabled for this league",
				});
			}

			const token = generateShareToken();
			const expiresAt = computeShareExpiry(input.expiresIn as ShareLinkExpiryPreset);
			const link = await shareLinkRepository.createShareLink({
				db: ctx.db,
				leagueId: ctx.organizationId,
				seasonId: season.id,
				createdBy: ctx.authentication.user.id,
				tokenHash: await hashShareToken(token),
				expiresAt,
			});

			const origin = ctx.headers.get("origin") ?? ctx.env.PROD_URL;

			return {
				id: link.id,
				url: buildShareUrl(origin, {
					leagueId: ctx.organizationId,
					seasonId: season.id,
					token,
				}),
				expiresAt: link.expiresAt,
			};
		}),

	list: leagueEditorProcedure
		.input(z.object({ seasonSlug: z.string().min(1) }))
		.query(async ({ ctx, input }) => {
			const season = await resolveSeason(ctx, input.seasonSlug);
			return shareLinkRepository.listSeasonShareLinks({
				db: ctx.db,
				leagueId: ctx.organizationId,
				seasonId: season.id,
			});
		}),

	revoke: leagueEditorProcedure
		.input(z.object({ seasonSlug: z.string().min(1), id: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			const season = await resolveSeason(ctx, input.seasonSlug);
			const revoked = await shareLinkRepository.revokeShareLink({
				db: ctx.db,
				leagueId: ctx.organizationId,
				seasonId: season.id,
				id: input.id,
				revokedBy: ctx.authentication.user.id,
			});

			if (!revoked) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Share link not found" });
			}

			return { success: true };
		}),
};

export const shareSettingRouter = {
	get: leagueEditorProcedure.query(async ({ ctx }) => {
		return shareLinkRepository.getLeagueShareSetting({
			db: ctx.db,
			leagueId: ctx.organizationId,
		});
	}),

	update: leagueOwnerProcedure
		.input(z.object({ allowPublicShares: z.boolean() }))
		.mutation(async ({ ctx, input }) => {
			const result = await shareLinkRepository.updateLeagueShareSetting({
				db: ctx.db,
				leagueId: ctx.organizationId,
				userId: ctx.authentication.user.id,
				allowPublicShares: input.allowPublicShares,
			});

			return { allowPublicShares: input.allowPublicShares, ...result };
		}),
};
