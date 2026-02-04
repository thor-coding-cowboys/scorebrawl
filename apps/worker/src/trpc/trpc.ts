import { initTRPC, TRPCError } from "@trpc/server";
import type { betterAuth } from "better-auth";
import { and, eq } from "drizzle-orm";
import superjson from "superjson";
import { z } from "zod";
import type { getDb } from "../db";
import { member, league as organization } from "../db/schema/auth-schema";
import { season } from "../db/schema/competition-schema";
import type { AuthType } from "../middleware/context";
import type { R2BucketRef } from "../lib/asset-util";

// Extended context types
interface LeagueContext {
	organizationId: string;
	organization: {
		id: string;
		slug: string;
		name: string;
		logo: string | null;
		role: string;
	};
	role: string;
}

interface SeasonContext extends LeagueContext {
	season: {
		id: string;
		slug: string;
		name: string;
		initialScore: number;
		scoreType: "elo" | "3-1-0" | "elo-individual-vs-team";
		kFactor: number;
		startDate: Date;
		endDate: Date | null;
		rounds: number | null;
		closed: boolean;
		archived: boolean;
		organizationId: string;
	};
}

const t = initTRPC
	.context<{
		authentication?: AuthType;
		db: ReturnType<typeof getDb>;
		betterAuth: ReturnType<typeof betterAuth>;
		userAssets: R2BucketRef;
	}>()
	.create({
		transformer: superjson,
	});

const enforceUserIsAuthed = t.middleware(({ ctx, next }) => {
	if (!ctx.authentication?.user) {
		throw new TRPCError({ code: "UNAUTHORIZED" });
	}
	return next({ ctx: { ...ctx, authentication: ctx.authentication } });
});

const enforceActiveOrg = t.middleware(({ ctx, next }) => {
	if (!ctx.authentication?.session.activeOrganizationId) {
		throw new TRPCError({
			code: "UNAUTHORIZED",
			message: "No active league",
		});
	}
	return next({
		ctx: {
			...ctx,
			authentication: ctx.authentication,
			organizationId: ctx.authentication.session.activeOrganizationId,
		},
	});
});

// Editor roles constant
export const editorRoles = ["owner", "admin"];

// League access middleware - verifies user is member of organization
const leagueAccessMiddleware = t.middleware(async ({ ctx, next }) => {
	const organizationId = ctx.authentication?.session.activeOrganizationId;
	if (!organizationId) {
		throw new TRPCError({ code: "UNAUTHORIZED", message: "No active league" });
	}

	// Verify league exists and user is a member
	const org = await ctx.db
		.select({
			id: organization.id,
			slug: organization.slug,
			name: organization.name,
			logo: organization.logo,
			role: member.role,
		})
		.from(organization)
		.innerJoin(member, eq(member.organizationId, organization.id))
		.where(and(eq(organization.id, organizationId), eq(member.userId, ctx.authentication!.user.id)))
		.limit(1);

	if (org.length === 0) {
		throw new TRPCError({ code: "NOT_FOUND", message: "League not found" });
	}

	return next({
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		ctx: {
			...ctx,
			organization: org[0],
			role: org[0].role,
			organizationId,
		} as any,
	});
});

// Season access middleware - verifies season exists in organization
const seasonAccessMiddleware = t.middleware(async ({ ctx, input, next }) => {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const seasonSlug = (input as any).seasonSlug;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const organizationId = (ctx as any).organizationId;

	// Get season with organization verification
	const comp = await ctx.db
		.select({
			id: season.id,
			slug: season.slug,
			name: season.name,
			initialScore: season.initialScore,
			scoreType: season.scoreType,
			kFactor: season.kFactor,
			startDate: season.startDate,
			endDate: season.endDate,
			rounds: season.rounds,
			closed: season.closed,
			archived: season.archived,
			organizationId: season.organizationId,
		})
		.from(season)
		.where(and(eq(season.slug, seasonSlug), eq(season.organizationId, organizationId)))
		.limit(1);

	if (comp.length === 0) {
		throw new TRPCError({ code: "NOT_FOUND", message: "Season not found" });
	}

	return next({
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		ctx: {
			...ctx,
			season: comp[0],
		} as any,
	});
});

// Editor check middleware
const editorCheckMiddleware = t.middleware(({ ctx, next }) => {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	if (!editorRoles.includes((ctx as any).role)) {
		throw new TRPCError({ code: "FORBIDDEN", message: "Insufficient permissions" });
	}
	return next({ ctx });
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(enforceUserIsAuthed);

export const activeOrgProcedure = t.procedure.use(enforceUserIsAuthed).use(enforceActiveOrg);

// Season-specific procedures
export const leagueProcedure = t.procedure.use(enforceUserIsAuthed).use(leagueAccessMiddleware);

export const seasonProcedure = t.procedure
	.input(z.object({ seasonSlug: z.string() }))
	.use(enforceUserIsAuthed)
	.use(leagueAccessMiddleware)
	.use(seasonAccessMiddleware);

export const leagueEditorProcedure = t.procedure
	.use(enforceUserIsAuthed)
	.use(leagueAccessMiddleware)
	.use(editorCheckMiddleware);

// Export types for use in routers
export type { LeagueContext, SeasonContext };
