import { z } from "zod/v4";

/**
 * Canonical error body returned by the API-key public API middleware and routes.
 * Shape is fixed by the middleware today: `{ error, error_description? }`.
 */
export const publicApiErrorSchema = z
	.object({
		error: z.string(),
		error_description: z.string().nullable().optional(),
	})
	.meta({ ref: "ApiError" });

export type PublicApiError = z.infer<typeof publicApiErrorSchema>;
