import { createMiddleware } from "hono/factory";
import { getDb } from "../db";
import { createAuth } from "../lib/better-auth";
import { buildPasskeyConfig } from "../lib/passkey-config";
import { resolveAuthBaseURL, resolveMcpResource } from "../lib/mcp";
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
	// Initialize database
	const {
		DB,
		USER_ASSETS_BUCKET: userAssetsBucket,
		VITE_GITHUB_CLIENT_ID: githubClientId,
		GITHUB_CLIENT_SECRET: githubClientSecret,
		VITE_GOOGLE_CLIENT_ID: googleClientId,
		GOOGLE_CLIENT_SECRET: googleClientSecret,
		BETTER_AUTH_SECRET: betterAuthSecret,
		RESEND_API_KEY: resendApiKey,
		ADMIN_USER_IDS: adminUserIdsEnv,
		OAUTH_RESOURCE: oauthResource,
	} = c.env;

	const adminUserIds = adminUserIdsEnv
		? adminUserIdsEnv
				.split(",")
				.map((id) => id.trim())
				.filter(Boolean)
		: undefined;

	const db = getDb(DB);

	// Native clients send no Origin header, so this falls back to the request
	// host — in production `https://scorebrawl.com`, which keeps the passkey
	// rpID identical to the web app's.
	const origin =
		c.req.header("origin") ||
		`${c.req.header("x-forwarded-proto") || "https"}://${c.req.header("host") || "localhost"}`;

	// Unset in wrangler.jsonc by design (see docs/features/23-mobile-passkeys.md).
	const passkey = buildPasskeyConfig({
		requestOrigin: origin,
		rpIdOverride: (c.env as { PASSKEY_RP_ID?: string }).PASSKEY_RP_ID,
		androidKeyHashes: c.env.PASSKEY_ANDROID_APK_KEY_HASHES,
	});

	const requestOrigin = new URL(c.req.url).origin;
	const authBaseURL = resolveAuthBaseURL(c.env, requestOrigin);

	const auth = createAuth({
		db,
		betterAuthSecret,
		githubClientId,
		githubClientSecret,
		googleClientId,
		googleClientSecret,
		origin,
		passkey,
		resendApiKey,
		adminUserIds,
		oauthResource,
		baseURL: authBaseURL,
		mcpResource: resolveMcpResource(c.env, c.req.url),
	});
	// Ensure plugin init (e.g. OAuth resource seeding) completes inside the
	// request so no storage work is left floating after the response.
	await auth.$context;
	c.set("db", db);
	c.set("betterAuth", auth);
	c.set("userAssets", {
		bucketName: "scorebrawl-user-assets",
		bucket: userAssetsBucket,
	});

	await next();
});

export type AuthType = {
	user: ReturnType<typeof createAuth>["$Infer"]["Session"]["user"];
	session: ReturnType<typeof createAuth>["$Infer"]["Session"]["session"];
};
