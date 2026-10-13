import { describe, expect, it } from "vitest";
import { SELF, env } from "cloudflare:test";
import { randUuid } from "@ngneat/falso";
import { and, eq } from "drizzle-orm";
import { getDb } from "../../src/db/index";
import { apikey, member } from "../../src/db/schema/auth-schema";
import { createAuthContext } from "../setup/auth-context-util";
import { createPlayers } from "../setup/season-context-util";
import { createTRPCTestClient } from "../trpc/trpc-test-client";

type TestClient = ReturnType<typeof createTRPCTestClient>;

async function setupSeason(playerCount = 4) {
	const ctx = await createAuthContext();
	const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

	await createPlayers(ctx, playerCount);
	const season = await client.season.create.mutate({
		name: "REST Sessions Season",
		initialScore: 1000,
		scoreType: "elo",
		kFactor: 32,
		startDate: new Date(),
	});
	const seasonPlayers = await client.seasonPlayer.getAll.query({ seasonSlug: season.slug });

	return { ctx, client, season, seasonPlayers };
}

async function setupActiveSession(playerCount = 4, teamSize = 2) {
	const { ctx, client, season, seasonPlayers } = await setupSeason(playerCount);

	const session = await client.session.create.mutate({
		seasonSlug: season.slug,
		rotationMode: "winner-stays",
		teamSize,
		maxConsecutiveGames: null,
		seasonPlayerIds: seasonPlayers.map((p) => p.id),
	});

	return { ctx, client, season, session, seasonPlayers };
}

async function createKey(
	client: TestClient,
	scopes: Parameters<TestClient["apiKey"]["create"]["mutate"]>[0]["scopes"]
) {
	return client.apiKey.create.mutate({ name: "REST test key", scopes, expiry: "never" });
}

function sessionsUrl(leagueId: string, path = "") {
	return `http://example.com/leagues/v1/${leagueId}/sessions${path}`;
}

async function logMatchRequest(opts: { leagueId: string; key?: string; body: unknown }) {
	return SELF.fetch(sessionsUrl(opts.leagueId, "/active/match/log"), {
		method: "POST",
		headers: {
			...(opts.key ? { "x-api-key": opts.key } : {}),
			"Content-Type": "application/json",
		},
		body: JSON.stringify(opts.body),
	});
}

describe("better-auth api-key endpoints are blocked", () => {
	it("blocks direct api-key create and list over HTTP", async () => {
		const create = await SELF.fetch("http://example.com/api/auth/api-key/create", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name: "bypass" }),
		});
		expect(create.status).toBe(404);
		expect((await create.json()) as { error: string }).toEqual({ error: "not_found" });

		const list = await SELF.fetch("http://example.com/api/auth/api-key/list", { method: "GET" });
		expect(list.status).toBe(404);
	});
});

