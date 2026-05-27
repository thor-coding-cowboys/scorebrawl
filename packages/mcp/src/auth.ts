import { createServer } from "node:http";
import { join } from "node:path";
import { loadConfig } from "./config.js";
import { allowLocalhostTls } from "./util.js";

let keytar: typeof import("keytar") | null = null;
try {
	keytar = await import("keytar");
} catch {
	// keytar not available (e.g. missing native deps)
}

const SERVICE = "scorebrawl-mcp";
const ACCOUNT = "sessionToken";

export async function getToken(): Promise<string | null> {
	if (keytar) {
		try {
			return await keytar.getPassword(SERVICE, ACCOUNT);
		} catch {
			// Fall through to file fallback
		}
	}
	// Fallback: try to read from config file
	const { readFileSync, existsSync } = await import("node:fs");
	const { homedir } = await import("node:os");
	const configPath = join(homedir(), ".config", "scorebrawl", "mcp.json");
	if (existsSync(configPath)) {
		try {
			const raw = readFileSync(configPath, "utf-8");
			const parsed = JSON.parse(raw) as { sessionToken?: string };
			return parsed.sessionToken ?? null;
		} catch {
			return null;
		}
	}
	return null;
}

export async function setToken(token: string): Promise<void> {
	if (keytar) {
		try {
			await keytar.setPassword(SERVICE, ACCOUNT, token);
			return;
		} catch {
			// Fall through to file fallback
		}
	}
	// Fallback: store in config file
	const { saveConfig } = await import("./config.js");
	saveConfig({ sessionToken: token } as Record<string, string>);
}

export async function deleteToken(): Promise<void> {
	if (keytar) {
		try {
			await keytar.deletePassword(SERVICE, ACCOUNT);
			return;
		} catch {
			// Fall through
		}
	}
	const { saveConfig } = await import("./config.js");
	saveConfig({ sessionToken: undefined } as unknown as Record<string, string>);
}

export async function runLoginFlow(): Promise<void> {
	const config = loadConfig();
	allowLocalhostTls(config.apiBaseUrl);
	const callbackPort = await getAvailablePort();
	const callbackUrl = `http://localhost:${callbackPort}/callback`;
	const loginUrl = `${config.apiBaseUrl}/auth/mcp-login?callback=${encodeURIComponent(callbackUrl)}`;

	return new Promise((resolve, reject) => {
		const server = createServer(async (req, res) => {
			const url = new URL(req.url ?? "/", `http://localhost:${callbackPort}`);
			if (url.pathname !== "/callback") {
				res.writeHead(404);
				res.end("Not found");
				return;
			}

			const code = url.searchParams.get("code");
			if (!code) {
				res.writeHead(400, { "Content-Type": "text/plain" });
				res.end("Missing code parameter. Please try again.");
				server.close();
				reject(new Error("Callback did not include an authorization code."));
				return;
			}

			try {
				const exchangeRes = await fetch(`${config.apiBaseUrl}/api/mcp-auth/exchange`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ code }),
				});
				if (!exchangeRes.ok) {
					const text = await exchangeRes.text();
					throw new Error(`Exchange failed (${exchangeRes.status}): ${text}`);
				}
				const { token } = (await exchangeRes.json()) as { token: string };
				if (!token || typeof token !== "string") {
					throw new Error("Exchange response did not include a token.");
				}
				await setToken(token);

				res.writeHead(200, { "Content-Type": "text/html" });
				res.end(`
					<html>
						<body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
							<div style="text-align: center;">
								<h1>Scorebrawl MCP</h1>
								<p>You can close this window and return to your terminal.</p>
							</div>
						</body>
					</html>
				`);
				server.close();
				resolve();
			} catch (err) {
				res.writeHead(500, { "Content-Type": "text/plain" });
				res.end(err instanceof Error ? err.message : "Exchange failed.");
				server.close();
				reject(err instanceof Error ? err : new Error("Exchange failed."));
			}
		});

		server.listen(callbackPort, async () => {
			console.log(`Opening browser to authenticate...`);
			try {
				const { default: open } = await import("open");
				await open(loginUrl);
			} catch {
				console.log(`Please open this URL in your browser:`);
				console.log(loginUrl);
			}
		});

		setTimeout(() => {
			server.close();
			reject(new Error("Login timed out. Please try again."));
		}, 300_000);
	});
}

async function getAvailablePort(): Promise<number> {
	const { createServer } = await import("node:net");
	return new Promise((resolve) => {
		const server = createServer();
		server.listen(0, () => {
			const address = server.address();
			const port = typeof address === "object" && address ? address.port : 0;
			server.close(() => resolve(port));
		});
	});
}
