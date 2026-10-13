import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { apikey } from "../../db/schema/auth-schema";
import { PERSONAL_API_KEY_CONFIG_ID } from "../../lib/better-auth";
import { protectedProcedure } from "../trpc";
import { permissionsToScopes, scopesToPermissions } from "./api-key-router";

export const PERSONAL_API_KEY_SCOPES = ["profile:read", "league:read"] as const;

const EXPIRY_DAYS = { "30d": 30, "90d": 90, "1y": 365 } as const;

const scopesSchema = z.array(z.enum(PERSONAL_API_KEY_SCOPES)).min(1);
const expirySchema = z.union([z.enum(["30d", "90d", "1y"]), z.literal("never")]);

function parseJson<T>(value: string | null): T | null {
	if (!value) return null;
	try {
		return JSON.parse(value) as T;
	} catch {
		return null;
	}
}

export const personalApiKeyRouter = {
	list: protectedProcedure.query(async ({ ctx }) => {
		const keys = await ctx.db
			.select()
			.from(apikey)
			.where(
				and(
					eq(apikey.referenceId, ctx.authentication.user.id),
					eq(apikey.configId, PERSONAL_API_KEY_CONFIG_ID)
				)
			)
			.orderBy(desc(apikey.createdAt));
		return keys.map((key) => ({
			id: key.id,
			name: key.name ?? "",
			start: key.start ?? "",
			createdAt: key.createdAt,
			expiresAt: key.expiresAt,
			scopes: permissionsToScopes(parseJson<Record<string, string[]>>(key.permissions)),
		}));
	}),

	create: protectedProcedure
		.input(
			z.object({ name: z.string().min(1).max(100), scopes: scopesSchema, expiry: expirySchema })
		)
		.mutation(async ({ ctx, input }) => {
			const created = await ctx.betterAuth.api.createApiKey({
				body: {
					configId: PERSONAL_API_KEY_CONFIG_ID,
					userId: ctx.authentication.user.id,
					name: input.name,
					permissions: scopesToPermissions(input.scopes),
					expiresIn: input.expiry === "never" ? undefined : EXPIRY_DAYS[input.expiry] * 86400,
					metadata: { expiry: input.expiry },
				},
			});
			return {
				id: created.id,
				key: created.key,
				name: created.name ?? input.name,
				start: created.start ?? "",
				createdAt: created.createdAt,
				expiresAt: created.expiresAt,
			};
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const deleted = await ctx.db
				.delete(apikey)
				.where(
					and(
						eq(apikey.id, input.id),
						eq(apikey.referenceId, ctx.authentication.user.id),
						eq(apikey.configId, PERSONAL_API_KEY_CONFIG_ID)
					)
				)
				.returning({ id: apikey.id });
			if (deleted.length === 0) {
				throw new TRPCError({ code: "NOT_FOUND", message: "API key not found" });
			}
			return { success: true };
		}),
} satisfies TRPCRouterRecord;
