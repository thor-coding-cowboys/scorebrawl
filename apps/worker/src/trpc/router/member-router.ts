import type { TRPCRouterRecord } from "@trpc/server";
import { and, count, eq, gt, inArray } from "drizzle-orm";
import { z } from "zod";
import { member, team, teamMember, user } from "../../db/schema/auth-schema";
import { activeOrgProcedure } from "../trpc";

export const memberRouter = {
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
				? and(eq(member.organizationId, organizationId), gt(member.id, cursor))
				: eq(member.organizationId, organizationId);

			const [members, [totalCountResult]] = await Promise.all([
				db
					.select({
						id: member.id,
						userId: member.userId,
						role: member.role,
						createdAt: member.createdAt,
						user: {
							id: user.id,
							name: user.name,
							email: user.email,
							image: user.image,
						},
					})
					.from(member)
					.innerJoin(user, eq(member.userId, user.id))
					.where(whereCondition)
					.orderBy(member.id)
					.limit(limit + 1),
				db.select({ count: count() }).from(member).where(eq(member.organizationId, organizationId)),
			]);

			let nextCursor: string | null = null;
			if (members.length > limit) {
				const nextItem = members.pop();
				nextCursor = nextItem?.id ?? null;
			}

			const userIds = members.map((m) => m.userId);

			const userTeams =
				userIds.length > 0
					? await db
							.select({
								userId: teamMember.userId,
								teamId: team.id,
								teamName: team.name,
							})
							.from(teamMember)
							.innerJoin(team, eq(teamMember.teamId, team.id))
							.where(
								and(inArray(teamMember.userId, userIds), eq(team.organizationId, organizationId))
							)
					: [];

			const teamsByUserId = userTeams.reduce(
				(acc, ut) => {
					if (!acc[ut.userId]) {
						acc[ut.userId] = [];
					}
					acc[ut.userId].push({ id: ut.teamId, name: ut.teamName });
					return acc;
				},
				{} as Record<string, { id: string; name: string }[]>
			);

			const membersWithTeams = members.map((m) => ({
				...m,
				teams: teamsByUserId[m.userId] ?? [],
			}));

			return {
				members: membersWithTeams,
				totalCount: totalCountResult?.count ?? 0,
				nextCursor,
			};
		}),
} satisfies TRPCRouterRecord;
