import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { adminProcedure, createTRPCRouter, protectedProcedure } from "../trpc";
import { user, league as organization, member } from "../../db/schema/auth-schema";
import { season, match } from "../../db/schema/league-schema";
import { desc, count, and, gte, lt, eq, sql } from "drizzle-orm";
import type { SeedInput } from "../../services/seed";

const PAGE_SIZE = 25;

export const adminRouter = createTRPCRouter({
	stats: adminProcedure.query(async ({ ctx }) => {
		const now = new Date();
		const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
		const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

		// Total users count
		const [totalResult] = await ctx.db.select({ count: count() }).from(user);

		// New users this week
		const [thisWeekResult] = await ctx.db
			.select({ count: count() })
			.from(user)
			.where(gte(user.createdAt, oneWeekAgo));

		// New users previous week
		const [prevWeekResult] = await ctx.db
			.select({ count: count() })
			.from(user)
			.where(and(gte(user.createdAt, twoWeeksAgo), lt(user.createdAt, oneWeekAgo)));

		return {
			totalUsers: totalResult?.count ?? 0,
			newUsersThisWeek: thisWeekResult?.count ?? 0,
			newUsersPrevWeek: prevWeekResult?.count ?? 0,
			bannedUsers: 0, // Will be implemented when ban functionality is added
		};
	}),

	users: adminProcedure
		.input(
			z.object({
				limit: z.number().min(1).max(100).default(PAGE_SIZE),
				offset: z.number().min(0).default(0),
			})
		)
		.query(async ({ ctx, input }) => {
			const { limit, offset } = input;

			// Get total count
			const [totalResult] = await ctx.db.select({ count: count() }).from(user);

			// Get users with pagination
			const users = await ctx.db
				.select({
					id: user.id,
					name: user.name,
					email: user.email,
					image: user.image,
					createdAt: user.createdAt,
				})
				.from(user)
				.orderBy(desc(user.createdAt))
				.limit(limit)
				.offset(offset);

			return {
				users,
				total: totalResult?.count ?? 0,
				offset,
				limit,
			};
		}),

	leagueStats: adminProcedure.query(async ({ ctx }) => {
		const now = new Date();
		const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
		const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

		// Total leagues count
		const [totalResult] = await ctx.db.select({ count: count() }).from(organization);

		// New leagues this week
		const [thisWeekResult] = await ctx.db
			.select({ count: count() })
			.from(organization)
			.where(gte(organization.createdAt, oneWeekAgo));

		// New leagues previous week
		const [prevWeekResult] = await ctx.db
			.select({ count: count() })
			.from(organization)
			.where(and(gte(organization.createdAt, twoWeeksAgo), lt(organization.createdAt, oneWeekAgo)));

		// Total seasons count
		const [seasonsResult] = await ctx.db.select({ count: count() }).from(season);

		// Total matches count
		const [matchesResult] = await ctx.db.select({ count: count() }).from(match);

		return {
			totalLeagues: totalResult?.count ?? 0,
			newLeaguesThisWeek: thisWeekResult?.count ?? 0,
			newLeaguesPrevWeek: prevWeekResult?.count ?? 0,
			totalSeasons: seasonsResult?.count ?? 0,
			totalMatches: matchesResult?.count ?? 0,
		};
	}),

	leagues: adminProcedure
		.input(
			z.object({
				limit: z.number().min(1).max(100).default(PAGE_SIZE),
				offset: z.number().min(0).default(0),
			})
		)
		.query(async ({ ctx, input }) => {
			const { limit, offset } = input;

			// Get total count
			const [totalResult] = await ctx.db.select({ count: count() }).from(organization);

			// Get leagues with member count, season count, and match count using subqueries
			const memberCountSubquery = ctx.db
				.select({
					organizationId: member.organizationId,
					count: count().as("memberCount"),
				})
				.from(member)
				.groupBy(member.organizationId)
				.as("memberCounts");

			const seasonCountSubquery = ctx.db
				.select({
					leagueId: season.leagueId,
					count: count().as("seasonCount"),
				})
				.from(season)
				.groupBy(season.leagueId)
				.as("seasonCounts");

			// Match count subquery - join match through season to get leagueId
			const matchCountSubquery = ctx.db
				.select({
					leagueId: season.leagueId,
					count: count(match.id).as("matchCount"),
				})
				.from(match)
				.innerJoin(season, eq(match.seasonId, season.id))
				.groupBy(season.leagueId)
				.as("matchCounts");

			const leagues = await ctx.db
				.select({
					id: organization.id,
					name: organization.name,
					slug: organization.slug,
					logo: organization.logo,
					createdAt: organization.createdAt,
					memberCount: sql<number>`COALESCE(${memberCountSubquery.count}, 0)`,
					seasonCount: sql<number>`COALESCE(${seasonCountSubquery.count}, 0)`,
					matchCount: sql<number>`COALESCE(${matchCountSubquery.count}, 0)`,
				})
				.from(organization)
				.leftJoin(memberCountSubquery, eq(memberCountSubquery.organizationId, organization.id))
				.leftJoin(seasonCountSubquery, eq(seasonCountSubquery.leagueId, organization.id))
				.leftJoin(matchCountSubquery, eq(matchCountSubquery.leagueId, organization.id))
				.orderBy(desc(organization.createdAt))
				.limit(limit)
				.offset(offset);

			return {
				leagues,
				total: totalResult?.count ?? 0,
				offset,
				limit,
			};
		}),

	seedEnabled: protectedProcedure.query(({ ctx }) => {
		return { enabled: !!ctx.env.SEED_ALLOWED };
	}),

	triggerSeed: adminProcedure
		.input(
			z.object({
				leagueName: z.string().min(1).max(100),
				leagueSlug: z.string().min(1).max(100),
				memberCount: z.number().min(3).max(50).default(8),
				matchCount: z.number().min(1).max(500).default(20),
			})
		)
		.mutation(async ({ ctx, input }) => {
			if (!ctx.env.SEED_ALLOWED) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Seeding is not allowed in this environment",
				});
			}

			const message: SeedInput = {
				leagueName: input.leagueName,
				leagueSlug: input.leagueSlug,
				memberCount: input.memberCount,
				matchCount: input.matchCount,
				userId: ctx.authentication.user.id,
			};

			await ctx.env.SEED_QUEUE.send(message);

			return { success: true };
		}),
});
