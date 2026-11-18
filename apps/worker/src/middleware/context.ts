import { createMiddleware } from "hono/factory";
import { getDb } from "../db";
import { createAuth } from "../lib/better-auth";
import { getAuthInstance } from "../lib/auth-instance";
import { buildPasskeyConfig } from "../lib/passkey-config";
import { publicOrigin, resolveAuthBaseURL, resolveMcpResource } from "../lib/mcp";
import type { R2BucketRef } from "../lib/asset-util";

export type HonoEnv = {
	Bindings: Env;
	Variables: {
		db: ReturnType<typeof getDb>;
		// Uses createAuth (not betterAuth directly) for proper TypeScript inference
		// of plugin methods like betterAuth.api.verifyApiKey, createApiKey, etc.
		betterAuth: ReturnType<typeof createAuth>;
		authentication?: AuthType;
		userAssets: R2BucketRef;
		oauthToken?: { sub?: string; scope?: string };
		personalApiKey?: { keyId: string; userId: string; permissions: Record<string, string[]> };
		apiKey?:
			| {
					keyId: string;
					organizationId: string;
					userId: string;
					keyName: string;
					organization: { id: string; slug: string; name: string };
					permissions: Record<string, string[]>;
			  }
			| undefined;
	};
};

export const contextMiddleware = createMiddleware<HonoEnv>(async (c, next) => {
	const db = getDb(c.env.DB);

	// Derived from the request host, never the Origin header, so a request from
	// another site cannot become its own trusted origin (or mint a new cached
	// auth instance). Native clients send no Origin and land on the same origin
	// as the web app; `scorebrawl://` is added by createAuth.
	const publicRequestOrigin = publicOrigin(c.req.raw);
	const authBaseURL = resolveAuthBaseURL(c.env, publicRequestOrigin);

	// Unset in wrangler.jsonc by design (see docs/features/23-mobile-passkeys.md).
	const passkey = buildPasskeyConfig({
		requestOrigin: publicRequestOrigin,
		rpIdOverride: (c.env as { PASSKEY_RP_ID?: string }).PASSKEY_RP_ID,
		androidKeyHashes: c.env.PASSKEY_ANDROID_APK_KEY_HASHES,
	});

	const { auth, ready } = getAuthInstance(
		c.env,
		{
			baseURL: authBaseURL,
			origin: publicRequestOrigin,
			passkey,
			mcpResource: resolveMcpResource(c.env, `${publicRequestOrigin}/mcp`),
		},
		{
			waitUntil: (promise) => {
				try {
					c.executionCtx.waitUntil(promise);
				} catch {
					// No ExecutionContext (unit tests calling the app directly).
				}
			},
		}
	);

	// Resolved for every request after the first one that built the instance.
	await ready;

	c.set("db", db);
	c.set("betterAuth", auth);
	c.set("userAssets", {
		bucketName: "scorebrawl-user-assets",
		bucket: c.env.USER_ASSETS_BUCKET,
	});

	await next();
});

export type AuthType = {
	user: ReturnType<typeof createAuth>["$Infer"]["Session"]["user"];
	session: ReturnType<typeof createAuth>["$Infer"]["Session"]["session"];
};
