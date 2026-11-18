import { getDb } from "../db";
import { createAuth } from "./better-auth";
import type { PasskeyConfig } from "./passkey-config";

export type AuthInstanceConfig = {
	baseURL: string;
	origin: string;
	passkey: PasskeyConfig;
	mcpResource: string;
};

type AuthOptions = Parameters<typeof createAuth>[0];
type Auth = ReturnType<typeof createAuth>;

export type AuthInstance = {
	auth: Auth;
	ready: Promise<Auth>;
};

/**
 * One Better Auth instance per isolate and deployment configuration. Building
 * the instance initializes every plugin (jwks, mcp, passkey, apiKey, ...), which
 * is far too much work to repeat on each request.
 *
 * Bounded because the key includes the request origin: production has at most
 * two origins, and the cap keeps any unexpected variation from growing isolate
 * memory.
 */
export const MAX_CACHED_AUTH_INSTANCES = 4;

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

function emulateUrls(env: Env): NonNullable<AuthOptions["emulate"]> {
	const emulated = env as Env & {
		EMULATE_GOOGLE_URL?: string;
		EMULATE_GITHUB_URL?: string;
	};
	return {
		googleUrl: stripTrailingSlash(emulated.EMULATE_GOOGLE_URL),
		githubUrl: stripTrailingSlash(emulated.EMULATE_GITHUB_URL),
	};
}

/** Everything that shapes the instance except the D1 handle. */
function authOptions(env: Env, config: AuthInstanceConfig): Omit<AuthOptions, "db"> {
	return {
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
	};
}

/** Derived from the options object so a new option cannot be forgotten here. */
export function authInstanceKey(options: Omit<AuthOptions, "db">): string {
	return JSON.stringify(options);
}

function remember(key: string, entry: AuthInstance): void {
	cache.delete(key);
	cache.set(key, entry);
	while (cache.size > MAX_CACHED_AUTH_INSTANCES) {
		const oldest = cache.keys().next().value;
		if (oldest === undefined) break;
		cache.delete(oldest);
	}
}

export function getAuthInstance(
	env: Env,
	config: AuthInstanceConfig,
	options: { waitUntil?: (promise: Promise<unknown>) => void } = {}
): AuthInstance {
	const instanceOptions = authOptions(env, config);
	const key = authInstanceKey(instanceOptions);

	const cached = cache.get(key);
	if (cached) {
		remember(key, cached);
		return cached;
	}

	const auth = createAuth({ db: getDb(env.DB), ...instanceOptions });

	// `ready` is created inside the first request that builds the instance and
	// awaited by later ones. It is anchored with waitUntil below so the runtime
	// keeps it alive across requests (the Worker opts out of
	// `handle_cross_request_promise_resolution`). On failure the entry is dropped
	// so the next request retries instead of reusing a broken instance.
	const ready = auth.$context.then(
		() => auth,
		(error) => {
			if (cache.get(key)?.auth === auth) cache.delete(key);
			throw error;
		}
	);
	const entry: AuthInstance = { auth, ready };
	remember(key, entry);
	options.waitUntil?.(ready.catch(() => {}));
	return entry;
}

/** Clears the per-isolate cache. Tests call this because isolated storage rolls
 * back between tests while a cached instance keeps plugin state from the previous one. */
export function clearAuthInstanceCache(): void {
	cache.clear();
}
