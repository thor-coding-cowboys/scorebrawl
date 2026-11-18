import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("POST /api/auth/* origin checks", () => {
	it("rejects a foreign Origin even though it matches no trusted origin", async () => {
		const response = await SELF.fetch("http://example.com/api/auth/sign-out", {
			method: "POST",
			headers: {
				Cookie: "better-auth.session_token=unknown",
				Origin: "https://evil.example",
			},
		});

		expect(response.status).toBe(403);
	});

	it("accepts the request host's own origin", async () => {
		const response = await SELF.fetch("http://example.com/api/auth/sign-out", {
			method: "POST",
			headers: {
				Cookie: "better-auth.session_token=unknown",
				Origin: "http://example.com",
			},
		});

		expect(response.status).not.toBe(403);
	});
});
