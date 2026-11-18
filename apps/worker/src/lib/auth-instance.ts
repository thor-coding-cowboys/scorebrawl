import { getDb } from "../db";
import { createAuth } from "./better-auth";
import { loadMcpPluginModule } from "./auth-mcp-loader";
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
	/** Resolves once the instance exists and its `$context` is ready. */
	ready: Promise<Auth>;
};

/**
 * Two Better Auth instances per isolate and deployment configuration: the lean
 * one that serves ordinary app auth, and the MCP-enabled one that adds
 * `@better-auth/mcp` (OAuth 2.1 / OIDC provider). Building either instance
 * initializes every plugin (jwks, passkey, apiKey, ...), which is far too much
 * work to repeat on each request.
 *
 * Bounded because the key includes the request origin: production has at most
 * two origins, and the cap keeps any unexpected variation from growing isolate
 * memory.
 */
export const MAX_CACHED_AUTH_INSTANCES = 4;

type AuthInstanceKind = "app" | "mcp";

/** Separate maps so the same config yields one lean and one MCP instance. */
const caches: Record<AuthInstanceKind, Map<string, AuthInstance>> = {
	app: new Map(),
	mcp: new Map(),
};

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

function lookup(kind: AuthInstanceKind, key: string): AuthInstance | undefined {
	const cache = caches[kind];
	const found = cache.get(key);
	if (!found) return undefined;
	// Refresh recency: Map keeps insertion order, so re-insert at the end.
	cache.delete(key);
	cache.set(key, found);
	return found;
}

function remember(kind: AuthInstanceKind, key: string, entry: AuthInstance): void {
	const cache = caches[kind];
	cache.delete(key);
	cache.set(key, entry);
	while (cache.size > MAX_CACHED_AUTH_INSTANCES) {
		const oldest = cache.keys().next().value;
		if (oldest === undefined) break;
		cache.delete(oldest);
	}
}

/**
 * Caches, anchors and evicts an initialization promise. `create` may be async
 * (the MCP instance dynamically imports its plugin). The anchor matters because
 * the Worker opts out of `handle_cross_request_promise_resolution`; on failure
 * the entry is dropped so the next request retries instead of reusing a broken
 * instance.
 */
function cacheInstance(
	kind: AuthInstanceKind,
	key: string,
	create: () => Promise<Auth>,
	waitUntil?: (promise: Promise<unknown>) => void
): AuthInstance {
	const ready = create().then(async (auth) => {
		await auth.$context;
		return auth;
	});
	const entry: AuthInstance = { ready };
	remember(kind, key, entry);
	waitUntil?.(ready.catch(() => {}));
	void ready.catch(() => {
		if (caches[kind].get(key) === entry) caches[kind].delete(key);
	});
	return entry;
}

export function getAuthInstance(
	env: Env,
	config: AuthInstanceConfig,
	options: { waitUntil?: (promise: Promise<unknown>) => void } = {}
): AuthInstance {
	const instanceOptions = authOptions(env, config);
	const key = authInstanceKey(instanceOptions);

	const cached = lookup("app", key);
	if (cached) return cached;

	return cacheInstance(
		"app",
		key,
		async () => createAuth({ db: getDb(env.DB), ...instanceOptions }),
		options.waitUntil
	);
}

/**
 * MCP-enabled instance. Callers must route only MCP/OAuth paths here (see
 * `auth-mcp-paths.ts`). The plugin is constructed from a dynamically imported
 * module, so ordinary requests skip its factory, API method registration and
 * init-time seeding. (`@better-auth/mcp` itself is already in the bundle
 * because the `/mcp` route imports `createMcpProtectedRequestHandler`.)
 */
export function getMcpAuthInstance(
	env: Env,
	config: AuthInstanceConfig,
	options: { waitUntil?: (promise: Promise<unknown>) => void } = {}
): AuthInstance {
	const instanceOptions = authOptions(env, config);
	const key = authInstanceKey(instanceOptions);

	const cached = lookup("mcp", key);
	if (cached) return cached;

	return cacheInstance(
		"mcp",
		key,
		async () => {
			const { createMcpPlugin } = await loadMcpPluginModule();
			return createAuth({
				db: getDb(env.DB),
				...instanceOptions,
				mcpPlugin: createMcpPlugin(instanceOptions),
			});
		},
		options.waitUntil
	);
}

/** Clears the per-isolate cache. Tests call this because isolated storage rolls
 * back between tests while a cached instance keeps plugin state from the previous one. */
export function clearAuthInstanceCache(): void {
	for (const cache of Object.values(caches)) cache.clear();
}
