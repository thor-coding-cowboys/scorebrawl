import { createMiddleware } from "hono/factory";
import { getDb } from "../db";
import { createAuth } from "../lib/better-auth";
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
	} = c.env;
	const db = getDb(DB);

	// Get origin from request for passkey configuration
	const origin =
		c.req.header("origin") ||
		`${c.req.header("x-forwarded-proto") || "https"}://${c.req.header("host") || "localhost"}`;

	// Determine if production based on origin (localhost/127.0.0.1 = dev)
	const isProduction = !(origin.includes("localhost") || origin.includes("127.0.0.1"));

	const auth = createAuth({
		db,
		betterAuthSecret,
		githubClientId,
		githubClientSecret,
		googleClientId,
		googleClientSecret,
		origin,
		resendApiKey,
		isProduction,
	});
	c.set("db", db);
	c.set("betterAuth", auth);
	c.set("userAssets", {
		bucketName: "scorebrawl-user-assets",
		bucket: userAssetsBucket,
	});

	await next();
});

// for better auth cli
export const auth = createAuth({
	db: undefined as unknown as ReturnType<typeof getDb>,
	betterAuthSecret: "",
});

export type AuthType = {
	user: typeof auth.$Infer.Session.user;
	session: typeof auth.$Infer.Session.session;
};
