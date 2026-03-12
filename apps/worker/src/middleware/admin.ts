import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import type { HonoEnv } from "./context";

export type AdminHonoEnv = HonoEnv & {
	Variables: HonoEnv["Variables"] & {
		authentication: NonNullable<HonoEnv["Variables"]["authentication"]>;
	};
};

export const enforceAdminMiddleware = createMiddleware<AdminHonoEnv>(async (c, next) => {
	const authentication = c.get("authentication");

	if (!authentication?.user || !authentication?.session) {
		throw new HTTPException(401, { message: "Unauthorized" });
	}

	const betterAuth = c.get("betterAuth");

	const result = await betterAuth.api.userHasPermission({
		body: { userId: authentication.user.id, permissions: { user: ["list"] } },
	});

	if (!result?.success) {
		throw new HTTPException(403, { message: "Forbidden" });
	}

	await next();
});
