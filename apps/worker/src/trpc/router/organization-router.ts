import type { TRPCRouterRecord } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { member, organization } from "../../db/schema/auth-schema";
import { protectedProcedure } from "../trpc";

export const organizationRouter = {
	list: protectedProcedure.query(async ({ ctx: { db, authentication } }) => {
		const userId = authentication.user.id;

		const organizations = await db
			.select({
				id: organization.id,
				name: organization.name,
				slug: organization.slug,
				logo: organization.logo,
				createdAt: organization.createdAt,
				role: member.role,
			})
			.from(member)
			.innerJoin(organization, eq(member.organizationId, organization.id))
			.where(eq(member.userId, userId));

		return { organizations };
	}),

	checkSlugAvailability: protectedProcedure
		.input(
			z.object({
				slug: z.string().min(1).max(100),
			})
		)
		.query(async ({ ctx: { db }, input }) => {
			const { slug } = input;

			const existing = await db
				.select({ id: organization.id })
				.from(organization)
				.where(eq(organization.slug, slug))
				.limit(1);

			return {
				slug,
				available: existing.length === 0,
			};
		}),
} satisfies TRPCRouterRecord;
