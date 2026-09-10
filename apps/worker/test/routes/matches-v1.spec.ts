import { describe, expect, it } from "vitest";
import { SELF, env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { getDb } from "../../src/db/index";
import { guest } from "../../src/db/schema/league-schema";
import { createAuthContext } from "../setup/auth-context-util";
import { createPlayers } from "../setup/season-context-util";
import { createTRPCTestClient } from "../trpc/trpc-test-client";
import { getAccessToken, registerOAuthClient } from "../setup/oauth-util";

async function createOneVnSeason() {
	const ctx = await createAuthContext();
	const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });
	await createPlayers(ctx, 4);
	const season = await client.season.create.mutate({
		name: "BullsAI 1-v-N",
		initialScore: 1000,
		scoreType: "1-v-n-elo",
		kFactor: 32,
		startDate: new Date(),
	});
	const seasonPlayers = await client.seasonPlayer.getAll.query({
		seasonSlug: season.slug,
	});
	return { ctx, client, season, seasonPlayers };
}

function matchUrl(leagueId: string, seasonId: string) {
	return `http://example.com/api/v1/leagues/${leagueId}/seasons/${seasonId}/matches`;
}

async function pushMatch(opts: {
	leagueId: string;
	seasonId: string;
	accessToken: string;
	body: Record<string, unknown>;
}) {
	return SELF.fetch(matchUrl(opts.leagueId, opts.seasonId), {
		method: "POST",
		headers: {
			Authorization: `Bearer ${opts.accessToken}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(opts.body),
	});
}

describe("matches v1 public API", () => {
	it("pushes a 1-v-n result and updates ELO + standings", async () => {
		const { ctx, season, seasonPlayers } = await createOneVnSeason();
		const [winner, ...losers] = seasonPlayers;

		const oauthClient = await registerOAuthClient({ sessionToken: ctx.sessionToken });
		const { accessToken } = await getAccessToken({
			sessionToken: ctx.sessionToken,
			client: oauthClient,
		});

		const res = await pushMatch({
			leagueId: ctx.league.id,
			seasonId: season.id,
			accessToken,
			body: {
				gameId: "bullsai-game-123",
				winner: { scorebrawlUserId: winner.userId },
				losers: losers.map((l) => ({ scorebrawlUserId: l.userId })),
			},
		});

		expect(res.status).toBe(201);
		const data = (await res.json()) as { match: { id: string } };
		expect(data.match.id).toBe("bullsai-game-123");

		const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });
		const standing = await client.seasonPlayer.getStanding.query({ seasonSlug: season.slug });
		const winnerRow = standing.find((p) => p.id === winner.id);
		expect(winnerRow?.score).toBeGreaterThan(1000);
		expect(winnerRow?.winCount).toBe(1);
		for (const loser of losers) {
			const row = standing.find((p) => p.id === loser.id);
			expect(row?.score).toBeLessThan(1000);
		}
	});

	it("is idempotent: replaying the same gameId does not duplicate the match", async () => {
		const { ctx, season, seasonPlayers } = await createOneVnSeason();
		const [winner, ...losers] = seasonPlayers;
		const oauthClient = await registerOAuthClient({ sessionToken: ctx.sessionToken });
		const { accessToken } = await getAccessToken({
			sessionToken: ctx.sessionToken,
			client: oauthClient,
		});

		const body = {
			gameId: "bullsai-game-dup",
			winner: { scorebrawlUserId: winner.userId },
			losers: losers.map((l) => ({ scorebrawlUserId: l.userId })),
		};

		const first = await pushMatch({
			leagueId: ctx.league.id,
			seasonId: season.id,
			accessToken,
			body,
		});
		expect(first.status).toBe(201);

		const second = await pushMatch({
			leagueId: ctx.league.id,
			seasonId: season.id,
			accessToken,
			body,
		});
		expect(second.status).toBe(409);

		const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });
		const result = await client.match.getAll.query({
			seasonSlug: season.slug,
			limit: 10,
			offset: 0,
		});
		expect(result.matches).toHaveLength(1);
	});

	it("auto-creates a guest when a participant is only matched by email", async () => {
		const { ctx, season, seasonPlayers } = await createOneVnSeason();
		const [winner] = seasonPlayers;
		const oauthClient = await registerOAuthClient({ sessionToken: ctx.sessionToken });
		const { accessToken } = await getAccessToken({
			sessionToken: ctx.sessionToken,
			client: oauthClient,
		});

		const res = await pushMatch({
			leagueId: ctx.league.id,
			seasonId: season.id,
			accessToken,
			body: {
				gameId: "bullsai-game-guest",
				winner: { scorebrawlUserId: winner.userId },
				losers: [{ email: "guest@example.com", name: "Guest" }],
			},
		});

		expect(res.status).toBe(201);

		const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });
		const standing = await client.seasonPlayer.getStanding.query({ seasonSlug: season.slug });
		expect(standing).toHaveLength(5);

		const guests = await getDb(env.DB)
			.select({ id: guest.id })
			.from(guest)
			.where(eq(guest.email, "guest@example.com"));
		expect(guests).toHaveLength(1);

		const guestRow = standing.find((p) => p.isGuest && p.name === "Guest");
		expect(guestRow).toBeDefined();
		expect(guestRow?.score).toBeLessThan(1000);
	});

	it("rejects a token without create:matches scope with 403 insufficient_scope", async () => {
		const { ctx, season, seasonPlayers } = await createOneVnSeason();
		const [winner, ...losers] = seasonPlayers;

		const oauthClient = await registerOAuthClient({
			sessionToken: ctx.sessionToken,
			scope: "openid profile email offline_access read:matches",
		});
		const { accessToken } = await getAccessToken({
			sessionToken: ctx.sessionToken,
			client: oauthClient,
			scopes: "openid profile email offline_access read:matches",
		});

		const res = await pushMatch({
			leagueId: ctx.league.id,
			seasonId: season.id,
			accessToken,
			body: {
				gameId: "bullsai-game-noscope",
				winner: { scorebrawlUserId: winner.userId },
				losers: losers.map((l) => ({ scorebrawlUserId: l.userId })),
			},
		});

		expect(res.status).toBe(403);
		const data = (await res.json()) as { error: string };
		expect(data.error).toBe("insufficient_scope");
		expect(res.headers.get("www-authenticate")).toContain("insufficient_scope");
	});

	it("returns 401 with WWW-Authenticate for missing/invalid bearer token", async () => {
		const { ctx, season } = await createOneVnSeason();

		const res = await pushMatch({
			leagueId: ctx.league.id,
			seasonId: season.id,
			accessToken: "not-a-real-token",
			body: {
				gameId: "bullsai-game-x",
				winner: { email: "a@b.com" },
				losers: [{ email: "c@d.com" }],
			},
		});

		expect(res.status).toBe(401);
		expect(res.headers.get("www-authenticate")).toContain("invalid_token");

		const noToken = await SELF.fetch(matchUrl(ctx.league.id, season.id), {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				gameId: "bullsai-game-y",
				winner: { email: "a@b.com" },
				losers: [{ email: "c@d.com" }],
			}),
		});
		expect(noToken.status).toBe(401);
	});

	it("GET requires read:matches and lists season matches", async () => {
		const { ctx, season, seasonPlayers } = await createOneVnSeason();
		const [winner, ...losers] = seasonPlayers;

		const createClient = await registerOAuthClient({
			sessionToken: ctx.sessionToken,
			scope: "openid profile email offline_access create:matches",
		});
		const { accessToken } = await getAccessToken({
			sessionToken: ctx.sessionToken,
			client: createClient,
			scopes: "openid profile email offline_access create:matches",
		});

		const push = await pushMatch({
			leagueId: ctx.league.id,
			seasonId: season.id,
			accessToken,
			body: {
				gameId: "bullsai-game-get",
				winner: { scorebrawlUserId: winner.userId },
				losers: losers.map((l) => ({ scorebrawlUserId: l.userId })),
			},
		});
		expect(push.status).toBe(201);

		// create-only token cannot read
		const readBlocked = await SELF.fetch(matchUrl(ctx.league.id, season.id), {
			headers: { Authorization: `Bearer ${accessToken}` },
		});
		expect(readBlocked.status).toBe(403);

		// read:matches token can
		const readClient = await registerOAuthClient({
			sessionToken: ctx.sessionToken,
			scope: "openid profile email offline_access read:matches",
		});
		const readToken = await getAccessToken({
			sessionToken: ctx.sessionToken,
			client: readClient,
			scopes: "openid profile email offline_access read:matches",
		});
		const readRes = await SELF.fetch(matchUrl(ctx.league.id, season.id), {
			headers: { Authorization: `Bearer ${readToken.accessToken}` },
		});
		expect(readRes.status).toBe(200);
		const list = (await readRes.json()) as { matches: Array<{ id: string }> };
		expect(list.matches).toHaveLength(1);
		expect(list.matches[0].id).toBe("bullsai-game-get");
	});

	it("completes the consent flow when the client does not skip consent", async () => {
		const { ctx, season, seasonPlayers } = await createOneVnSeason();
		const [winner, ...losers] = seasonPlayers;

		const oauthClient = await registerOAuthClient({
			sessionToken: ctx.sessionToken,
			skipConsent: false,
		});
		const { accessToken } = await getAccessToken({
			sessionToken: ctx.sessionToken,
			client: oauthClient,
			acceptConsent: true,
		});
		expect(accessToken).toBeTruthy();

		const res = await pushMatch({
			leagueId: ctx.league.id,
			seasonId: season.id,
			accessToken,
			body: {
				gameId: "bullsai-game-consent",
				winner: { scorebrawlUserId: winner.userId },
				losers: losers.map((l) => ({ scorebrawlUserId: l.userId })),
			},
		});
		expect(res.status).toBe(201);
	});
});

describe("matches v1 authorization", () => {
	it("rejects a token whose owner is not a league member", async () => {
		const { ctx, season, seasonPlayers } = await createOneVnSeason();
		const [winner] = seasonPlayers;

		// Another user (not a member of the league) links and pushes
		const other = await createAuthContext();
		const oauthClient = await registerOAuthClient({ sessionToken: other.sessionToken });
		const { accessToken } = await getAccessToken({
			sessionToken: other.sessionToken,
			client: oauthClient,
		});

		const res = await pushMatch({
			leagueId: ctx.league.id,
			seasonId: season.id,
			accessToken,
			body: {
				gameId: "bullsai-game-notmember",
				winner: { scorebrawlUserId: winner.userId },
				losers: [{ email: "someone@else.com" }],
			},
		});

		expect(res.status).toBe(403);
	});

	it("rejects a participant with neither userId nor email", async () => {
		const { ctx, season, seasonPlayers } = await createOneVnSeason();
		const [winner] = seasonPlayers;
		const oauthClient = await registerOAuthClient({ sessionToken: ctx.sessionToken });
		const { accessToken } = await getAccessToken({
			sessionToken: ctx.sessionToken,
			client: oauthClient,
		});

		const res = await pushMatch({
			leagueId: ctx.league.id,
			seasonId: season.id,
			accessToken,
			body: {
				gameId: "bullsai-game-noid",
				winner: { scorebrawlUserId: winner.userId },
				losers: [{ name: "Anonymous" }],
			},
		});

		expect(res.status).toBe(400);
	});
});
