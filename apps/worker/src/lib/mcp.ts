function hostnameOf(url: string | undefined): string | undefined {
	if (!url) return undefined;
	try {
		return new URL(url).hostname;
	} catch {
		return undefined;
	}
}

/** True when the request host is one of the configured production hosts. */
function isProdHost(
	env: { PROD_URL?: string; PROD_PUBLIC_API_URL?: string },
	hostname: string
): boolean {
	return hostname === hostnameOf(env.PROD_URL) || hostname === hostnameOf(env.PROD_PUBLIC_API_URL);
}

/**
 * Base URL for the authorization server. On the production API host this is the
 * app host (`PROD_URL`); in dev/preview (whose hosts match neither prod host) it
 * is the request origin.
 */
export function resolveAuthBaseURL(
	env: { BETTER_AUTH_URL?: string; PROD_URL?: string; PROD_PUBLIC_API_URL?: string },
	requestOrigin: string
): string {
	if (env.BETTER_AUTH_URL) return env.BETTER_AUTH_URL;
	const { hostname } = new URL(requestOrigin);
	if (hostname === hostnameOf(env.PROD_PUBLIC_API_URL) && env.PROD_URL) return env.PROD_URL;
	return requestOrigin;
}

/**
 * Canonical protected-resource identifier for the MCP server (the access-token
 * audience). Production points at the public API host; dev/preview fall back to
 * the request origin. Host-independent within a deployment, so a token issued on
 * the app host is accepted by the API host.
 */
export function resolveMcpResource(
	env: { MCP_RESOURCE_URL?: string; PROD_URL?: string; PROD_PUBLIC_API_URL?: string },
	requestURL: string
): string {
	if (env.MCP_RESOURCE_URL) return env.MCP_RESOURCE_URL;
	const { hostname, origin } = new URL(requestURL);
	if (isProdHost(env, hostname) && env.PROD_PUBLIC_API_URL) {
		return `${env.PROD_PUBLIC_API_URL}/mcp`;
	}
	return `${origin}/mcp`;
}
