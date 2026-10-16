import { createMiddleware } from "hono/factory";
import type { HonoEnv } from "../middleware/context";

export const PUBLIC_API_PREFIXES = ["/v1", "/leagues/v1"] as const;

export function isPublicApiPath(pathname: string): boolean {
	if (pathname === "/mcp" || pathname.startsWith("/mcp/")) return true;
	if (pathname.startsWith("/.well-known/oauth-protected-resource")) return true;
	return PUBLIC_API_PREFIXES.some(
		(prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
	);
}

function hostnameOf(url: string | undefined): string | undefined {
	if (!url) return undefined;
	try {
		return new URL(url).hostname;
	} catch {
		return undefined;
	}
}

/**
 * Prod splits the single worker by host: public API paths only on the API host,
 * everything else only on the app host. When either var is unset or the request
 * host matches neither (previews, local), both surfaces are reachable.
 */
export const enforceHostScope = createMiddleware<HonoEnv>(async (c, next) => {
	const appHost = hostnameOf(c.env.PROD_URL);
	const apiHost = hostnameOf(c.env.PROD_PUBLIC_API_URL);
	if (!appHost || !apiHost) return next();

	const url = new URL(c.req.url);
	const publicPath = isPublicApiPath(url.pathname);
	if (url.hostname === appHost && publicPath) return c.notFound();
	if (url.hostname === apiHost && !publicPath) return c.notFound();
	return next();
});
