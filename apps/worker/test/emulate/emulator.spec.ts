import { describe, expect, it } from "vitest";
import { emulateApp } from "../../src/emulate";

const BASE = "http://emulate.local";

async function googleCode(email: string): Promise<string> {
	const callback = await emulateApp.request(`${BASE}/emulate/google/o/oauth2/v2/auth/callback`, {
		method: "POST",
		body: new URLSearchParams({
			email,
			redirect_uri: "http://app.local/api/auth/callback/google",
			state: "state-1",
		}),
		headers: { "content-type": "application/x-www-form-urlencoded" },
	});

	expect(callback.status).toBe(302);
	const location = new URL(callback.headers.get("location") ?? "");
	expect(location.searchParams.get("state")).toBe("state-1");
	return location.searchParams.get("code") ?? "";
}

async function githubCode(login: string): Promise<string> {
	const callback = await emulateApp.request(`${BASE}/emulate/github/login/oauth/callback`, {
		method: "POST",
		body: new URLSearchParams({
			login,
			redirect_uri: "http://app.local/api/auth/callback/github",
		}),
		headers: { "content-type": "application/x-www-form-urlencoded" },
	});

	expect(callback.status).toBe(302);
	const location = new URL(callback.headers.get("location") ?? "");
	return location.searchParams.get("code") ?? "";
}

describe("emulated providers", () => {
	it("renders the Google picker with the seeded users", async () => {
		const response = await emulateApp.request(
			`${BASE}/emulate/google/o/oauth2/v2/auth?redirect_uri=http%3A%2F%2Fapp.local%2Fcb&state=s`
		);

		expect(response.status).toBe(200);
		const html = await response.text();
		expect(html).toContain("seed@example.com");
		expect(html).toContain("emulate-e2e@example.com");
	});

	it("exchanges a Google code for the picked profile", async () => {
		const code = await googleCode("emulate-e2e@example.com");

		const tokenResponse = await emulateApp.request(`${BASE}/emulate/google/oauth2/token`, {
			method: "POST",
			body: new URLSearchParams({ code, grant_type: "authorization_code" }),
			headers: { "content-type": "application/x-www-form-urlencoded" },
		});
		expect(tokenResponse.status).toBe(200);
		const { access_token } = (await tokenResponse.json()) as { access_token: string };

		const userInfoResponse = await emulateApp.request(`${BASE}/emulate/google/oauth2/v2/userinfo`, {
			headers: { authorization: `Bearer ${access_token}` },
		});
		expect(userInfoResponse.status).toBe(200);
		const profile = (await userInfoResponse.json()) as {
			email: string;
			email_verified: boolean;
		};
		expect(profile.email).toBe("emulate-e2e@example.com");
		expect(profile.email_verified).toBe(true);
	});

	it("links the GitHub login to the seed user", async () => {
		const code = await githubCode("seed");

		const tokenResponse = await emulateApp.request(
			`${BASE}/emulate/github/login/oauth/access_token`,
			{
				method: "POST",
				body: new URLSearchParams({ code, grant_type: "authorization_code" }),
				headers: { "content-type": "application/x-www-form-urlencoded" },
			}
		);
		expect(tokenResponse.status).toBe(200);
		const { access_token } = (await tokenResponse.json()) as { access_token: string };

		const headers = { authorization: `Bearer ${access_token}` };
		const userResponse = await emulateApp.request(`${BASE}/emulate/github/user`, { headers });
		const user = (await userResponse.json()) as { id: number; login: string; email: string };
		expect(user.login).toBe("seed");
		expect(user.email).toBe("seed@example.com");
		expect(typeof user.id).toBe("number");

		const emailsResponse = await emulateApp.request(`${BASE}/emulate/github/user/emails`, {
			headers,
		});
		const emails = (await emailsResponse.json()) as { email: string; verified: boolean }[];
		expect(emails[0]).toMatchObject({ email: "seed@example.com", verified: true });
	});
});
