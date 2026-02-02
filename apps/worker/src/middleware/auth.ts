import type { betterAuth } from "better-auth";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import type { getDb } from "../db";
import type { AuthType, HonoEnv } from "./context";

export type EnforcedAuthHonoEnv = HonoEnv & {
	Variables: {
		db: ReturnType<typeof getDb>;
		betterAuth: ReturnType<typeof betterAuth>;
		authentication: AuthType;
	};
};
export const enforceAuthMiddleware = createMiddleware<EnforcedAuthHonoEnv>(async (c, next) => {
	const betterAuth = c.get("betterAuth");
	const session = await betterAuth.api.getSession({
		headers: c.req.raw.headers,
	});

	if (!session?.user || !session?.session) {
		throw new HTTPException(401, { message: "Unauthorized" });
	}

	c.set("authentication", session);

	await next();
});
