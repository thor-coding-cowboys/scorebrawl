import { describe, expect, it } from "vitest";
import { resolveRequestOrigin } from "../../src/lib/request-origin";

describe("resolveRequestOrigin", () => {
	it("uses the request URL host", () => {
		const request = new Request("https://scorebrawl.com/api/auth/get-session");
		expect(resolveRequestOrigin(request)).toBe("https://scorebrawl.com");
	});

	it("ignores a spoofed forwarded host on a public host", () => {
		const request = new Request("https://scorebrawl.com/api/auth/get-session", {
			headers: { "x-forwarded-host": "evil.example", "x-forwarded-proto": "https" },
		});
		expect(resolveRequestOrigin(request)).toBe("https://scorebrawl.com");
	});

	it("honours forwarded proto/host for a local dev proxy", () => {
		const request = new Request("http://scorebrawl.localhost:1355/api/auth/get-session", {
			headers: {
				"x-forwarded-proto": "https",
				"x-forwarded-host": "scorebrawl.localhost:1355",
			},
		});
		expect(resolveRequestOrigin(request)).toBe("https://scorebrawl.localhost:1355");
	});

	it("ignores a forwarded host that is not local even when the URL is local", () => {
		const request = new Request("http://localhost:8787/api/auth/get-session", {
			headers: { "x-forwarded-host": "evil.example", "x-forwarded-proto": "https" },
		});
		expect(resolveRequestOrigin(request)).toBe("http://localhost:8787");
	});

	it("falls back to the request URL for malformed forwarded hosts", () => {
		const request = new Request("http://localhost:8787/api/auth/get-session", {
			headers: { "x-forwarded-host": "not a host" },
		});
		expect(resolveRequestOrigin(request)).toBe("http://localhost:8787");
	});
});
