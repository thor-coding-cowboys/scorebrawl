import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { getDb } from "../../src/db/index";
import { createAuth } from "../../src/lib/better-auth";
import { createAuthContext, createLeague } from "../setup/auth-context-util";

const MCP_URL = "http://localhost/mcp";
const AS_ISSUER = "http://localhost/api/auth";

// `auth.api.signJWT` signs an explicit `body.payload`; better-auth 1.7.10 honors
// caller-supplied `iss`/`aud`/`exp` overrides (setIssuer/setAudience/setExpirationTime
// fall back to defaults only when the payload omits them) and passes arbitrary claims
// like `scope` through jose's JWTClaimsBuilder.
async function signToken(payload: Record<string, unknown>): Promise<string> {
	const auth = createAuth({
		db: getDb(env.DB),
		betterAuthSecret: env.BETTER_AUTH_SECRET,
		baseURL: "http://localhost",
	});
	await auth.$context;
	const { token } = await auth.api.signJWT({ body: { payload } });
	return token;
}

function bearer(token: string) {
	return {
		method: "POST",
		headers: {
			"content-type": "application/json",
			accept: "application/json, text/event-stream",
			authorization: `Bearer ${token}`,
		},
	};
}

const initialize = {
	method: "POST",
	headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
	body: JSON.stringify({
		jsonrpc: "2.0",
		id: 1,
		method: "initialize",
		params: {
			protocolVersion: "2025-11-25",
			capabilities: {},
			clientInfo: { name: "mcp-test-client", version: "1.0.0" },
		},
	}),
};

function mcpCall(token: string, id: number, method: string, params?: unknown) {
	return SELF.fetch(MCP_URL, {
		...bearer(token),
		body: JSON.stringify({
			jsonrpc: "2.0",
			id,
			method,
			...(params === undefined ? {} : { params }),
		}),
	});
}

async function body(res: Response): Promise<any> {
	const text = await res.text();
	if (!res.headers.get("content-type")?.includes("text/event-stream")) return JSON.parse(text);
	const line = text
		.split("\n")
		.filter((l) => l.startsWith("data:"))
		.pop()
		?.slice(5)
		.trim();
	return line ? JSON.parse(line) : undefined;
}

describe("POST /mcp", () => {
	it("challenges unauthenticated requests with RFC 9728 metadata", async () => {
		const res = await SELF.fetch(MCP_URL, initialize);
		expect(res.status).toBe(401);
		expect(res.headers.get("www-authenticate")).toContain("resource_metadata=");
	});

	it("accepts a token with the right iss/aud/scope", async () => {
		const token = await signToken({
			sub: "user_1",
			iss: AS_ISSUER,
			aud: MCP_URL,
			scope: "mcp:tools",
		});
		const res = await SELF.fetch(MCP_URL, {
			...initialize,
			headers: { ...initialize.headers, authorization: `Bearer ${token}` },
		});
		expect(res.status).toBe(200);
		const parsed = await body(res);
		expect(parsed.result.serverInfo).toEqual({ name: "scorebrawl", version: "1.0.0" });
	});

	it("rejects a wrong audience", async () => {
		const token = await signToken({
			sub: "user_1",
			iss: AS_ISSUER,
			aud: "http://evil/mcp",
			scope: "mcp:tools",
		});
		const res = await SELF.fetch(MCP_URL, {
			...initialize,
			headers: { ...initialize.headers, authorization: `Bearer ${token}` },
		});
		expect(res.status).toBe(401);
	});

	it("rejects a wrong issuer", async () => {
		const token = await signToken({
			sub: "user_1",
			iss: "http://evil/api/auth",
			aud: MCP_URL,
			scope: "mcp:tools",
		});
		const res = await SELF.fetch(MCP_URL, {
			...initialize,
			headers: { ...initialize.headers, authorization: `Bearer ${token}` },
		});
		expect(res.status).toBe(401);
	});

	it("rejects a token missing mcp:tools with insufficient_scope", async () => {
		const token = await signToken({ sub: "user_1", iss: AS_ISSUER, aud: MCP_URL, scope: "openid" });
		const res = await SELF.fetch(MCP_URL, {
			...initialize,
			headers: { ...initialize.headers, authorization: `Bearer ${token}` },
		});
		expect(res.status).toBe(403);
		expect(res.headers.get("www-authenticate")).toContain("insufficient_scope");
	});

	it("rejects an expired token", async () => {
		const token = await signToken({
			sub: "user_1",
			iss: AS_ISSUER,
			aud: MCP_URL,
			scope: "mcp:tools",
			exp: Math.floor(Date.now() / 1000) - 60,
		});
		const res = await SELF.fetch(MCP_URL, {
			...initialize,
			headers: { ...initialize.headers, authorization: `Bearer ${token}` },
		});
		expect(res.status).toBe(401);
	});

	it("returns 404 for unknown subpaths under /mcp", async () => {
		const res = await SELF.fetch(`${MCP_URL}/foo`, initialize);
		expect(res.status).toBe(404);
	});

	it("lists whoami, list_leagues and the data tools (no render_chart)", async () => {
		const token = await signToken({
			sub: "user_1",
			iss: AS_ISSUER,
			aud: MCP_URL,
			scope: "mcp:tools",
		});
		const res = await mcpCall(token, 2, "tools/list");
		const parsed = await body(res);
		const names = parsed.result.tools.map((t: { name: string }) => t.name);
		expect(names).toContain("whoami");
		expect(names).toContain("list_leagues");
		expect(names).toContain("get_players");
		expect(names).not.toContain("render_chart");
	});
});

