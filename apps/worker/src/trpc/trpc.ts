import { initTRPC, TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import superjson from "superjson";
import { z } from "zod";
import type { getDb } from "../db";
import type { createAuth } from "../lib/better-auth";
import { member, league as organization } from "../db/schema/auth-schema";
import { season } from "../db/schema/league-schema";
import type { AuthType, HonoEnv } from "../middleware/context";
import type { R2BucketRef } from "../lib/asset-util";

// Base context type
interface BaseContext {
	authentication?: AuthType;
	db: ReturnType<typeof getDb>;
	betterAuth: ReturnType<typeof createAuth>;
	getMcpAuth: () => Promise<ReturnType<typeof createAuth>>;
	userAssets: R2BucketRef;
	env: HonoEnv["Bindings"];
	waitUntil: (promise: Promise<unknown>) => void;
	headers: Headers;
}

// Extended context types
interface LeagueContext extends BaseContext {
	authentication: AuthType;
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

const t = initTRPC.context<BaseContext>().create({
	transformer: superjson,
});

const enforceUserIsAuthed = t.middleware(({ ctx, next }) => {
	if (!ctx.authentication) {
		throw new TRPCError({ code: "UNAUTHORIZED" });
	}
	return next({
		ctx: {
			authentication: ctx.authentication,
		},
	});
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
			organizationId: ctx.authentication.session.activeOrganizationId,
		},
	});
});

// Editor roles constant
export const editorRoles = ["owner", "editor"];
export const memberRoles = ["owner", "editor", "member"];

// League access middleware - verifies user is member of organization
const leagueAccessMiddleware = t.middleware(async ({ ctx, next }) => {
	const organizationId = ctx.authentication?.session.activeOrganizationId;
	if (!organizationId || !ctx.authentication) {
		throw new TRPCError({ code: "UNAUTHORIZED", message: "No active league" });
	}

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
		.where(and(eq(organization.id, organizationId), eq(member.userId, ctx.authentication.user.id)))
		.limit(1);

	if (org.length === 0) {
		throw new TRPCError({ code: "NOT_FOUND", message: "League not found" });
	}

	return next({
		ctx: {
			organization: org[0],
			role: org[0].role,
			organizationId,
		},
	});
});

// Season access middleware - verifies league membership and resolves the season
// in one D1 round trip. Every season-scoped query pays for this, so it is kept
// to a single statement instead of one query per concern.
const seasonAccessMiddleware = t.middleware(async ({ ctx, input, next }) => {
	const organizationId = ctx.authentication?.session.activeOrganizationId;
	if (!organizationId || !ctx.authentication) {
		throw new TRPCError({ code: "UNAUTHORIZED", message: "No active league" });
	}

	const seasonSlug = (input as { seasonSlug: string }).seasonSlug;

	const [row] = await ctx.db
		.select({
			organizationId: organization.id,
			organizationSlug: organization.slug,
			organizationName: organization.name,
			organizationLogo: organization.logo,
			role: member.role,
			seasonId: season.id,
			seasonSlug: season.slug,
			seasonName: season.name,
			initialScore: season.initialScore,
			scoreType: season.scoreType,
			kFactor: season.kFactor,
			startDate: season.startDate,
			endDate: season.endDate,
			rounds: season.rounds,
			closed: season.closed,
			archived: season.archived,
			seasonLeagueId: season.leagueId,
		})
		.from(season)
		.innerJoin(organization, eq(season.leagueId, organization.id))
		.innerJoin(
			member,
			and(eq(member.organizationId, organization.id), eq(member.userId, ctx.authentication.user.id))
		)
		.where(and(eq(season.slug, seasonSlug), eq(season.leagueId, organizationId)))
		.limit(1);

	if (!row) {
		throw new TRPCError({ code: "NOT_FOUND", message: "Season not found" });
	}

	return next({
		ctx: {
			organization: {
				id: row.organizationId,
				slug: row.organizationSlug,
				name: row.organizationName,
				logo: row.organizationLogo,
				role: row.role,
			},
			role: row.role,
			organizationId,
			season: {
				id: row.seasonId,
				slug: row.seasonSlug,
				name: row.seasonName,
				initialScore: row.initialScore,
				scoreType: row.scoreType,
				kFactor: row.kFactor,
				startDate: row.startDate,
				endDate: row.endDate,
				rounds: row.rounds,
				closed: row.closed,
				archived: row.archived,
				organizationId: row.seasonLeagueId,
			},
		},
	});
});

// Editor check middleware
const editorCheckMiddleware = t.middleware(({ ctx, next }) => {
	const typedCtx = ctx as unknown as LeagueContext;
	if (!editorRoles.includes(typedCtx.role)) {
		throw new TRPCError({ code: "FORBIDDEN", message: "Insufficient permissions" });
	}
	return next();
});

// Member check middleware - allows members to create content
const memberCheckMiddleware = t.middleware(({ ctx, next }) => {
	const typedCtx = ctx as unknown as LeagueContext;
	if (!memberRoles.includes(typedCtx.role)) {
		throw new TRPCError({ code: "FORBIDDEN", message: "Insufficient permissions" });
	}
	return next();
});

const ownerCheckMiddleware = t.middleware(({ ctx, next }) => {
	const typedCtx = ctx as unknown as LeagueContext;
	if (typedCtx.role !== "owner") {
		throw new TRPCError({ code: "FORBIDDEN", message: "Owner access required" });
	}
	return next();
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
	.use(seasonAccessMiddleware);

export const leagueEditorProcedure = t.procedure
	.use(enforceUserIsAuthed)
	.use(leagueAccessMiddleware)
	.use(editorCheckMiddleware);

export const leagueMemberProcedure = t.procedure
	.use(enforceUserIsAuthed)
	.use(leagueAccessMiddleware)
	.use(memberCheckMiddleware);

export const leagueOwnerProcedure = t.procedure
	.use(enforceUserIsAuthed)
	.use(leagueAccessMiddleware)
	.use(ownerCheckMiddleware);

// Admin check middleware - mirrors better-auth's admin plugin config
// (adminUserIds plus users with the "admin" role).
const adminCheckMiddleware = t.middleware(({ ctx, next }) => {
	if (!ctx.authentication) {
		throw new TRPCError({ code: "UNAUTHORIZED" });
	}

	const adminUserIds = (ctx.env.ADMIN_USER_IDS ?? "")
		.split(",")
		.map((id) => id.trim())
		.filter(Boolean);
	const { id, role } = ctx.authentication.user;
	const hasAdminRole = role?.split(",").some((r) => r.trim() === "admin") ?? false;

	if (!adminUserIds.includes(id) && !hasAdminRole) {
		throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
	}

	return next({
		ctx: {
			authentication: ctx.authentication,
		},
	});
});

export const adminProcedure = t.procedure.use(enforceUserIsAuthed).use(adminCheckMiddleware);
