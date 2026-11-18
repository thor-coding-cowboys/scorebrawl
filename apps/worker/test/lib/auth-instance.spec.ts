import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import {
	MAX_CACHED_AUTH_INSTANCES,
	getAuthInstance,
	getMcpAuthInstance,
	type AuthInstanceConfig,
} from "../../src/lib/auth-instance";
import { buildPasskeyConfig } from "../../src/lib/passkey-config";

function config(overrides: Partial<AuthInstanceConfig> = {}): AuthInstanceConfig {
	return {
		baseURL: "https://scorebrawl.com",
		origin: "https://scorebrawl.com",
		passkey: buildPasskeyConfig({ requestOrigin: "https://scorebrawl.com" }),
		mcpResource: "https://api.scorebrawl.com/mcp",
		...overrides,
	};
}

describe("getAuthInstance", () => {
	it("reuses one instance per isolate for an identical config", async () => {
		const first = getAuthInstance(env, config());
		const second = getAuthInstance(env, config());

		expect(second).toBe(first);
		expect(await second.ready).toBe(await first.ready);
	});

	it("creates a separate instance for a different base URL", async () => {
		const web = getAuthInstance(env, config());
		const preview = getAuthInstance(
			env,
			config({
				baseURL: "https://pr-1.scorebrawl.workers.dev",
				origin: "https://pr-1.scorebrawl.workers.dev",
				passkey: buildPasskeyConfig({ requestOrigin: "https://pr-1.scorebrawl.workers.dev" }),
				mcpResource: "https://pr-1.scorebrawl.workers.dev/mcp",
			})
		);

		expect(await preview.ready).not.toBe(await web.ready);
	});

	it("creates a separate instance when the auth secret differs", async () => {
		const current = getAuthInstance(env, config());
		const rotated = getAuthInstance(
			{ ...env, BETTER_AUTH_SECRET: "rotated-test-secret-0123456789abcdef" } as Env,
			config()
		);

		expect(await rotated.ready).not.toBe(await current.ready);
	});

	it("anchors initialization with waitUntil and resolves ready", async () => {
		const anchored: Promise<unknown>[] = [];
		const entry = getAuthInstance(
			env,
			config({
				baseURL: "https://anchor.example",
				origin: "https://anchor.example",
				passkey: buildPasskeyConfig({ requestOrigin: "https://anchor.example" }),
				mcpResource: "https://anchor.example/mcp",
			}),
			{ waitUntil: (promise) => anchored.push(promise) }
		);

		const auth = await entry.ready;

		expect(anchored).toHaveLength(1);
		await expect(anchored[0]).resolves.toBe(auth);
	});

	it("bounds the cache and evicts the least recently used instance", async () => {
		const configs = Array.from({ length: MAX_CACHED_AUTH_INSTANCES + 1 }, (_, index) => {
			const baseURL = `https://cache-${index}.example`;
			return config({
				baseURL,
				origin: baseURL,
				passkey: buildPasskeyConfig({ requestOrigin: baseURL }),
				mcpResource: `${baseURL}/mcp`,
			});
		});
		const entries = configs.map((entry) => getAuthInstance(env, entry));
		const firstAuth = await entries[0]!.ready;

		const rebuilt = getAuthInstance(env, configs[0]!);

		expect(await rebuilt.ready).not.toBe(firstAuth);
	});
});

describe("getMcpAuthInstance", () => {
	it("caches the MCP instance separately from the lean instance", async () => {
		const lean = getAuthInstance(env, config());
		const mcp = getMcpAuthInstance(env, config());

		expect(mcp).not.toBe(lean);
		expect(getMcpAuthInstance(env, config())).toBe(mcp);
		expect(await mcp.ready).not.toBe(await lean.ready);

		// Each kind keeps its own LRU, so the lean entry is still cached.
		expect(getAuthInstance(env, config())).toBe(lean);
	});

	it("serves the OAuth endpoints the lean instance does not have", async () => {
		const lean = await getAuthInstance(env, config()).ready;
		const mcp = await getMcpAuthInstance(env, config()).ready;

		expect(Object.keys(lean.api)).not.toContain("adminCreateOAuthClient");
		expect(Object.keys(mcp.api)).toContain("adminCreateOAuthClient");
	});

	it("anchors the lazily imported instance and resolves ready", async () => {
		const anchored: Promise<unknown>[] = [];
		const entry = getMcpAuthInstance(
			env,
			config({
				baseURL: "https://mcp-anchor.example",
				origin: "https://mcp-anchor.example",
				passkey: buildPasskeyConfig({ requestOrigin: "https://mcp-anchor.example" }),
				mcpResource: "https://mcp-anchor.example/mcp",
			}),
			{ waitUntil: (promise) => anchored.push(promise) }
		);

		const auth = await entry.ready;

		expect(anchored).toHaveLength(1);
		await expect(anchored[0]).resolves.toBe(auth);
	});
});
