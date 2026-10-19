import { z } from "zod/v4";

export const meResponseSchema = z
	.object({
		user: z.object({
			id: z.string(),
			name: z.string(),
			email: z.string(),
		}),
	})
	.meta({ ref: "MeResponse" });

export const listLeaguesResponseSchema = z
	.object({
		leagues: z.array(
			z.object({
				id: z.string(),
				name: z.string(),
				slug: z.string(),
				role: z.string(),
			})
		),
	})
	.meta({ ref: "ListLeaguesResponse" });

export type MeResponse = z.infer<typeof meResponseSchema>;
export type ListLeaguesResponse = z.infer<typeof listLeaguesResponseSchema>;
