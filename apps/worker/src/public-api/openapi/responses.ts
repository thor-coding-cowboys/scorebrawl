import type { Context, Env, Input } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { JSONObject } from "hono/utils/types";
import { HTTPException } from "hono/http-exception";
import { resolver, type ResponsesWithResolver } from "hono-openapi";
import type { z } from "zod";
import { publicApiErrorSchema } from "../schemas/errors";

type ResolvableSchema = Parameters<typeof resolver>[0];

export const apiKeySecurity = [{ apiKey: [] }];

export function jsonResponse(description: string, schema: ResolvableSchema) {
	return {
		description,
		content: { "application/json": { schema: resolver(schema) } },
	};
}

export function jsonRequest(schema: ResolvableSchema) {
	return {
		required: true,
		content: { "application/json": { schema: resolver(schema) } },
	};
}

export function errorResponse(description: string) {
	return jsonResponse(description, publicApiErrorSchema);
}

export type ApiAuthKind = "personal" | "league";

/**
 * Success responses plus the error set every public API route can return.
 * League routes add `409` because session actions can conflict with live state.
 */
export function apiResponses(
	success: ResponsesWithResolver,
	options: { auth: ApiAuthKind; errors?: ResponsesWithResolver }
): ResponsesWithResolver {
	const errors: ResponsesWithResolver = {
		400: errorResponse("Invalid request body or parameters"),
		401: errorResponse("Missing or invalid API key"),
		403: errorResponse(
			options.auth === "league"
				? "API key does not own this league"
				: "API key is missing a required scope"
		),
		404: errorResponse("Resource not found"),
		429: errorResponse("Rate limit exceeded"),
		500: errorResponse("Internal error"),
	};
	if (options.auth === "league") {
		errors[409] = errorResponse("Request conflicts with the current session state");
	}
	return { ...errors, ...success, ...options.errors };
}

/**
 * Validates the payload against the documented response schema before it goes
 * over the wire, so the document and the payload cannot drift. The payload is
 * normalized through JSON first, so validation sees exactly what `c.json`
 * serializes (dates become their wire `date-time` strings).
 */
export function respond<
	E extends Env,
	P extends string,
	I extends Input,
	Schema extends z.ZodType<JSONObject>,
>(c: Context<E, P, I>, schema: Schema, payload: unknown, status: ContentfulStatusCode = 200) {
	const wirePayload: unknown = JSON.parse(JSON.stringify(payload));
	const result = schema.safeParse(wirePayload);
	if (!result.success) {
		const details = result.error.issues.map((issue) => issue.message).join("; ");
		console.error(
			`[public-api] ${c.req.method} ${c.req.path} failed its response schema: ${details}`
		);
		throw new HTTPException(500, { res: c.json({ error: "internal_error" }, 500) });
	}
	return c.json(result.data, status);
}
