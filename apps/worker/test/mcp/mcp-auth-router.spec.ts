import { describe, expect, it, beforeEach } from "vitest";
import { SELF } from "cloudflare:test";
import { authHeaders, createAuthContext } from "../setup/auth-context-util";

describe("mcp auth router", () => {
	let sessionToken: string;
	let organizationId: string;

	beforeEach(async () => {
		const ctx = await createAuthContext();
		sessionToken = ctx.sessionToken;
		organizationId = ctx.league.id;
	});

	it("authorize returns a code for the active organization", async () => {
		const res = await SELF.fetch("http://example.com/api/mcp-auth/authorize", {
			method: "POST",
			headers: { "Content-Type": "application/json", ...authHeaders(sessionToken) },
			body: JSON.stringify({}),
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as { code: string; organizationId: string };
		expect(typeof body.code).toBe("string");
		expect(body.code.length).toBeGreaterThan(20);
		expect(body.organizationId).toBe(organizationId);
	});

	it("authorize requires authentication", async () => {
		const res = await SELF.fetch("http://example.com/api/mcp-auth/authorize", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({}),
		});
		expect(res.status).toBe(401);
	});

	it("exchange swaps a code for a token", async () => {
		const authRes = await SELF.fetch("http://example.com/api/mcp-auth/authorize", {
			method: "POST",
			headers: { "Content-Type": "application/json", ...authHeaders(sessionToken) },
			body: JSON.stringify({}),
		});
		const { code } = (await authRes.json()) as { code: string };

		const exRes = await SELF.fetch("http://example.com/api/mcp-auth/exchange", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ code }),
		});
		expect(exRes.status).toBe(200);
		const body = (await exRes.json()) as { token: string; organizationId: string };
		expect(body.token.startsWith("scbr_")).toBe(true);
		expect(body.organizationId).toBe(organizationId);
	});

	it("exchange rejects an unknown code", async () => {
		const res = await SELF.fetch("http://example.com/api/mcp-auth/exchange", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ code: "not-a-real-code" }),
		});
		expect(res.status).toBe(400);
	});

	it("exchange rejects a code on second use", async () => {
		const authRes = await SELF.fetch("http://example.com/api/mcp-auth/authorize", {
			method: "POST",
			headers: { "Content-Type": "application/json", ...authHeaders(sessionToken) },
			body: JSON.stringify({}),
		});
		const { code } = (await authRes.json()) as { code: string };

		await SELF.fetch("http://example.com/api/mcp-auth/exchange", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ code }),
		});
		const second = await SELF.fetch("http://example.com/api/mcp-auth/exchange", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ code }),
		});
		expect(second.status).toBe(400);
	});
});
