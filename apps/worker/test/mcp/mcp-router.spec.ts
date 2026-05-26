import { describe, expect, it, beforeEach } from "vitest";
import { SELF } from "cloudflare:test";
import { createAuthContext, authHeaders } from "../setup/auth-context-util";

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

	it("returns 401 without authentication", async () => {
		const res = await SELF.fetch("http://example.com/api/mcp", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(mcpRequest("tools/list")),
		});
		expect(res.status).toBe(401);
	});

	it("returns 400 when no active organization is set", async () => {
		const { createUser } = await import("../setup/auth-context-util");
		const { sessionToken: noOrgToken } = await createUser();

		const res = await SELF.fetch("http://example.com/api/mcp", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...authHeaders(noOrgToken),
			},
			body: JSON.stringify(mcpRequest("tools/list")),
		});
		expect(res.status).toBe(400);
		const body = (await res.json()) as { error: { message: string } };
		expect(body.error.message).toContain("No active league");
	});

	it("responds to initialize", async () => {
		const res = await SELF.fetch("http://example.com/api/mcp", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...authHeaders(sessionToken),
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
				...authHeaders(sessionToken),
			},
			body: JSON.stringify(mcpRequest("tools/list")),
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as { result: { tools: Array<{ name: string }> } };
		expect(body.result.tools).toBeInstanceOf(Array);
		expect(body.result.tools.length).toBeGreaterThan(0);
		expect(body.result.tools.some((t) => t.name === "get_players")).toBe(true);
	});

	it("calls get_players tool", async () => {
		const res = await SELF.fetch("http://example.com/api/mcp", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...authHeaders(sessionToken),
			},
			body: JSON.stringify(
				mcpRequest("tools/call", {
					name: "get_players",
					arguments: {},
				})
			),
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as { result: { content: Array<{ text: string }> } };
		expect(body.result.content).toBeInstanceOf(Array);
		expect(body.result.content[0].type).toBe("text");
		const parsed = JSON.parse(body.result.content[0].text);
		expect(parsed).toBeInstanceOf(Array);
	});

	it("returns error for unknown tool", async () => {
		const res = await SELF.fetch("http://example.com/api/mcp", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...authHeaders(sessionToken),
			},
			body: JSON.stringify(
				mcpRequest("tools/call", {
					name: "nonexistent_tool",
					arguments: {},
				})
			),
		});
		expect(res.status).toBe(404);
		const body = (await res.json()) as { error: { message: string } };
		expect(body.error.message).toContain("nonexistent_tool");
	});

	it("returns error for unknown method", async () => {
		const res = await SELF.fetch("http://example.com/api/mcp", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...authHeaders(sessionToken),
			},
			body: JSON.stringify(mcpRequest("unknown/method")),
		});
		expect(res.status).toBe(404);
		const body = (await res.json()) as { error: { message: string } };
		expect(body.error.message).toContain("unknown/method");
	});
});
