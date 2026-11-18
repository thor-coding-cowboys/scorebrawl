/**
 * Paths served by the MCP-enabled auth instance rather than the lean one; see
 * `auth-instance.ts`.
 *
 * Beyond the OAuth 2.1 / OIDC endpoints and discovery documents, this includes
 * the endpoints that can resume a pending authorization. `@better-auth/oauth-provider`
 * installs hooks whose matchers are path-independent: a `before` hook reads the
 * client-supplied `oauth_query` on any request, and an `after` hook completes
 * the authorization on whichever response sets the session cookie. The web auth
 * client (`oauthProviderClient`) attaches `oauth_query` to every non-GET
 * request while the login page URL carries the signed query, so sign-in,
 * sign-up, the social callback, and passkey verification must run on the
 * MCP-enabled instance too.
 */
const MCP_AUTH_PREFIXES = [
	"/api/auth/oauth2/",
	"/api/auth/admin/oauth2/",
	"/api/auth/.well-known/",
	"/api/auth/sign-in/",
	"/api/auth/sign-up/",
	"/api/auth/callback/",
	"/api/auth/passkey/",
];

/**
 * Discovery documents served outside `/api/auth` by the MCP plugin's
 * `onRequest`; `apps/worker/src/public-api/mcp/well-known.ts` forwards them to
 * the auth handler.
 */
const MCP_WELL_KNOWN_PREFIXES = [
	"/.well-known/oauth-protected-resource",
	"/.well-known/oauth-authorization-server",
	"/.well-known/openid-configuration",
];

export function isMcpAuthPath(path: string): boolean {
	return MCP_AUTH_PREFIXES.some((prefix) => path.startsWith(prefix));
}

export function needsMcpAuthInstance(path: string): boolean {
	return isMcpAuthPath(path) || MCP_WELL_KNOWN_PREFIXES.some((prefix) => path.startsWith(prefix));
}
