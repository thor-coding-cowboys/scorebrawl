import { createAuthClient } from "better-auth/client";
import { deviceAuthorizationClient } from "better-auth/client/plugins";
import { loadConfig, saveConfig } from "./config.js";

function getAuthClient() {
	const config = loadConfig();
	return createAuthClient({
		baseURL: config.apiBaseUrl,
		plugins: [deviceAuthorizationClient()],
	});
}

export async function getToken(): Promise<string | null> {
	return loadConfig().accessToken ?? null;
}

export async function setToken(token: string): Promise<void> {
	saveConfig({ accessToken: token });
}

export async function deleteToken(): Promise<void> {
	saveConfig({ accessToken: undefined });
}

export async function runLoginFlow(): Promise<void> {
	const authClient = getAuthClient();
	const { data, error } = await authClient.device.code({
		client_id: "scorebrawl-mcp",
		scope: "openid",
	});

	if (error || !data) {
		console.error(
			"Failed to start device flow:",
			error?.error_description ?? (error as any)?.error ?? "unknown",
		);
		process.exit(1);
	}

	const {
		device_code,
		user_code,
		verification_uri,
		verification_uri_complete,
		interval = 5,
	} = data;
	const urlToOpen =
		verification_uri_complete ?? `${verification_uri}?user_code=${user_code}`;

	console.log(`\nOpen this URL in your browser:\n  ${urlToOpen}`);
	console.log(`\nOr visit: ${verification_uri}`);
	console.log(`And enter code: ${user_code}\n`);

	try {
		const { execFileSync } = await import("node:child_process");
		const opener = process.platform === "darwin" ? "open" : "xdg-open";
		execFileSync(opener, [urlToOpen], { stdio: "ignore" });
	} catch {
		/* ignore */
	}

	console.log("Waiting for authorization...");

	let pollingInterval = interval;
	await new Promise<void>((resolve) => {
		const poll = async () => {
			try {
				const { data: tokenData, error: tokenError } =
					await authClient.device.token({
						grant_type: "urn:ietf:params:oauth:grant-type:device_code",
						device_code,
						client_id: "scorebrawl-mcp",
					});

				if (tokenData?.access_token) {
					await setToken(tokenData.access_token);
					console.log("Logged in.");
					resolve();
					return;
				}

				if (tokenError) {
					const errCode = (tokenError as any).error;
					switch (errCode) {
						case "authorization_pending":
							break;
						case "slow_down":
							pollingInterval += 5;
							break;
						case "access_denied":
							console.error("Access denied.");
							process.exit(1);
							break;
						case "expired_token":
							console.error(
								"Device code expired. Run 'npx @scorebrawl/mcp login' again.",
							);
							process.exit(1);
							break;
						default:
							console.error(
								"Auth error:",
								(tokenError as any).error_description ?? errCode,
							);
							process.exit(1);
					}
				}

				setTimeout(poll, pollingInterval * 1000);
			} catch (err) {
				console.error(
					"Network error during polling:",
					err instanceof Error ? err.message : err,
				);
				process.exit(1);
			}
		};

		setTimeout(poll, pollingInterval * 1000);
	});
}