describe("sessions v1 api key auth", () => {
	it("rejects a request with no api key", async () => {
		const { ctx } = await setupActiveSession();
		const res = await logMatchRequest({ leagueId: ctx.league.id, body: { home: 2, away: 3 } });
		expect(res.status).toBe(401);
		const data = (await res.json()) as { error: string };
		expect(data.error).toBe("missing_api_key");
	});

	it("rejects a valid key scoped to a different league", async () => {
		const { ctx } = await setupActiveSession();
		const other = await createAuthContext();
		const otherClient = createTRPCTestClient({ sessionToken: other.sessionToken });
		const otherKey = await createKey(otherClient, ["match:log"]);

		const res = await logMatchRequest({
			leagueId: ctx.league.id,
			key: otherKey.key,
			body: { home: 2, away: 3 },
		});
		expect(res.status).toBe(403);
		const data = (await res.json()) as { error: string };
		expect(data.error).toBe("wrong_league");

		const [stored] = await getDb(env.DB)
			.select({ requestCount: apikey.requestCount, lastRequest: apikey.lastRequest })
			.from(apikey)
			.where(eq(apikey.id, otherKey.id));
		expect(stored?.requestCount ?? 0).toBe(0);
		expect(stored?.lastRequest).toBeNull();
	});

	it("rejects a key missing the required scope", async () => {
		const { ctx, client } = await setupActiveSession();
		const key = await createKey(client, ["match:start"]);

		const res = await logMatchRequest({
			leagueId: ctx.league.id,
			key: key.key,
			body: { home: 2, away: 3 },
		});
		expect(res.status).toBe(403);
		const data = (await res.json()) as { error: string };
		expect(data.error).toBe("insufficient_scope");
	});

	it("rejects a key with no creator metadata", async () => {
		const { ctx, client } = await setupActiveSession();
		const key = await createKey(client, ["match:log"]);
		const db = getDb(env.DB);
		await db.update(apikey).set({ metadata: null }).where(eq(apikey.id, key.id));

		const res = await logMatchRequest({
			leagueId: ctx.league.id,
			key: key.key,
			body: { home: 2, away: 3 },
		});
		expect(res.status).toBe(401);
		expect((await res.json()) as { error: string }).toEqual({ error: "invalid_api_key" });
	});

	it("rejects a key whose creator is no longer an owner", async () => {
		const { ctx, client } = await setupActiveSession();
		const key = await createKey(client, ["match:log"]);
		const db = getDb(env.DB);
		await db
			.update(member)
			.set({ role: "member" })
			.where(and(eq(member.organizationId, ctx.league.id), eq(member.userId, ctx.user.id)));

		const res = await logMatchRequest({
			leagueId: ctx.league.id,
			key: key.key,
			body: { home: 2, away: 3 },
		});
		expect(res.status).toBe(403);
		expect((await res.json()) as { error: string }).toEqual({ error: "key_owner_not_owner" });
	});

	it("records the current match with a match:log key", async () => {
		const { ctx, client, session, season, seasonPlayers } = await setupActiveSession();

		await client.session.startNextMatch.mutate({
			sessionId: session.id,
			homeSeasonPlayerIds: [seasonPlayers[0].id, seasonPlayers[1].id],
			awaySeasonPlayerIds: [seasonPlayers[2].id, seasonPlayers[3].id],
		});

		const key = await createKey(client, ["match:log"]);
		const res = await logMatchRequest({
			leagueId: ctx.league.id,
			key: key.key,
			body: { home: 2, away: 3 },
		});

		expect(res.status).toBe(200);
		const data = (await res.json()) as { match: { result: string } };
		expect(data.match.result).toBe("away");

		const persisted = await client.session.getById.query({ sessionId: session.id });
		const completed = persisted.matches.find((m) => m.result !== null);
		expect(completed?.result).toBe("away");

		const { matches } = await client.match.getAll.query({
			seasonSlug: season.slug,
			limit: 10,
			offset: 0,
		});
		const recorded = matches.find((m) => m.homeScore === 2 && m.awayScore === 3);
		expect(recorded).toBeDefined();
	});

	it("rate limits a key once its per-key limit is reached", async () => {
		const { ctx, client } = await setupActiveSession();
		const key = await createKey(client, ["match:log"]);
		const db = getDb(env.DB);
		await db
			.update(apikey)
			.set({ rateLimitEnabled: true, rateLimitMax: 2, rateLimitTimeWindow: 60_000 })
			.where(eq(apikey.id, key.id));

		const req = () =>
			logMatchRequest({ leagueId: ctx.league.id, key: key.key, body: { home: 2, away: 3 } });
		expect((await req()).status).not.toBe(429);
		expect((await req()).status).not.toBe(429);

		const limited = await logMatchRequest({
			leagueId: ctx.league.id,
			key: key.key,
			body: { home: 2, away: 3 },
		});
		expect(limited.status).toBe(429);
		const data = (await limited.json()) as { error: string };
		expect(data.error).toBe("rate_limited");
	});

	it("forbids a session:start-only key from logging a match", async () => {
		const { ctx, client, session, seasonPlayers } = await setupActiveSession();

		await client.session.startNextMatch.mutate({
			sessionId: session.id,
			homeSeasonPlayerIds: [seasonPlayers[0].id, seasonPlayers[1].id],
			awaySeasonPlayerIds: [seasonPlayers[2].id, seasonPlayers[3].id],
		});

		const key = await createKey(client, ["session:start"]);
		const res = await logMatchRequest({
			leagueId: ctx.league.id,
			key: key.key,
			body: { home: 2, away: 3 },
		});
		expect(res.status).toBe(403);
		const data = (await res.json()) as { error: string };
		expect(data.error).toBe("insufficient_scope");
	});
});

