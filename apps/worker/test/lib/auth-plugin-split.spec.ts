import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { createAuthContext, authHeaders } from "../setup/auth-context-util";
import { createTRPCTestClient } from "../trpc/trpc-test-client";

const url = (path: string) => `http://example.com${path}`;

describe("auth plugin split", () => {
	it("serves get-session from the lean instance", async () => {
		const ctx = await createAuthContext();

		const res = await SELF.fetch(url("/api/auth/get-session"), {
			headers: authHeaders(ctx.sessionToken),
		});

		expect(res.status).toBe(200);
		const body = (await res.json()) as { user: { id: string } } | null;
		expect(body?.user.id).toBe(ctx.user.id);
	});

	it("keeps verifyApiKey working for personal API keys", async () => {
		const ctx = await createAuthContext();
		const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });
		const { key } = await client.personalApiKey.create.mutate({
			name: "split",
			scopes: ["profile:read"],
			expiry: "never",
		});

		const res = await SELF.fetch(url("/v1/me"), { headers: { "x-api-key": key } });

		expect(res.status).toBe(200);
		const body = (await res.json()) as { user: { id: string } };
		expect(body.user.id).toBe(ctx.user.id);
	});

	it("keeps passkey endpoints reachable", async () => {
		const ctx = await createAuthContext();

		const res = await SELF.fetch(url("/api/auth/passkey/list-user-passkeys"), {
			headers: authHeaders(ctx.sessionToken),
		});

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual([]);
	});

	it("serves OAuth discovery from the MCP instance", async () => {
		const res = await SELF.fetch(url("/api/auth/.well-known/openid-configuration"));

		// The lean instance has no such endpoint (404).
		expect(res.status).toBe(200);
		const body = (await res.json()) as { issuer: string };
		expect(body.issuer).toBe("http://localhost/api/auth");
	});

	it("serves the protected-resource metadata from the MCP instance", async () => {
		const res = await SELF.fetch(url("/.well-known/oauth-protected-resource"));

		expect(res.status).toBe(200);
		const body = (await res.json()) as { resource: string; authorization_servers: string[] };
		expect(body.resource).toBe("http://localhost/mcp");
		expect(body.authorization_servers).toEqual(["http://localhost/api/auth"]);
	});
});
