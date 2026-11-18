// Vitest-only alias for `src/lib/auth-mcp-loader.ts`. The Workers test pool
// cannot resolve a dynamic `import()` from a Durable Object event handler, so
// tests load the MCP plugin statically; production still imports it lazily.
import * as mcpPluginModule from "../../src/lib/better-auth-mcp";

export function loadMcpPluginModule() {
	return Promise.resolve(mcpPluginModule);
}
