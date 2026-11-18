import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

const SESSION_COOKIE = { Cookie: "better-auth.session_token=unknown" };

describe("POST /api/auth/* origin checks", () => {
	it("rejects a foreign Origin", async () => {
		const response = await SELF.fetch("http://app.example/api/auth/sign-out", {
			method: "POST",
			headers: { ...SESSION_COOKIE, Origin: "https://evil.example" },
		});

		expect(response.status).toBe(403);
	});

	it("rejects a foreign Origin even with a spoofed x-forwarded-host", async () => {
		const response = await SELF.fetch("http://app.example/api/auth/sign-out", {
			method: "POST",
			headers: {
				...SESSION_COOKIE,
				Origin: "https://evil.example",
				"x-forwarded-host": "evil.example",
			},
		});

		expect(response.status).toBe(403);
	});

	it("accepts the request host's own origin", async () => {
		const response = await SELF.fetch("http://app.example/api/auth/sign-out", {
			method: "POST",
			headers: { ...SESSION_COOKIE, Origin: "http://app.example" },
		});

		expect(response.status).toBe(200);
	});
});
