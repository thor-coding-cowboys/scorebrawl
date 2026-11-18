import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { createUser } from "../setup/auth-context-util";

describe("GET /api/auth/get-session response", () => {
	it("does not emit the session JWT header", async () => {
		const { sessionToken } = await createUser();

		const response = await SELF.fetch("http://app.example/api/auth/get-session", {
			headers: { Cookie: `better-auth.session_token=${sessionToken}` },
		});

		expect(response.status).toBe(200);
		expect(response.headers.get("set-auth-jwt")).toBeNull();
	});
});