describe("MCP league resolution", () => {
	it("resolves a single-league user without a league argument", async () => {
		const ctx = await createAuthContext({ league: { name: "Alpha League" } });
		const token = await signToken({
			sub: ctx.user.id,
			iss: AS_ISSUER,
			aud: MCP_URL,
			scope: "mcp:tools",
		});

		const listRes = await mcpCall(token, 3, "tools/call", { name: "list_leagues", arguments: {} });
		const listParsed = await body(listRes);
		const leagues = JSON.parse(listParsed.result.content[0].text) as Array<{
			id: string;
			slug: string;
			role: string;
		}>;
		expect(leagues.map((l) => l.id)).toEqual([ctx.league.id]);
		expect(leagues[0].slug).toBe(ctx.league.slug);
		expect(leagues[0].role).toBe("owner");

		const seasonsRes = await mcpCall(token, 4, "tools/call", {
			name: "get_seasons",
			arguments: {},
		});
		const seasonsParsed = await body(seasonsRes);
		expect(seasonsParsed.result.isError).toBeUndefined();
		expect(JSON.parse(seasonsParsed.result.content[0].text)).toEqual([]);
	});

	it("requires the league argument when the user belongs to multiple leagues", async () => {
		const ctx = await createAuthContext({ league: { name: "Alpha League" } });
		const second = await createLeague(ctx.sessionToken, { name: "Beta League" });
		const token = await signToken({
			sub: ctx.user.id,
			iss: AS_ISSUER,
			aud: MCP_URL,
			scope: "mcp:tools",
		});

		const res = await mcpCall(token, 5, "tools/call", { name: "get_seasons", arguments: {} });
		const parsed = await body(res);
		expect(parsed.result.isError).toBe(true);
		const message = parsed.result.content[0].text as string;
		expect(message).toContain("multiple leagues");
		expect(message).toContain(ctx.league.slug);
		expect(message).toContain(second.slug);
	});

	it("reports available slugs for an unknown league argument", async () => {
		const ctx = await createAuthContext({ league: { name: "Alpha League" } });
		const token = await signToken({
			sub: ctx.user.id,
			iss: AS_ISSUER,
			aud: MCP_URL,
			scope: "mcp:tools",
		});

		const res = await mcpCall(token, 6, "tools/call", {
			name: "get_seasons",
			arguments: { league: "no-such-league" },
		});
		const parsed = await body(res);
		expect(parsed.result.isError).toBe(true);
		const message = parsed.result.content[0].text as string;
		expect(message).toContain("no-such-league");
		expect(message).toContain(ctx.league.slug);
	});
});

describe("MCP discovery + host scope", () => {
	it("serves protected-resource metadata on the api host", async () => {
		const res = await SELF.fetch(
			"https://api.scorebrawl.com/.well-known/oauth-protected-resource/mcp"
		);
		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({ resource: expect.stringContaining("/mcp") });
	});

	it("blocks /mcp on the app host", async () => {
		const res = await SELF.fetch("https://scorebrawl.com/mcp", initialize);
		expect(res.status).toBe(404);
	});
});

describe("MCP dynamic client registration", () => {
	it("serves dynamic client registration", async () => {
		const res = await SELF.fetch("http://localhost/api/auth/oauth2/register", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				client_name: "mcp dcr test",
				redirect_uris: ["https://client.example/callback"],
				token_endpoint_auth_method: "none",
				grant_types: ["authorization_code"],
				response_types: ["code"],
			}),
		});
		expect(res.status).toBe(201);
		const { client_id: clientId } = (await res.json()) as { client_id: string };
		expect(clientId).toBeTruthy();
	});
});
