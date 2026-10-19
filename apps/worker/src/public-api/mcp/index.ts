import { Hono } from "hono";
import { cors } from "hono/cors";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { createMcpProtectedRequestHandler } from "@better-auth/mcp";
import type { HonoEnv } from "../../middleware/context";
import { publicOrigin, resolveAuthBaseURL, resolveMcpResource } from "../../lib/mcp";
import { PUBLIC_RATE_LIMIT_MESSAGE, principalWithinRateLimit } from "../rate-limit";
import { createInProcessJwks } from "../../lib/jwks";
import { createMcpServer } from "./server";
import type { McpAccessTokenClaims } from "./context";

const MCP_CORS = cors({
	origin: "*",
	allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
	allowHeaders: [
		"Content-Type",
		"Authorization",
		"Mcp-Session-Id",
		"Mcp-Protocol-Version",
		"Last-Event-ID",
	],
	exposeHeaders: ["Mcp-Session-Id"],
});

/** Issuer of the OAuth authorization server (mounted under `/api/auth`). */
export function authServerIssuer(baseURL: string): string {
	return `${baseURL}/api/auth`;
}

/** Reads/parses a JSON body from a clone; the transport needs the parsed body back. */
async function parseJsonBody(request: Request): Promise<unknown> {
	if (!(request.headers.get("content-type") ?? "").includes("application/json")) return undefined;
	try {
		return await request.clone().json();
	} catch {
		return undefined;
	}
}

export const mcpRouter = new Hono<HonoEnv>()
	.use("*", MCP_CORS)
	.all("/", async (c) => {
		const baseURL = resolveAuthBaseURL(c.env, publicOrigin(c.req.raw));
		const resource = resolveMcpResource(c.env, `${publicOrigin(c.req.raw)}/mcp`);
		const db = c.get("db");
		const parsedBody = await parseJsonBody(c.req.raw);

		const protectedHandler = createMcpProtectedRequestHandler(
			{
				audience: resource,
				issuer: authServerIssuer(baseURL),
				jwksUrl: createInProcessJwks(db) as unknown as string,
				requiredScopes: ["mcp:tools"],
			},
			async (request, tokenClaims) => {
				const claims = tokenClaims as McpAccessTokenClaims;
				const principalId = claims.sub ?? claims.client_id;
				if (principalId && !(await principalWithinRateLimit(c.env, principalId))) {
					return new Response(JSON.stringify({ message: PUBLIC_RATE_LIMIT_MESSAGE }), {
						status: 429,
						headers: { "content-type": "application/json", "retry-after": "60" },
					});
				}
				const handler = createMcpHandler(() => createMcpServer({ db, claims }), {
					legacy: "stateless",
					onerror: (error) => console.error("[MCP] request failed:", error),
				});
				return handler.fetch(request, parsedBody === undefined ? undefined : { parsedBody });
			}
		);

		return protectedHandler(c.req.raw);
	})
	.all("/*", (c) => c.json({ error: "not_found" }, 404));
