import type { TRPCRouterRecord } from "@trpc/server";
import { and, count, eq, gt } from "drizzle-orm";
import { z } from "zod";
import { team, teamMember, user } from "../../db/schema/auth-schema";
import { activeOrgProcedure } from "../trpc";

export const teamRouter = {
	create: activeOrgProcedure
		.input(
			z.object({
				name: z.string().min(1).max(100),
			})
		)
		.mutation(async ({ ctx: { db, organizationId }, input }) => {
			const { name } = input;

			const [newTeam] = await db
				.insert(team)
				.values({
					id: crypto.randomUUID(),
					name,
					organizationId,
					createdAt: new Date(),
				})
				.returning();

			return { team: newTeam };
		}),

	list: activeOrgProcedure
		.input(
			z.object({
				cursor: z.string().optional(),
				limit: z.number().min(1).max(100).default(10),
			})
		)
		.query(async ({ ctx: { db, organizationId }, input }) => {
			const { cursor, limit } = input;

			const whereCondition = cursor
				? and(eq(team.organizationId, organizationId), gt(team.id, cursor))
				: eq(team.organizationId, organizationId);

			const [teams, [totalCountResult]] = await Promise.all([
				db
					.select({
						id: team.id,
						name: team.name,
						createdAt: team.createdAt,
						updatedAt: team.updatedAt,
					})
					.from(team)
					.where(whereCondition)
					.orderBy(team.id)
					.limit(limit + 1),
				db.select({ count: count() }).from(team).where(eq(team.organizationId, organizationId)),
			]);

			let nextCursor: string | null = null;
			if (teams.length > limit) {
				const nextItem = teams.pop();
				nextCursor = nextItem?.id ?? null;
			}

			return {
				teams,
				totalCount: totalCountResult?.count ?? 0,
				nextCursor,
			};
		}),

	members: activeOrgProcedure
		.input(
			z.object({
				teamId: z.string(),
				cursor: z.string().optional(),
				limit: z.number().min(1).max(100).default(10),
			})
		)
		.query(async ({ ctx: { db, organizationId }, input }) => {
			const { teamId, cursor, limit } = input;

			const whereCondition = cursor
				? and(
						eq(teamMember.teamId, teamId),
						eq(team.organizationId, organizationId),
						gt(teamMember.id, cursor)
					)
				: and(eq(teamMember.teamId, teamId), eq(team.organizationId, organizationId));

			const [members, [totalCountResult]] = await Promise.all([
				db
					.select({
						id: teamMember.id,
						createdAt: teamMember.createdAt,
						user: {
							id: user.id,
							name: user.name,
							email: user.email,
							image: user.image,
						},
					})
					.from(teamMember)
					.innerJoin(user, eq(teamMember.userId, user.id))
					.innerJoin(team, eq(teamMember.teamId, team.id))
					.where(whereCondition)
					.orderBy(teamMember.id)
					.limit(limit + 1),
				db
					.select({ count: count() })
					.from(teamMember)
					.innerJoin(team, eq(teamMember.teamId, team.id))
					.where(and(eq(teamMember.teamId, teamId), eq(team.organizationId, organizationId))),
			]);

			let nextCursor: string | null = null;
			if (members.length > limit) {
				const nextItem = members.pop();
				nextCursor = nextItem?.id ?? null;
			}

			return {
				members,
				totalCount: totalCountResult?.count ?? 0,
				nextCursor,
			};
		}),
} satisfies TRPCRouterRecord;
