import { describe, expect, it, beforeEach } from "vitest";
import { SELF } from "cloudflare:test";
import { createAuthContext, authHeaders } from "../setup/auth-context-util";

process.on("unhandledRejection", (reason) => {
	if (reason && typeof reason === "object" && "statusCode" in reason) return;
	throw reason;
});

describe("device authorization flow", () => {
	let sessionToken: string;

	beforeEach(async () => {
		const ctx = await createAuthContext();
		sessionToken = ctx.sessionToken;
	});

	const clientId = "test-client";

	const requestDeviceCode = async () => {
		const res = await SELF.fetch("http://example.com/api/auth/device/code", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ client_id: clientId }),
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			device_code: string;
			user_code: string;
			verification_uri: string;
			verification_uri_complete: string;
			interval: number;
		};
		return body;
	};

	it("POST /api/auth/device/code returns a device code", async () => {
		const body = await requestDeviceCode();

		expect(body.device_code).toBeDefined();
		expect(body.device_code.length).toBeGreaterThan(0);
		expect(body.user_code).toBeDefined();
		expect(body.user_code.length).toBeGreaterThan(0);
		expect(body.verification_uri).toBeDefined();
		expect(body.verification_uri.length).toBeGreaterThan(0);
		expect(body.verification_uri_complete).toBeDefined();
		expect(body.verification_uri_complete.length).toBeGreaterThan(0);
		expect(body.interval).toBeDefined();
		expect(body.interval).toBeGreaterThan(0);
	});

	it("GET /api/auth/device?user_code=... validates a code", async () => {
		const { user_code } = await requestDeviceCode();

		const res = await SELF.fetch(`http://example.com/api/auth/device?user_code=${user_code}`, {
			method: "GET",
		});

		expect(res.status).toBe(200);
		const body = (await res.json()) as { user_code: string; status: string };
		expect(body.user_code).toBe(user_code);
		expect(body.status).toBe("pending");
	});

	it("POST /api/auth/device/approve requires authentication", async () => {
		const { user_code } = await requestDeviceCode();

		const res = await SELF.fetch("http://example.com/api/auth/device/approve", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ userCode: user_code }),
		});

		expect(res.status).toBe(401);
		await res.text();
	});

	it("POST /api/auth/device/approve approves a code when authenticated", async () => {
		const { user_code } = await requestDeviceCode();

		// Claim the code with the authenticated session before approving
		await SELF.fetch(`http://example.com/api/auth/device?user_code=${user_code}`, {
			headers: authHeaders(sessionToken),
		});

		const res = await SELF.fetch("http://example.com/api/auth/device/approve", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Origin: "http://example.com",
				...authHeaders(sessionToken),
			},
			body: JSON.stringify({ userCode: user_code }),
		});

		expect(res.status).toBe(200);
	});

	it("POST /api/auth/device/token exchanges device_code for access_token", async () => {
		const { device_code, user_code } = await requestDeviceCode();

		// Claim the code with the authenticated session before approving
		await SELF.fetch(`http://example.com/api/auth/device?user_code=${user_code}`, {
			headers: authHeaders(sessionToken),
		});

		const approveRes = await SELF.fetch("http://example.com/api/auth/device/approve", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Origin: "http://example.com",
				...authHeaders(sessionToken),
			},
			body: JSON.stringify({ userCode: user_code }),
		});
		expect(approveRes.status).toBe(200);
		await approveRes.json();

		const res = await SELF.fetch("http://example.com/api/auth/device/token", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				grant_type: "urn:ietf:params:oauth:grant-type:device_code",
				device_code,
				client_id: clientId,
			}),
		});

		expect(res.status).toBe(200);
		const body = (await res.json()) as { access_token: string };
		expect(body.access_token).toBeDefined();
		expect(body.access_token.length).toBeGreaterThan(0);
	});

	it("POST /api/auth/device/token returns error for pending code", async () => {
		const { device_code } = await requestDeviceCode();

		const res = await SELF.fetch("http://example.com/api/auth/device/token", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				grant_type: "urn:ietf:params:oauth:grant-type:device_code",
				device_code,
				client_id: clientId,
			}),
		});

		expect(res.status).toBe(400);
		const body = (await res.json()) as { error: string };
		expect(body.error).toBe("authorization_pending");
	});
});
