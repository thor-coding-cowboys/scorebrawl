import type {
	CallToolResult,
	McpServer,
	StandardSchemaWithJSON,
} from "@modelcontextprotocol/server";
import type { McpToolContext } from "./context";

export interface McpTool<Input = unknown> {
	name: string;
	title?: string;
	description: string;
	inputSchema: StandardSchemaWithJSON;
	execute(input: Input, ctx: McpToolContext): CallToolResult | Promise<CallToolResult>;
}

export function defineTool<Schema extends StandardSchemaWithJSON>(tool: {
	name: string;
	title?: string;
	description: string;
	inputSchema: Schema;
	execute(
		input: StandardSchemaWithJSON.InferOutput<Schema>,
		ctx: McpToolContext
	): CallToolResult | Promise<CallToolResult>;
}): McpTool<StandardSchemaWithJSON.InferOutput<Schema>> {
	return tool;
}

export function registerTools(
	server: McpServer,
	tools: readonly McpTool[],
	ctx: McpToolContext
): void {
	for (const tool of tools) {
		server.registerTool(
			tool.name,
			{ title: tool.title, description: tool.description, inputSchema: tool.inputSchema },
			(input) => tool.execute(input, ctx)
		);
	}
}

/** Wraps a message as an MCP text result. */
export function textResult(value: unknown): CallToolResult {
	return { content: [{ type: "text", text: JSON.stringify(value) }] };
}

/** Wraps a value as an MCP result with both text and `structuredContent`. */
export function jsonResult(value: unknown): CallToolResult {
	const structuredContent =
		value !== null && typeof value === "object" && !Array.isArray(value)
			? (value as Record<string, unknown>)
			: { value };
	return { content: [{ type: "text", text: JSON.stringify(value) }], structuredContent };
}
