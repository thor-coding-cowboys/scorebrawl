import { env } from "cloudflare:test";
import { makeSignature } from "better-auth/crypto";
import { describe, expect, it } from "vitest";
import { createAuth } from "../../src/lib/better-auth";
import { createRoundTripCounter } from "../setup/d1-round-trip-counter";

function cacheCookies(response: Response): string {
	return response.headers
		.getSetCookie()
		.map((cookie) => cookie.split(";")[0] ?? "")
		.filter((cookie) => cookie.startsWith("better-auth.session_data="))
		.join("; ");
}

describe("session cookie cache", () => {
	it("serves a warm session without a D1 round trip", async () => {
		const counter = createRoundTripCounter(env.DB);
		const auth = createAuth({
			db: counter.db,
			betterAuthSecret: env.BETTER_AUTH_SECRET,
			baseURL: "http://localhost",
		});
		const ctx = await auth.$context;
		const user = await ctx.internalAdapter.createUser({
			email: `cache-${Date.now()}@example.com`,
			name: "Cache",
			emailVerified: true,
		});
		const session = await ctx.internalAdapter.createSession(user.id, false, {}, true);
		const signature = await makeSignature(session.token, env.BETTER_AUTH_SECRET);
		const sessionCookie = `better-auth.session_token=${session.token}.${signature}`;
		const url = "http://localhost/api/auth/get-session";

		const first = await auth.handler(new Request(url, { headers: { Cookie: sessionCookie } }));
		const cached = cacheCookies(first);
		expect(cached).not.toBe("");

		counter.reset();
		const second = await auth.handler(
			new Request(url, { headers: { Cookie: `${sessionCookie}; ${cached}` } })
		);

		const body = (await second.json()) as { user: { id: string } } | null;
		expect(body?.user.id).toBe(user.id);
		expect(counter.count()).toBe(0);
	});
});
