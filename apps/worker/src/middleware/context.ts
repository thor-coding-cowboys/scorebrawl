import { createMiddleware } from "hono/factory";
import { defineRelations } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { getDb } from "../db";
import * as schema from "../db/schema";
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
		oauthToken?: { sub?: string; scope?: string };
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

	// Get origin from request for passkey configuration
	const origin =
		c.req.header("origin") ||
		`${c.req.header("x-forwarded-proto") || "https"}://${c.req.header("host") || "localhost"}`;

	const betterAuthUrl = (c.env as { BETTER_AUTH_URL?: string }).BETTER_AUTH_URL;

	const auth = createAuth({
		db,
		betterAuthSecret,
		githubClientId,
		githubClientSecret,
		googleClientId,
		googleClientSecret,
		origin,
		resendApiKey,
		adminUserIds,
		oauthResource,
		baseURL: betterAuthUrl ?? origin,
	});
	// Ensure plugin init (e.g. OAuth resource seeding) completes inside the
	// request so no storage work is left floating after the response.
	try {
		await auth.$context;
	} catch (initError) {
		console.error("[context] better-auth init failed", initError);
		return c.json(
			{
				error: "auth_init_failed",
				message: (initError as Error)?.message,
				stack: (initError as Error)?.stack,
			},
			500
		);
	}
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
	db: drizzle(undefined as unknown as D1Database, { relations: defineRelations(schema) }),
	betterAuthSecret: "",
	baseURL: "http://localhost",
});

export type AuthType = {
	user: typeof auth.$Infer.Session.user;
	session: typeof auth.$Infer.Session.session;
};
