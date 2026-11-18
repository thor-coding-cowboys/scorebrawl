const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function isLocalHostname(hostname: string): boolean {
	return LOOPBACK_HOSTNAMES.has(hostname) || hostname.endsWith(".localhost");
}

/**
 * Origin used for security-sensitive auth config (baseURL, trusted origins,
 * passkey rpID, MCP resource).
 *
 * The request URL is authoritative. Cloudflare does not rewrite a
 * client-supplied `x-forwarded-host` on public hosts, so forwarded headers are
 * only honoured for local development proxies, where both the request URL and
 * the forwarded host are loopback/`.localhost`.
 */
export function resolveRequestOrigin(request: Request): string {
	const url = new URL(request.url);
	const forwardedHost = request.headers.get("x-forwarded-host");
	if (!forwardedHost) return url.origin;

	let forwarded: URL;
	try {
		const proto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
		forwarded = new URL(`${proto}://${forwardedHost}`);
	} catch {
		return url.origin;
	}

	if (!isLocalHostname(url.hostname) || !isLocalHostname(forwarded.hostname)) {
		return url.origin;
	}

	return forwarded.origin;
}
