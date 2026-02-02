import { initTRPC, TRPCError } from "@trpc/server";
import type { betterAuth } from "better-auth";
import { and, eq } from "drizzle-orm";
import superjson from "superjson";
import { z } from "zod";
import type { getDb } from "../db";
import { member, organization } from "../db/schema/auth-schema";
import { competition } from "../db/schema/competition-schema";
import type { AuthType } from "../middleware/context";

// Extended context types
interface OrganizationContext {
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

interface CompetitionContext extends OrganizationContext {
	competition: {
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
		userAssetsBucket?: R2Bucket;
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
			message: "No active organization",
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

// Organization access middleware - verifies user is member of organization
const organizationAccessMiddleware = t.middleware(async ({ ctx, next }) => {
	const organizationId = ctx.authentication?.session.activeOrganizationId;
	if (!organizationId) {
		throw new TRPCError({ code: "UNAUTHORIZED", message: "No active organization" });
	}

	// Verify organization exists and user is a member
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
		throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });
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

// Competition access middleware - verifies competition exists in organization
const competitionAccessMiddleware = t.middleware(async ({ ctx, input, next }) => {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const competitionSlug = (input as any).competitionSlug;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const organizationId = (ctx as any).organizationId;

	// Get competition with organization verification
	const comp = await ctx.db
		.select({
			id: competition.id,
			slug: competition.slug,
			name: competition.name,
			initialScore: competition.initialScore,
			scoreType: competition.scoreType,
			kFactor: competition.kFactor,
			startDate: competition.startDate,
			endDate: competition.endDate,
			rounds: competition.rounds,
			closed: competition.closed,
			archived: competition.archived,
			organizationId: competition.organizationId,
		})
		.from(competition)
		.where(
			and(eq(competition.slug, competitionSlug), eq(competition.organizationId, organizationId))
		)
		.limit(1);

	if (comp.length === 0) {
		throw new TRPCError({ code: "NOT_FOUND", message: "Competition not found" });
	}

	return next({
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		ctx: {
			...ctx,
			competition: comp[0],
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

// Competition-specific procedures
export const organizationProcedure = t.procedure
	.use(enforceUserIsAuthed)
	.use(organizationAccessMiddleware);

export const competitionProcedure = t.procedure
	.input(z.object({ competitionSlug: z.string() }))
	.use(enforceUserIsAuthed)
	.use(organizationAccessMiddleware)
	.use(competitionAccessMiddleware);

export const organizationEditorProcedure = t.procedure
	.use(enforceUserIsAuthed)
	.use(organizationAccessMiddleware)
	.use(editorCheckMiddleware);

// Export types for use in routers
export type { OrganizationContext, CompetitionContext };
