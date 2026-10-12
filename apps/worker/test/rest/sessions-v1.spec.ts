import { describe, expect, it } from "vitest";
import { SELF } from "cloudflare:test";
import { createAuthContext } from "../setup/auth-context-util";
import { createPlayers } from "../setup/season-context-util";
import { createTRPCTestClient } from "../trpc/trpc-test-client";

type TestClient = ReturnType<typeof createTRPCTestClient>;

async function setupActiveSession(playerCount = 4, teamSize = 2) {
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
	return `http://example.com/api/v1/leagues/${leagueId}/sessions${path}`;
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
