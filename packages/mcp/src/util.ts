export function allowLocalhostTls(apiBaseUrl: string): void {
	try {
		const url = new URL(apiBaseUrl);
		if (
			url.hostname === "localhost" ||
			url.hostname === "127.0.0.1" ||
			url.hostname.endsWith(".localhost")
		) {
			process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
		}
	} catch {
		// Invalid URL — leave TLS as-is
	}
}
