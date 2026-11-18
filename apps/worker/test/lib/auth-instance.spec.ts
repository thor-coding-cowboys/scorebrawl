import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { getAuthInstance, type AuthInstanceConfig } from "../../src/lib/auth-instance";
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

		expect(second.auth).toBe(first.auth);
		await first.ready;
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

		expect(preview.auth).not.toBe(web.auth);
		await Promise.all([web.ready, preview.ready]);
	});

	it("creates a separate instance when the auth secret differs", async () => {
		const current = getAuthInstance(env, config());
		const rotated = getAuthInstance(
			{ ...env, BETTER_AUTH_SECRET: "rotated-test-secret-0123456789abcdef" } as Env,
			config()
		);

		expect(rotated.auth).not.toBe(current.auth);
		await Promise.all([current.ready, rotated.ready]);
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

		await entry.ready;

		expect(anchored).toHaveLength(1);
		await expect(anchored[0]).resolves.toBe(entry.auth);
	});
});
