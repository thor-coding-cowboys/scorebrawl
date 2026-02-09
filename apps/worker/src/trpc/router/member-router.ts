import type { TRPCRouterRecord } from "@trpc/server";
import { and, count, eq, gt } from "drizzle-orm";
import { z } from "zod";
import { member, user, invitation, league } from "../../db/schema/auth-schema";
import { activeOrgProcedure, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";

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

			return {
				members,
				totalCount: totalCountResult?.count ?? 0,
				nextCursor,
			};
		}),

	getInvitationById: protectedProcedure
		.input(z.object({ invitationId: z.string() }))
		.query(async ({ ctx, input }) => {
			const { db, authentication } = ctx;
			const userEmail = authentication.user.email;

			const [inv] = await db
				.select({
					id: invitation.id,
					email: invitation.email,
					role: invitation.role,
					status: invitation.status,
					expiresAt: invitation.expiresAt,
					league: {
						id: league.id,
						name: league.name,
						slug: league.slug,
						logo: league.logo,
					},
					inviter: {
						id: user.id,
						name: user.name,
						email: user.email,
						image: user.image,
					},
				})
				.from(invitation)
				.innerJoin(league, eq(invitation.organizationId, league.id))
				.innerJoin(user, eq(invitation.inviterId, user.id))
				.where(eq(invitation.id, input.invitationId))
				.limit(1);

			if (!inv) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Invitation not found" });
			}

			if (inv.email !== userEmail) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "This invitation is for a different email address",
				});
			}

			if (inv.status !== "pending") {
				throw new TRPCError({ code: "BAD_REQUEST", message: `Invitation is ${inv.status}` });
			}

			if (new Date() > inv.expiresAt) {
				throw new TRPCError({ code: "BAD_REQUEST", message: "Invitation has expired" });
			}

			return inv;
		}),

	listPendingInvitations: protectedProcedure.query(async ({ ctx }) => {
		const { db, authentication } = ctx;
		const userEmail = authentication.user.email;

		const pendingInvitations = await db
			.select({
				id: invitation.id,
				email: invitation.email,
				role: invitation.role,
				status: invitation.status,
				expiresAt: invitation.expiresAt,
				createdAt: invitation.createdAt,
				league: {
					id: league.id,
					name: league.name,
					slug: league.slug,
					logo: league.logo,
				},
				inviter: {
					id: user.id,
					name: user.name,
					email: user.email,
					image: user.image,
				},
			})
			.from(invitation)
			.innerJoin(league, eq(invitation.organizationId, league.id))
			.innerJoin(user, eq(invitation.inviterId, user.id))
			.where(and(eq(invitation.email, userEmail), eq(invitation.status, "pending")))
			.orderBy(invitation.createdAt);

		// Filter out expired invitations
		const now = new Date();
		const validInvitations = pendingInvitations.filter((inv) => inv.expiresAt > now);

		return validInvitations;
	}),
} satisfies TRPCRouterRecord;
