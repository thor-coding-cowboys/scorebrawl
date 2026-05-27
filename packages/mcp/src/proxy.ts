import { loadConfig } from "./config.js";
import { getToken } from "./auth.js";

interface MCPJsonRpcRequest {
	jsonrpc: "2.0";
	id: string | number | null;
	method: string;
	params?: Record<string, unknown>;
}

interface MCPJsonRpcResponse {
	jsonrpc: "2.0";
	id: string | number | null;
	result?: unknown;
	error?: { code: number; message: string; data?: unknown };
}

export async function proxyToWorker(request: MCPJsonRpcRequest): Promise<MCPJsonRpcResponse> {
	const config = loadConfig();
	const token = await getToken();

	if (!token) {
		return {
			jsonrpc: "2.0",
			id: request.id,
			error: {
				code: -32001,
				message: "Not authenticated. Run 'npx @scorebrawl/mcp login' to authenticate.",
			},
		};
	}

	try {
		const res = await fetch(`${config.apiBaseUrl}/api/mcp`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Cookie: `better-auth.session_token=${token}`,
			},
			body: JSON.stringify(request),
		});

		if (res.status === 401) {
			return {
				jsonrpc: "2.0",
				id: request.id,
				error: {
					code: -32001,
					message: "Session expired. Run 'npx @scorebrawl/mcp login' to re-authenticate.",
				},
			};
		}

		const body = (await res.json()) as MCPJsonRpcResponse;
		return body;
	} catch (err) {
		return {
			jsonrpc: "2.0",
			id: request.id,
			error: {
				code: -32000,
				message: err instanceof Error ? err.message : "Network error",
			},
		};
	}
}
