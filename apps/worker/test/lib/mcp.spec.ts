import { describe, expect, it } from "vitest";
import { publicOrigin, resolveMcpResource } from "../../src/lib/mcp";

describe("publicOrigin", () => {
	it("honours forwarded proto/host behind a TLS-terminating proxy", () => {
		const request = new Request("http://scorebrawl.localhost:1355/mcp", {
			headers: {
				"x-forwarded-proto": "https",
				"x-forwarded-host": "scorebrawl.localhost:1355",
			},
		});
		expect(publicOrigin(request)).toBe("https://scorebrawl.localhost:1355");
	});

	it("reports the public origin without proxy headers", () => {
		const request = new Request("http://scorebrawl.localhost:1355/mcp");
		expect(publicOrigin(request)).toBe("http://scorebrawl.localhost:1355");
	});

	it("keeps loopback http as-is", () => {
		const request = new Request("http://localhost/mcp");
		expect(publicOrigin(request)).toBe("http://localhost");
	});

	it("falls back to the request origin when no proxy headers are present", () => {
		const request = new Request("https://api.scorebrawl.com/mcp");
		expect(publicOrigin(request)).toBe("https://api.scorebrawl.com");
	});
});

describe("resolveMcpResource", () => {
	it("uses the public origin so a proxied dev host yields a valid https resource", () => {
		const env = {
			PROD_URL: "https://scorebrawl.com",
			PROD_PUBLIC_API_URL: "https://api.scorebrawl.com",
		};
		expect(resolveMcpResource(env, "https://scorebrawl.localhost:1355/mcp")).toBe(
			"https://scorebrawl.localhost:1355/mcp"
		);
	});

	it("pins the production API host", () => {
		const env = {
			PROD_URL: "https://scorebrawl.com",
			PROD_PUBLIC_API_URL: "https://api.scorebrawl.com",
		};
		expect(resolveMcpResource(env, "https://api.scorebrawl.com/mcp")).toBe(
			"https://api.scorebrawl.com/mcp"
		);
	});

	it("advertises a plain-http *.localhost dev host as https", () => {
		expect(resolveMcpResource({}, "http://scorebrawl.localhost:1355/mcp")).toBe(
			"https://scorebrawl.localhost:1355/mcp"
		);
	});

	it("keeps literal loopback on http", () => {
		expect(resolveMcpResource({}, "http://localhost/mcp")).toBe("http://localhost/mcp");
	});
});
