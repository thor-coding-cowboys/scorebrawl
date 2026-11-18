import { mcp } from "@better-auth/mcp";
import type { BetterAuthPlugin } from "better-auth";

/**
 * The MCP plugin pulls in `@better-auth/oauth-provider` (OAuth 2.1 / OIDC
 * server, ~400 kB of plugin code) at module scope. Only the MCP-enabled auth
 * instance imports this file, and only through `await import(...)`, so ordinary
 * app auth never evaluates it.
 */
export const MCP_SCOPES = [
	"openid",
	"profile",
	"email",
	"offline_access",
	"create:matches",
	"read:matches",
	"read:leagues",
	"read:seasons",
	"mcp:tools",
];

export function createMcpPlugin({
	baseURL,
	origin,
	mcpResource,
	oauthResource,
}: {
	baseURL?: string;
	origin?: string;
	mcpResource?: string;
	oauthResource?: string;
}): BetterAuthPlugin {
	return mcp({
		loginPage: "/auth/sign-in",
		consentPage: "/consent",
		resource: mcpResource ?? `${baseURL ?? origin ?? "http://localhost"}/mcp`,
		resources: oauthResource ? [oauthResource] : [],
		scopes: MCP_SCOPES,
		enforcePerClientResources: false,
		allowDynamicClientRegistration: true,
		allowUnauthenticatedClientRegistration: true,
	});
}