describe("sessions v1 rest routes", () => {
	async function jsonRequest(
		leagueId: string,
		path: string,
		method: string,
		key: string,
		body?: unknown
	) {
		return SELF.fetch(sessionsUrl(leagueId, path), {
			method,
			headers: { "x-api-key": key, "Content-Type": "application/json" },
			...(body === undefined ? {} : { body: JSON.stringify(body) }),
		});
	}

	it("starts a session with default options", async () => {
		const { ctx, client, season } = await setupSeason();
		const key = await createKey(client, ["session:start"]);

		const res = await jsonRequest(ctx.league.id, "", "POST", key.key, {
			seasonSlug: season.slug,
		});

		expect(res.status).toBe(201);
		const data = (await res.json()) as {
			session: { id: string; rotationMode: string; teamSize: number };
		};
		expect(data.session.id).toBeDefined();
		expect(data.session.rotationMode).toBe("winner-stays");
		expect(data.session.teamSize).toBe(1);
	});

	it("ends the active session", async () => {
		const { ctx, client, session } = await setupActiveSession();
		const key = await createKey(client, ["session:stop"]);

		const res = await jsonRequest(ctx.league.id, "/active/end", "POST", key.key);

		expect(res.status).toBe(200);
		const data = (await res.json()) as { session: { id: string } };
		expect(data.session.id).toBe(session.id);
	});

	it("returns 404 when ending with no active session", async () => {
		const { ctx, client } = await setupSeason();
		const key = await createKey(client, ["session:stop"]);

		const res = await jsonRequest(ctx.league.id, "/active/end", "POST", key.key);

		expect(res.status).toBe(404);
	});

	it("starts the next match", async () => {
		const { ctx, client, seasonPlayers } = await setupActiveSession();
		const key = await createKey(client, ["match:start"]);

		const res = await jsonRequest(ctx.league.id, "/active/match/start", "POST", key.key, {
			home: [seasonPlayers[0].id, seasonPlayers[1].id],
			away: [seasonPlayers[2].id, seasonPlayers[3].id],
		});

		expect(res.status).toBe(201);
		const data = (await res.json()) as { match: { id: string } };
		expect(data.match.id).toBeDefined();
	});

	it("sets the lineup for the current match", async () => {
		const { ctx, client, session, seasonPlayers } = await setupActiveSession();
		await client.session.startNextMatch.mutate({
			sessionId: session.id,
			homeSeasonPlayerIds: [seasonPlayers[0].id, seasonPlayers[1].id],
			awaySeasonPlayerIds: [seasonPlayers[2].id, seasonPlayers[3].id],
		});
		const key = await createKey(client, ["match:lineup"]);

		const res = await jsonRequest(ctx.league.id, "/active/match/lineup", "PUT", key.key, {
			home: [seasonPlayers[0].id, seasonPlayers[1].id],
			away: [seasonPlayers[2].id, seasonPlayers[3].id],
		});

		expect(res.status).toBe(200);
		const data = (await res.json()) as { teamSelection: { id: string } };
		expect(data.teamSelection.id).toBeDefined();
	});

	it("updates the live score of the in-progress match without finishing it", async () => {
		const { ctx, client, session, seasonPlayers } = await setupActiveSession();
		await client.session.startNextMatch.mutate({
			sessionId: session.id,
			homeSeasonPlayerIds: [seasonPlayers[0].id, seasonPlayers[1].id],
			awaySeasonPlayerIds: [seasonPlayers[2].id, seasonPlayers[3].id],
		});
		const key = await createKey(client, ["match:score"]);

		const res = await jsonRequest(ctx.league.id, "/active/match/score", "PUT", key.key, {
			home: 3,
			away: 2,
		});

		expect(res.status).toBe(200);
		const data = (await res.json()) as {
			match: { homeSessionScore: number; awaySessionScore: number };
		};
		expect(data.match.homeSessionScore).toBe(3);
		expect(data.match.awaySessionScore).toBe(2);

		const forbidden = await jsonRequest(
			ctx.league.id,
			"/active/match/score",
			"PUT",
			(await createKey(client, ["match:log"])).key,
			{ home: 1, away: 1 }
		);
		expect(forbidden.status).toBe(403);
	});

	it("returns 404 when updating the live score with no in-progress match", async () => {
		const { ctx, client } = await setupActiveSession();
		const key = await createKey(client, ["match:score"]);
		const res = await jsonRequest(ctx.league.id, "/active/match/score", "PUT", key.key, {
			home: 1,
			away: 0,
		});
		expect(res.status).toBe(404);
	});

	it("works without leagueId in the path (league taken from the key)", async () => {
		const { client, session, seasonPlayers } = await setupActiveSession();
		await client.session.startNextMatch.mutate({
			sessionId: session.id,
			homeSeasonPlayerIds: [seasonPlayers[0].id, seasonPlayers[1].id],
			awaySeasonPlayerIds: [seasonPlayers[2].id, seasonPlayers[3].id],
		});
		const key = await createKey(client, ["match:score"]);
		const res = await SELF.fetch("http://example.com/leagues/v1/sessions/active/match/score", {
			method: "PUT",
			headers: { "x-api-key": key.key, "Content-Type": "application/json" },
			body: JSON.stringify({ home: 2, away: 1 }),
		});
		expect(res.status).toBe(200);
	});

	it("cancels the in-progress match", async () => {
		const { ctx, client, session, seasonPlayers } = await setupActiveSession();
		await client.session.startNextMatch.mutate({
			sessionId: session.id,
			homeSeasonPlayerIds: [seasonPlayers[0].id, seasonPlayers[1].id],
			awaySeasonPlayerIds: [seasonPlayers[2].id, seasonPlayers[3].id],
		});
		const key = await createKey(client, ["match:cancel", "match:score"]);

		const res = await jsonRequest(ctx.league.id, "/active/match", "DELETE", key.key);
		expect(res.status).toBe(200);

		const again = await jsonRequest(ctx.league.id, "/active/match/score", "PUT", key.key, {
			home: 1,
			away: 0,
		});
		expect(again.status).toBe(404);
	});

	it("rejects cancel without the match:cancel scope", async () => {
		const { ctx, client } = await setupActiveSession();
		const key = await createKey(client, ["match:score"]);
		const res = await jsonRequest(ctx.league.id, "/active/match", "DELETE", key.key);
		expect(res.status).toBe(403);
	});

	it("rejects a lineup containing players not in the season", async () => {
		const { ctx, client, session, seasonPlayers } = await setupActiveSession();
		await client.session.startNextMatch.mutate({
			sessionId: session.id,
			homeSeasonPlayerIds: [seasonPlayers[0].id, seasonPlayers[1].id],
			awaySeasonPlayerIds: [seasonPlayers[2].id, seasonPlayers[3].id],
		});
		const key = await createKey(client, ["match:lineup"]);

		const res = await jsonRequest(ctx.league.id, "/active/match/lineup", "PUT", key.key, {
			home: [seasonPlayers[0].id, seasonPlayers[1].id],
			away: [seasonPlayers[2].id, randUuid()],
		});

		expect(res.status).toBe(400);
	});

	it("rejects an invalid log body", async () => {
		const { ctx, client } = await setupActiveSession();
		const key = await createKey(client, ["match:log"]);

		const negative = await logMatchRequest({
			leagueId: ctx.league.id,
			key: key.key,
			body: { home: -1, away: 3 },
		});
		expect(negative.status).toBe(400);

		const missing = await logMatchRequest({
			leagueId: ctx.league.id,
			key: key.key,
			body: { home: 2 },
		});
		expect(missing.status).toBe(400);
	});
});
