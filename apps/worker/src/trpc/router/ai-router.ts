import type { TRPCRouterRecord } from "@trpc/server";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import { aiConversation, aiMessage, aiUserSettings } from "../../db/schema/ai-schema";
import { createId } from "../../utils/id-util";
import { encryptApiKey, decryptApiKey } from "../../services/ai/encryption";
import { activeOrgProcedure, protectedProcedure } from "../trpc";

export const aiRouter = {
	createMessage: activeOrgProcedure
		.input(
			z.object({
				conversationId: z.string().optional(),
				content: z.string().min(1).max(10000),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const { db, authentication, organizationId } = ctx;
			const userId = authentication.user.id;

			let conversationId = input.conversationId;

			if (!conversationId) {
				conversationId = createId();
				await db.insert(aiConversation).values({
					id: conversationId,
					userId,
					leagueId: organizationId,
					title: "New conversation",
				});
			} else {
				// Verify conversation belongs to user and league
				const existing = await db
					.select({ id: aiConversation.id })
					.from(aiConversation)
					.where(
						and(
							eq(aiConversation.id, conversationId),
							eq(aiConversation.userId, userId),
							eq(aiConversation.leagueId, organizationId)
						)
					)
					.limit(1);

				if (existing.length === 0) {
					throw new Error("Conversation not found");
				}
			}

			await db.insert(aiMessage).values({
				id: createId(),
				conversationId,
				role: "user",
				content: input.content,
			});

			return { conversationId };
		}),

	listConversations: activeOrgProcedure.query(async ({ ctx }) => {
		const { db, authentication, organizationId } = ctx;
		const userId = authentication.user.id;

		const conversations = await db
			.select({
				id: aiConversation.id,
				title: aiConversation.title,
				createdAt: aiConversation.createdAt,
				updatedAt: aiConversation.updatedAt,
			})
			.from(aiConversation)
			.where(and(eq(aiConversation.userId, userId), eq(aiConversation.leagueId, organizationId)))
			.orderBy(desc(aiConversation.updatedAt));

		return { conversations };
	}),

	getConversation: activeOrgProcedure
		.input(z.object({ conversationId: z.string() }))
		.query(async ({ ctx, input }) => {
			const { db, authentication, organizationId } = ctx;
			const userId = authentication.user.id;

			const conversation = await db
				.select({
					id: aiConversation.id,
					title: aiConversation.title,
					createdAt: aiConversation.createdAt,
					updatedAt: aiConversation.updatedAt,
				})
				.from(aiConversation)
				.where(
					and(
						eq(aiConversation.id, input.conversationId),
						eq(aiConversation.userId, userId),
						eq(aiConversation.leagueId, organizationId)
					)
				)
				.limit(1);

			if (conversation.length === 0) {
				return null;
			}

			const messages = await db
				.select({
					id: aiMessage.id,
					role: aiMessage.role,
					content: aiMessage.content,
					toolName: aiMessage.toolName,
					toolArgs: aiMessage.toolArgs,
					toolResult: aiMessage.toolResult,
					createdAt: aiMessage.createdAt,
				})
				.from(aiMessage)
				.where(eq(aiMessage.conversationId, input.conversationId))
				.orderBy(aiMessage.createdAt);

			return {
				...conversation[0],
				messages,
			};
		}),

	deleteConversation: activeOrgProcedure
		.input(z.object({ conversationId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const { db, authentication, organizationId } = ctx;
			const userId = authentication.user.id;

			await db
				.delete(aiConversation)
				.where(
					and(
						eq(aiConversation.id, input.conversationId),
						eq(aiConversation.userId, userId),
						eq(aiConversation.leagueId, organizationId)
					)
				);

			return { success: true };
		}),

	updateSettings: protectedProcedure
		.input(
			z.object({
				provider: z.enum(["openai", "opencode"]),
				model: z.string().min(1),
				apiKey: z.string().min(1),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const { db, authentication, env } = ctx;
			const userId = authentication.user.id;
			const encryptionKey = env.AI_ENCRYPTION_KEY;

			if (!encryptionKey) {
				throw new Error("AI encryption key not configured");
			}

			const encryptedApiKey = await encryptApiKey(input.apiKey, encryptionKey);

			const existing = await db
				.select({ id: aiUserSettings.id })
				.from(aiUserSettings)
				.where(eq(aiUserSettings.userId, userId))
				.limit(1);

			if (existing.length > 0) {
				await db
					.update(aiUserSettings)
					.set({
						provider: input.provider,
						model: input.model,
						encryptedApiKey,
						updatedAt: new Date(),
					})
					.where(eq(aiUserSettings.userId, userId));
			} else {
				await db.insert(aiUserSettings).values({
					id: createId(),
					userId,
					provider: input.provider,
					model: input.model,
					encryptedApiKey,
				});
			}

			return { success: true };
		}),

	getSettings: protectedProcedure.query(async ({ ctx }) => {
		const { db, authentication, env } = ctx;
		const userId = authentication.user.id;
		const encryptionKey = env.AI_ENCRYPTION_KEY;

		const settings = await db
			.select({
				id: aiUserSettings.id,
				provider: aiUserSettings.provider,
				model: aiUserSettings.model,
				encryptedApiKey: aiUserSettings.encryptedApiKey,
			})
			.from(aiUserSettings)
			.where(eq(aiUserSettings.userId, userId))
			.limit(1);

		if (settings.length === 0) {
			return null;
		}

		const s = settings[0];
		let apiKey = "";
		if (encryptionKey) {
			try {
				apiKey = await decryptApiKey(s.encryptedApiKey, encryptionKey);
			} catch {
				// If decryption fails, return empty key
			}
		}

		return {
			id: s.id,
			provider: s.provider,
			model: s.model,
			apiKey,
		};
	}),
} satisfies TRPCRouterRecord;
