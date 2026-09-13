import { createMiddleware } from "hono/factory";
import { requestToResourceInput, verifyAccessTokenRequest } from "better-auth/oauth2";
import type { JSONWebKeySet } from "jose";
import type { HonoEnv } from "../middleware/context";
import { jwks as jwksTable } from "../db/schema/auth-schema";

export type OAuthTokenPayload = {
	sub?: string | undefined;
	scope?: string | undefined;
};

export async function getJwksSet(db: HonoEnv["Variables"]["db"]): Promise<JSONWebKeySet> {
	const keys = await db
		.select({ id: jwksTable.id, publicKey: jwksTable.publicKey })
		.from(jwksTable);
	return {
		keys: keys.map((k) => ({
			kid: k.id,
			...JSON.parse(k.publicKey),
		})),
	};
}

export function requireScope(requiredScope: string) {
	return createMiddleware<HonoEnv>(async (c, next) => {
		const auth = c.get("betterAuth");
		try {
			const baseUrl =
				(auth.options as { baseURL?: string }).baseURL ??
				(c.env as { BETTER_AUTH_URL?: string }).BETTER_AUTH_URL ??
				new URL(c.req.raw.url).origin;
			const basePath = (auth.options as { basePath?: string }).basePath ?? "/api/auth";
			const issuer = `${baseUrl}${basePath}`;
			const payload = (await verifyAccessTokenRequest(requestToResourceInput(c.req.raw), {
				verifyOptions: {
					issuer,
					audience: c.env.OAUTH_RESOURCE,
				},
				requiredScopes: [requiredScope],
				jwksUrl: (() => getJwksSet(c.get("db"))) as unknown as string,
			})) as OAuthTokenPayload;
			c.set("oauthToken", payload);
			await next();
		} catch (error) {
			const apiError = error as { status?: string; body?: { error?: string; scope?: string } };
			if (apiError.status === "FORBIDDEN" || apiError.body?.error === "insufficient_scope") {
				const scope = apiError.body?.scope ?? requiredScope;
				return c.json(
					{
						error: "insufficient_scope",
						error_description: `The access token is missing the required scope: ${scope}`,
						scope,
					},
					403,
					{ "WWW-Authenticate": `Bearer error="insufficient_scope", scope="${scope}"` }
				);
			}
			return c.json(
				{
					error: "invalid_token",
					error_description: "The access token is missing, invalid or expired.",
				},
				401,
				{ "WWW-Authenticate": 'Bearer error="invalid_token"' }
			);
		}
	});
}
