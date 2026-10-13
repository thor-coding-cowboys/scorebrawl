import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { apikey } from "../../db/schema/auth-schema";
import type { createAuth } from "../../lib/better-auth";
import { leagueOwnerProcedure } from "../trpc";

export const API_KEY_SCOPES = [
	"session:start",
	"session:stop",
	"match:start",
	"match:log",
	"match:lineup",
] as const;

export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];

export function scopesToPermissions(scopes: ApiKeyScope[]): Record<string, string[]> {
	const permissions: Record<string, string[]> = {};
	for (const scope of scopes) {
		const [resource, action] = scope.split(":") as [string, string];
		permissions[resource] = [...(permissions[resource] ?? []), action];
	}
	return permissions;
}

export function permissionsToScopes(permissions: Record<string, string[]> | null): string[] {
	if (!permissions) return [];
	return Object.entries(permissions).flatMap(([resource, actions]) =>
		actions.map((action) => `${resource}:${action}`)
	);
}

const scopesSchema = z.array(z.enum(API_KEY_SCOPES)).min(1);

const EXPIRY_DAYS = { "30d": 30, "90d": 90, "1y": 365 } as const;
const expirySchema = z.union([z.enum(["30d", "90d", "1y"]), z.literal("never")]);

function expiresInSeconds(expiry: z.infer<typeof expirySchema>): number | undefined {
	if (expiry === "never") return undefined;
	return EXPIRY_DAYS[expiry] * 24 * 60 * 60;
}

interface CreateOrgApiKeyContext {
	betterAuth: ReturnType<typeof createAuth>;
	organizationId: string;
	authentication: { user: { id: string } };
}

interface CreateOrgApiKeyInput {
	name: string;
	scopes: ApiKeyScope[];
	expiry: z.infer<typeof expirySchema>;
}

async function createOrgApiKey(ctx: CreateOrgApiKeyContext, input: CreateOrgApiKeyInput) {
	const created = await ctx.betterAuth.api.createApiKey({
		body: {
			organizationId: ctx.organizationId,
			userId: ctx.authentication.user.id,
			name: input.name,
			permissions: scopesToPermissions(input.scopes),
			expiresIn: expiresInSeconds(input.expiry),
			metadata: { createdByUserId: ctx.authentication.user.id, expiry: input.expiry },
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
}

export const apiKeyRouter = {
	list: leagueOwnerProcedure.query(async ({ ctx }) => {
		const result = await ctx.betterAuth.api.listApiKeys({
			query: { organizationId: ctx.organizationId, sortBy: "createdAt", sortDirection: "desc" },
			headers: ctx.headers,
		});
		return result.apiKeys.map((key) => ({
			id: key.id,
			name: key.name ?? "",
			start: key.start ?? "",
			createdAt: key.createdAt,
			expiresAt: key.expiresAt,
			expiry: (key.metadata as { expiry?: string } | null)?.expiry ?? "never",
			scopes: permissionsToScopes(key.permissions ?? null),
		}));
	}),

	create: leagueOwnerProcedure
		.input(
			z.object({ name: z.string().min(1).max(100), scopes: scopesSchema, expiry: expirySchema })
		)
		.mutation(async ({ ctx, input }) => createOrgApiKey(ctx, input)),

	delete: leagueOwnerProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const deleted = await ctx.db
				.delete(apikey)
				.where(and(eq(apikey.id, input.id), eq(apikey.referenceId, ctx.organizationId)))
				.returning({ id: apikey.id });
			if (deleted.length === 0) {
				throw new TRPCError({ code: "NOT_FOUND", message: "API key not found" });
			}
			return { success: true };
		}),

	regenerate: leagueOwnerProcedure
		.input(
			z.object({
				id: z.string(),
				name: z.string().min(1).max(100),
				scopes: scopesSchema,
				expiry: expirySchema,
			})
		)
		.mutation(async ({ ctx, input }) => {
			const existing = await ctx.db
				.select({ id: apikey.id })
				.from(apikey)
				.where(and(eq(apikey.id, input.id), eq(apikey.referenceId, ctx.organizationId)))
				.limit(1);
			if (existing.length === 0) {
				throw new TRPCError({ code: "NOT_FOUND", message: "API key not found" });
			}
			const created = await createOrgApiKey(ctx, input);
			try {
				await ctx.db.delete(apikey).where(eq(apikey.id, input.id));
			} catch (error) {
				await ctx.db.delete(apikey).where(eq(apikey.id, created.id));
				throw error;
			}
			return created;
		}),
} satisfies TRPCRouterRecord;
