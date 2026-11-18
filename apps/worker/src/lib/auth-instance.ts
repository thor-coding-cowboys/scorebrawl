import { getDb } from "../db";
import { createAuth } from "./better-auth";
import type { PasskeyConfig } from "./passkey-config";

export type AuthInstanceConfig = {
	baseURL: string;
	origin: string;
	passkey: PasskeyConfig;
	mcpResource: string;
};

type Auth = ReturnType<typeof createAuth>;

export type AuthInstance = {
	auth: Auth;
	ready: Promise<Auth>;
};

/**
 * One Better Auth instance per isolate and deployment configuration. Building
 * the instance initializes every plugin (jwks, mcp, passkey, apiKey, ...), which
 * is far too much work to repeat on each request.
 */
const cache = new Map<string, AuthInstance>();

function parseAdminUserIds(raw?: string): string[] | undefined {
	if (!raw) return undefined;
	const ids = raw
		.split(",")
		.map((id) => id.trim())
		.filter(Boolean);
	return ids.length > 0 ? ids : undefined;
}

function stripTrailingSlash(value?: string): string | undefined {
	if (!value) return undefined;
	return value.replace(/\/+$/, "");
}

function emulateUrls(env: Env) {
	const emulated = env as Env & {
		EMULATE_GOOGLE_URL?: string;
		EMULATE_GITHUB_URL?: string;
	};
	return {
		googleUrl: stripTrailingSlash(emulated.EMULATE_GOOGLE_URL),
		githubUrl: stripTrailingSlash(emulated.EMULATE_GITHUB_URL),
	};
}

/**
 * Deployment values that shape the instance. Request-scoped values are part of
 * `config`, so a host, rpID or MCP resource change cannot reuse an instance
 * configured for another one.
 */
export function authInstanceKey(env: Env, config: AuthInstanceConfig): string {
	return JSON.stringify([
		env.BETTER_AUTH_SECRET,
		env.VITE_GITHUB_CLIENT_ID,
		env.GITHUB_CLIENT_SECRET,
		env.VITE_GOOGLE_CLIENT_ID,
		env.GOOGLE_CLIENT_SECRET,
		env.ADMIN_USER_IDS,
		env.RESEND_API_KEY,
		env.OAUTH_RESOURCE,
		config.baseURL,
		config.origin,
		config.passkey.rpID,
		config.passkey.origin,
		config.mcpResource,
		emulateUrls(env),
	]);
}

export function getAuthInstance(
	env: Env,
	config: AuthInstanceConfig,
	options: { waitUntil?: (promise: Promise<unknown>) => void } = {}
): AuthInstance {
	const key = authInstanceKey(env, config);
	const cached = cache.get(key);
	if (cached) return cached;

	const auth = createAuth({
		db: getDb(env.DB),
		betterAuthSecret: env.BETTER_AUTH_SECRET,
		githubClientId: env.VITE_GITHUB_CLIENT_ID,
		githubClientSecret: env.GITHUB_CLIENT_SECRET,
		googleClientId: env.VITE_GOOGLE_CLIENT_ID,
		googleClientSecret: env.GOOGLE_CLIENT_SECRET,
		origin: config.origin,
		passkey: config.passkey,
		resendApiKey: env.RESEND_API_KEY,
		adminUserIds: parseAdminUserIds(env.ADMIN_USER_IDS),
		oauthResource: env.OAUTH_RESOURCE,
		baseURL: config.baseURL,
		mcpResource: config.mcpResource,
		emulate: emulateUrls(env),
	});

	// The init promise is created inside the first request that builds the
	// instance. Anchor it so an aborted request cannot strand it, and drop the
	// entry on failure so the next request retries instead of reusing a broken
	// instance.
	const ready = auth.$context.then(
		() => auth,
		(error) => {
			if (cache.get(key)?.auth === auth) cache.delete(key);
			throw error;
		}
	);
	const entry: AuthInstance = { auth, ready };
	cache.set(key, entry);
	options.waitUntil?.(ready.catch(() => {}));
	return entry;
}

/** Clears the per-isolate cache. Tests call this because isolated storage rolls
 * back between tests while a cached instance keeps plugin state from the previous one. */
export function clearAuthInstanceCache(): void {
	cache.clear();
}
