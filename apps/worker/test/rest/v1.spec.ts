import { describe, expect, it } from "vitest";
import { SELF } from "cloudflare:test";
import { listLeaguesResponseSchema, meResponseSchema } from "../../src/public-api/schemas/v1";
import { createAuthContext } from "../setup/auth-context-util";
import { createTRPCTestClient } from "../trpc/trpc-test-client";

const url = (path: string) => `http://example.com${path}`;

async function setup() {
	const ctx = await createAuthContext();
	const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });
	return { ctx, client };
}

describe("personal api keys /v1", () => {
	it("creates a key with sbp_ prefix and lists it without the secret", async () => {
		const { client } = await setup();
		const created = await client.personalApiKey.create.mutate({
			name: "me",
			scopes: ["profile:read"],
			expiry: "never",
		});
		expect(created.key).toMatch(/^sbp_/);

		const list = await client.personalApiKey.list.query();
		expect(list).toHaveLength(1);
		expect(list[0]?.scopes).toEqual(["profile:read"]);
		expect(JSON.stringify(list)).not.toContain(created.key);
	});

	it("GET /v1/me returns the key owner", async () => {
		const { ctx, client } = await setup();
		const { key } = await client.personalApiKey.create.mutate({
			name: "me",
			scopes: ["profile:read"],
			expiry: "never",
		});
		const res = await SELF.fetch(url("/v1/me"), { headers: { "x-api-key": key } });
		expect(res.status).toBe(200);
		const body = (await res.json()) as { user: { id: string } };
		expect(body.user.id).toBe(ctx.user.id);
	});

	it("GET /v1/leagues lists the user's leagues", async () => {
		const { ctx, client } = await setup();
		const { key } = await client.personalApiKey.create.mutate({
			name: "leagues",
			scopes: ["league:read"],
			expiry: "never",
		});
		const res = await SELF.fetch(url("/v1/leagues"), {
			headers: { authorization: `Bearer ${key}` },
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as { leagues: { id: string }[] };
		expect(body.leagues.map((l) => l.id)).toContain(ctx.league.id);
	});

	it("response bodies parse against the documented schemas", async () => {
		const { client } = await setup();
		const { key } = await client.personalApiKey.create.mutate({
			name: "contract",
			scopes: ["profile:read", "league:read"],
			expiry: "never",
		});

		const me = await SELF.fetch(url("/v1/me"), { headers: { "x-api-key": key } });
		const meBody = await me.json();
		expect(meResponseSchema.safeParse(meBody).success).toBe(true);

		const leagues = await SELF.fetch(url("/v1/leagues"), { headers: { "x-api-key": key } });
		const leaguesBody = await leagues.json();
		expect(listLeaguesResponseSchema.safeParse(leaguesBody).success).toBe(true);
	});

	it("401 without a key, 401 with a bogus key", async () => {
		expect((await SELF.fetch(url("/v1/me"))).status).toBe(401);
		const res = await SELF.fetch(url("/v1/me"), { headers: { "x-api-key": "sbp_nope" } });
		expect(res.status).toBe(401);
	});

	it("403 when the scope is missing", async () => {
		const { client } = await setup();
		const { key } = await client.personalApiKey.create.mutate({
			name: "me",
			scopes: ["profile:read"],
			expiry: "never",
		});
		const res = await SELF.fetch(url("/v1/leagues"), { headers: { "x-api-key": key } });
		expect(res.status).toBe(403);
	});

	it("rejects a league key on /v1 and a personal key on /leagues/v1", async () => {
		const { ctx, client } = await setup();
		const league = await client.apiKey.create.mutate({
			name: "league",
			scopes: ["session:stop"],
			expiry: "never",
		});
		const personal = await client.personalApiKey.create.mutate({
			name: "me",
			scopes: ["profile:read"],
			expiry: "never",
		});
		expect((await SELF.fetch(url("/v1/me"), { headers: { "x-api-key": league.key } })).status).toBe(
			401
		);
		const res = await SELF.fetch(url(`/leagues/v1/${ctx.league.id}/sessions/active/end`), {
			method: "POST",
			headers: { "x-api-key": personal.key },
		});
		expect(res.status).toBe(401);
	});

	it("deleted key stops working; cannot delete another user's key", async () => {
		const { client } = await setup();
		const other = await setup();
		const { id, key } = await client.personalApiKey.create.mutate({
			name: "me",
			scopes: ["profile:read"],
			expiry: "never",
		});
		await expect(other.client.personalApiKey.delete.mutate({ id })).rejects.toThrow();
		await client.personalApiKey.delete.mutate({ id });
		const res = await SELF.fetch(url("/v1/me"), { headers: { "x-api-key": key } });
		expect(res.status).toBe(401);
	});
});
