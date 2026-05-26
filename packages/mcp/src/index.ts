#!/usr/bin/env node
import { proxyToWorker } from "./proxy.js";
import { runLoginFlow } from "./auth.js";

const args = process.argv.slice(2);

if (args[0] === "login") {
	runLoginFlow()
		.then(() => {
			console.log("Login successful! Your MCP server is ready to use.");
			process.exit(0);
		})
		.catch((err) => {
			console.error("Login failed:", err instanceof Error ? err.message : String(err));
			process.exit(1);
		});
} else {
	startMcpServer();
}

function startMcpServer() {
	let buffer = "";

	process.stdin.setEncoding("utf-8");
	process.stdin.on("data", (chunk: string) => {
		buffer += chunk;
		let lineEnd: number;
		while ((lineEnd = buffer.indexOf("\n")) !== -1) {
			const line = buffer.slice(0, lineEnd).trim();
			buffer = buffer.slice(lineEnd + 1);
			if (line) {
				handleRequest(line).catch((err) => {
					console.error("[MCP] Unhandled error:", err);
				});
			}
		}
	});

	process.stdin.on("end", () => {
		process.exit(0);
	});

	async function handleRequest(line: string) {
		let request: { jsonrpc: string; id: unknown; method: string; params?: Record<string, unknown> };
		try {
			request = JSON.parse(line);
		} catch {
			writeResponse({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
			return;
		}

		if (request.jsonrpc !== "2.0") {
			writeResponse({
				jsonrpc: "2.0",
				id: request.id ?? null,
				error: { code: -32600, message: "Invalid Request: jsonrpc must be 2.0" },
			});
			return;
		}

		// Handle notifications (no response needed)
		if (request.id === undefined || request.id === null) {
			if (request.method === "notifications/initialized") {
				return; // No-op
			}
		}

		const response = await proxyToWorker({
			jsonrpc: "2.0",
			id: request.id as string | number | null,
			method: request.method,
			params: request.params,
		});

		writeResponse(response);
	}

	function writeResponse(response: unknown) {
		const json = JSON.stringify(response);
		process.stdout.write(json + "\n");
	}
}
