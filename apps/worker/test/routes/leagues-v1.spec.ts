import { describe, expect, it } from "vitest";
import { SELF } from "cloudflare:test";
import { createAuthContext, createLeague, createUser } from "../setup/auth-context-util";
import { createPlayers } from "../setup/season-context-util";
import { createTRPCTestClient } from "../trpc/trpc-test-client";
import { getAccessToken, registerOAuthClient } from "../setup/oauth-util";

const baseScopes = "openid profile email offline_access";

async function accessTokenWith(sessionToken: string, scopes: string): Promise<string> {
	const client = await registerOAuthClient({ sessionToken, scope: scopes });
	const { accessToken } = await getAccessToken({ sessionToken, client, scopes });
	return accessToken;
}

function leaguesUrl() {
	return "http://example.com/api/v1/leagues";
}

function seasonsUrl(leagueId: string, query = "") {
	return `http://example.com/api/v1/leagues/${leagueId}/seasons${query}`;
}

function authed(url: string, accessToken: string) {
	return SELF.fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
}

describe("leagues v1 public API", () => {
	it("lists the leagues the token subject belongs to with role", async () => {
		const ctx = await createAuthContext({ league: { name: "Alpha League" } });
		const second = await createLeague(ctx.sessionToken, { name: "Beta League" });
		const accessToken = await accessTokenWith(ctx.sessionToken, `${baseScopes} read:leagues`);

		const res = await authed(leaguesUrl(), accessToken);
		expect(res.status).toBe(200);

		const data = (await res.json()) as {
			items: Array<{ id: string; name: string; slug: string; role: string }>;
		};
		expect(data.items.map((l) => l.id)).toEqual([ctx.league.id, second.id]);
		expect(data.items.map((l) => l.role)).toEqual(["owner", "owner"]);
		expect(data.items[0].name).toBe("Alpha League");
		expect(data.items[0].slug).toBe(ctx.league.slug);
	});

	it("returns an empty list when the subject has no memberships", async () => {
		const user = await createUser();
		const accessToken = await accessTokenWith(user.sessionToken, `${baseScopes} read:leagues`);

		const res = await authed(leaguesUrl(), accessToken);
		expect(res.status).toBe(200);
		const data = (await res.json()) as { items: unknown[] };
		expect(data.items).toEqual([]);
	});

	it("returns 403 insufficient_scope when read:leagues is missing", async () => {
		const ctx = await createAuthContext();
		const accessToken = await accessTokenWith(ctx.sessionToken, `${baseScopes} read:matches`);

		const res = await authed(leaguesUrl(), accessToken);
		expect(res.status).toBe(403);
		const data = (await res.json()) as { error: string; scope: string };
		expect(data.error).toBe("insufficient_scope");
		expect(data.scope).toBe("read:leagues");
		expect(res.headers.get("www-authenticate")).toContain("insufficient_scope");
	});

	it("returns 401 with WWW-Authenticate for a missing or invalid bearer token", async () => {
		const invalid = await authed(leaguesUrl(), "not-a-real-token");
		expect(invalid.status).toBe(401);
		expect(invalid.headers.get("www-authenticate")).toContain("invalid_token");

		const none = await SELF.fetch(leaguesUrl());
		expect(none.status).toBe(401);
	});
});

describe("leagues v1 seasons API", () => {
	async function setupSeasons() {
		const ctx = await createAuthContext();
		const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });
		await createPlayers(ctx, 2);

		const autumn = await client.season.create.mutate({
			name: "Autumn 2026",
			scoreType: "1-v-n-elo",
			initialScore: 1000,
			kFactor: 32,
			startDate: new Date("2026-09-01T00:00:00.000Z"),
		});
		const spring = await client.season.create.mutate({
			name: "Spring 2026",
			scoreType: "elo",
			initialScore: 1000,
			kFactor: 32,
			startDate: new Date("2026-03-01T00:00:00.000Z"),
		});
		await client.season.updateClosedStatus.mutate({
			seasonSlug: spring.slug,
			closed: true,
		});

		const accessToken = await accessTokenWith(ctx.sessionToken, `${baseScopes} read:seasons`);
		return { ctx, autumn, spring, accessToken };
	}

	it("lists seasons newest first and filters by scoreType and excludeClosed", async () => {
		const { ctx, autumn, spring, accessToken } = await setupSeasons();

		const all = await authed(seasonsUrl(ctx.league.id), accessToken);
		expect(all.status).toBe(200);
		const allData = (await all.json()) as {
			items: Array<{
				id: string;
				name: string;
				slug: string;
				scoreType: string;
				closed: boolean;
				archived: boolean;
				startDate: string;
				endDate: string | null;
			}>;
		};
		expect(allData.items.map((s) => s.id)).toEqual([autumn.id, spring.id]);
		expect(allData.items[0]).toEqual({
			id: autumn.id,
			name: "Autumn 2026",
			slug: autumn.slug,
			scoreType: "1-v-n-elo",
			closed: false,
			archived: false,
			startDate: "2026-09-01T00:00:00.000Z",
			endDate: null,
		});

		const open = await authed(seasonsUrl(ctx.league.id, "?excludeClosed=true"), accessToken);
		const openData = (await open.json()) as { items: Array<{ id: string }> };
		expect(openData.items.map((s) => s.id)).toEqual([autumn.id]);

		const elo = await authed(seasonsUrl(ctx.league.id, "?scoreType=elo"), accessToken);
		const eloData = (await elo.json()) as { items: Array<{ id: string }> };
		expect(eloData.items.map((s) => s.id)).toEqual([spring.id]);

		const pushable = await authed(
			seasonsUrl(ctx.league.id, "?scoreType=1-v-n-elo&excludeClosed=true"),
			accessToken
		);
		const pushableData = (await pushable.json()) as { items: Array<{ id: string }> };
		expect(pushableData.items.map((s) => s.id)).toEqual([autumn.id]);
	});

	it("returns 404 for a non-member or an unknown league", async () => {
		const { ctx, accessToken } = await setupSeasons();
		const other = await createAuthContext();
		const otherToken = await accessTokenWith(other.sessionToken, `${baseScopes} read:seasons`);

		const nonMember = await authed(seasonsUrl(ctx.league.id), otherToken);
		expect(nonMember.status).toBe(404);

		const unknown = await authed(seasonsUrl("league_does_not_exist"), accessToken);
		expect(unknown.status).toBe(404);
	});

	it("returns 403 insufficient_scope when read:seasons is missing", async () => {
		const { ctx } = await setupSeasons();
		const wrongScope = await accessTokenWith(ctx.sessionToken, `${baseScopes} read:leagues`);

		const res = await authed(seasonsUrl(ctx.league.id), wrongScope);
		expect(res.status).toBe(403);
		const data = (await res.json()) as { error: string; scope: string };
		expect(data.error).toBe("insufficient_scope");
		expect(data.scope).toBe("read:seasons");
		expect(res.headers.get("www-authenticate")).toContain("insufficient_scope");
	});
});
