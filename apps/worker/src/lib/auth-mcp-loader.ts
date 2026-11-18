/**
 * Kept in its own module so tests can alias this loader to a static import:
 * with `@cloudflare/vitest-pool-workers`, a dynamic `import()` from a Durable
 * Object event handler goes through the dev module fallback and loses the
 * request's D1 execution context. Production keeps the lazy import.
 */
export function loadMcpPluginModule() {
	return import("./better-auth-mcp");
}
