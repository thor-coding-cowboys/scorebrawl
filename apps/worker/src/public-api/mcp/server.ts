import { McpServer } from "@modelcontextprotocol/server";
import type { McpToolContext } from "./context";
import { registerTools } from "./tool";
import { tools } from "./tools";

export const MCP_SERVER_INFO = { name: "scorebrawl", version: "1.0.0" } as const;

/** Builds a fresh server per request; the SDK owns per-request lifecycle. */
export function createMcpServer(ctx: McpToolContext): McpServer {
	const server = new McpServer({ name: MCP_SERVER_INFO.name, version: MCP_SERVER_INFO.version });
	registerTools(server, tools, ctx);
	return server;
}
