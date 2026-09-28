import type { TRPCRouterRecord } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import {
	defaultNotificationPreferences,
	pushToken,
	userPreference,
} from "../../db/schema/user-preferences-schema";
import { NOTIFICATION_PREFERENCE_COLUMNS } from "../../services/notification-preferences";
import { protectedProcedure } from "../trpc";

export const notificationRouter = {
	registerToken: protectedProcedure
		.input(
			z.object({
				token: z.string().min(1).max(255),
				platform: z.enum(["ios", "android"]),
				deviceName: z.string().max(255).optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.authentication.user.id;
			const now = new Date();

			await ctx.db
				.insert(pushToken)
				.values({
					id: crypto.randomUUID(),
					userId,
					token: input.token,
					platform: input.platform,
					deviceName: input.deviceName ?? null,
					createdAt: now,
					updatedAt: now,
					lastSeenAt: now,
				})
				.onConflictDoUpdate({
					target: pushToken.token,
					set: {
						userId,
						platform: input.platform,
						deviceName: input.deviceName ?? null,
						updatedAt: now,
						lastSeenAt: now,
					},
				});

			return { success: true };
		}),

	unregisterToken: protectedProcedure
		.input(z.object({ token: z.string().min(1).max(255) }))
		.mutation(async ({ ctx, input }) => {
			await ctx.db
				.delete(pushToken)
				.where(
					and(eq(pushToken.token, input.token), eq(pushToken.userId, ctx.authentication.user.id))
				);

			return { success: true };
		}),

	getSettings: protectedProcedure.query(async ({ ctx }) => {
		const [prefs] = await ctx.db
			.select(NOTIFICATION_PREFERENCE_COLUMNS)
			.from(userPreference)
			.where(eq(userPreference.userId, ctx.authentication.user.id))
			.limit(1);

		return prefs ?? defaultNotificationPreferences;
	}),

	updateSettings: protectedProcedure
		.input(
			z.object({
				pushEnabled: z.boolean().optional(),
				notifySessionStarted: z.boolean().optional(),
				notifyMatchRecorded: z.boolean().optional(),
				notifyAchievementUnlocked: z.boolean().optional(),
				notifyStreakReached: z.boolean().optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.authentication.user.id;
			const now = new Date();

			await ctx.db
				.insert(userPreference)
				.values({ userId, ...input, createdAt: now, updatedAt: now })
				.onConflictDoUpdate({
					target: userPreference.userId,
					set: { ...input, updatedAt: now },
				});

			return { success: true };
		}),
} satisfies TRPCRouterRecord;
