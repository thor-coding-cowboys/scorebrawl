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

function sessionDataCookie(response: Response): string | undefined {
	return response.headers
		.getSetCookie()
		.find((cookie) => cookie.startsWith("better-auth.session_data="));
}

async function warmSession() {
	const counter = createRoundTripCounter(env.DB);
	const auth = createAuth({
		db: counter.db,
		betterAuthSecret: env.BETTER_AUTH_SECRET,
		baseURL: "http://localhost",
	});
	const ctx = await auth.$context;
	const user = await ctx.internalAdapter.createUser({
		email: `cache-${Date.now()}-${Math.random()}@example.com`,
		name: "Cache",
		emailVerified: true,
	});
	const session = await ctx.internalAdapter.createSession(user.id, false, {}, true);
	const signature = await makeSignature(session.token, env.BETTER_AUTH_SECRET);
	const sessionCookie = `better-auth.session_token=${session.token}.${signature}`;
	const url = "http://localhost/api/auth/get-session";

	const first = await auth.handler(new Request(url, { headers: { Cookie: sessionCookie } }));

	return { auth, counter, user, sessionCookie, url, first };
}

describe("session cookie cache", () => {
	it("serves a warm session without a D1 round trip", async () => {
		const { auth, counter, user, sessionCookie, url, first } = await warmSession();
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

	// Matches the web client's 5 minute session staleTime, so a refetch in that
	// window can be served from the signed cookie instead of D1.
	it("issues the cache cookie with a 5 minute lifetime", async () => {
		const { first } = await warmSession();
		const cookie = sessionDataCookie(first);
		expect(cookie).toBeDefined();
		expect(cookie).toMatch(/Max-Age=300(;|$)/i);
	});
});
