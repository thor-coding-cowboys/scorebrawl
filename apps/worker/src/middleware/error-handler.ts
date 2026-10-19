import type { ErrorHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";
import type { HonoEnv } from "./context";

/**
 * Mirrors Hono's default error handler, except that response-schema failures
 * (`schema.parse`) are logged and returned as the documented `ApiError` body.
 */
export const errorHandler: ErrorHandler<HonoEnv> = (err, c) => {
	if (err instanceof HTTPException) {
		const res = err.getResponse();
		return c.newResponse(res.body, res);
	}
	if (err instanceof ZodError) {
		const details = err.issues
			.map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`)
			.join("; ");
		console.error(`[public-api] response failed its schema: ${details}`);
		return c.json({ error: "internal_error" }, 500);
	}
	console.error(err);
	return c.text("Internal Server Error", 500);
};
