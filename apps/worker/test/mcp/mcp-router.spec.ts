import { describe, expect, it, beforeEach } from "vitest";
import { SELF } from "cloudflare:test";
import { bearerHeaders, createAuthContext } from "../setup/auth-context-util";

describe("mcp router", () => {
	let sessionToken: string;

	beforeEach(async () => {
		const ctx = await createAuthContext();
		sessionToken = ctx.sessionToken;
	});

	const mcpRequest = (method: string, params?: Record<string, unknown>) => ({
		jsonrpc: "2.0",
		id: 1,
		method,
		params,
	});

	it("returns 401 without a bearer token", async () => {
		const res = await SELF.fetch("http://example.com/api/mcp", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(mcpRequest("tools/list")),
		});
		expect(res.status).toBe(401);
	});

	it("returns 401 for an unknown token", async () => {
		const res = await SELF.fetch("http://example.com/api/mcp", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...bearerHeaders("not_a_real_token"),
			},
			body: JSON.stringify(mcpRequest("tools/list")),
		});
		expect(res.status).toBe(401);
	});

	it("responds to initialize with a valid bearer token", async () => {
		const res = await SELF.fetch("http://example.com/api/mcp", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...bearerHeaders(sessionToken),
			},
			body: JSON.stringify(mcpRequest("initialize")),
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as { result: { protocolVersion: string } };
		expect(body.result.protocolVersion).toBe("2024-11-05");
	});

	it("lists tools", async () => {
		const res = await SELF.fetch("http://example.com/api/mcp", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...bearerHeaders(sessionToken),
			},
			body: JSON.stringify(mcpRequest("tools/list")),
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as { result: { tools: Array<{ name: string }> } };
		expect(body.result.tools).toBeInstanceOf(Array);
		expect(body.result.tools.length).toBeGreaterThan(0);
		expect(body.result.tools.some((t) => t.name === "get_players")).toBe(true);
	});

	it("uses the token's organization for tool calls", async () => {
		const res = await SELF.fetch("http://example.com/api/mcp", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...bearerHeaders(sessionToken),
			},
			body: JSON.stringify(
				mcpRequest("tools/call", {
					name: "get_players",
					arguments: {},
				})
			),
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as { result: { content: Array<{ type: string }> } };
		expect(Array.isArray(body.result.content)).toBe(true);
	});
});
