import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { createAuthContext } from "../setup/auth-context-util";
import { createPlayers } from "../setup/season-context-util";
import { createTRPCTestClient } from "../trpc/trpc-test-client";

interface PlayerData {
	id: string;
	name: string;
}

async function setupPlayersAndSeason(
	ctx: Awaited<ReturnType<typeof createAuthContext>>,
	playerCount: number,
	seasonOptions: { closed?: boolean } = {}
) {
	const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

	// Create players using the helper
	await createPlayers(ctx, playerCount);

	const season = await client.season.create.mutate({
		name: "Test Season",
		initialScore: 1000,
		scoreType: "elo",
		kFactor: 32,
		startDate: new Date(),
	});

	if (seasonOptions.closed) {
		await client.season.updateClosedStatus.mutate({ seasonSlug: season.slug, closed: true });
	}

	const seasonPlayers = await client.seasonPlayer.getAll.query({
		seasonSlug: season.slug,
	});

	return {
		season,
		players: seasonPlayers.map((sp) => ({
			id: sp.id,
			name: sp.name,
		})) as PlayerData[],
	};
}

// Create API key using Better Auth's built-in endpoint
async function createApiKey(sessionToken: string, name = "Test Device") {
	const response = await SELF.fetch("http://example.com/api/auth/api-key/create", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Cookie: `better-auth.session_token=${sessionToken}`,
		},
		body: JSON.stringify({ name }),
	});
	return response;
}

describe("device API", () => {
	describe("Better Auth API Key endpoints", () => {
		it("creates an API key via /api/auth/api-key/create", async () => {
			const ctx = await createAuthContext();

			const response = await createApiKey(ctx.sessionToken);

			expect(response.status).toBe(200);
			const data = (await response.json()) as {
				id: string;
				name: string;
				key: string;
				start: string;
			};
			expect(data.id).toBeDefined();
			expect(data.name).toBe("Test Device");
			expect(data.key).toMatch(/^sb_dev/);
			expect(data.start).toBeDefined();
		});

		it("lists API keys via /api/auth/api-key/list", async () => {
			const ctx = await createAuthContext();
			await createApiKey(ctx.sessionToken, "Device 1");
			await createApiKey(ctx.sessionToken, "Device 2");

			const response = await SELF.fetch("http://example.com/api/auth/api-key/list", {
				headers: {
					Cookie: `better-auth.session_token=${ctx.sessionToken}`,
				},
			});

			expect(response.status).toBe(200);
			const data = (await response.json()) as Array<{ id: string; name: string }>;
			expect(data.length).toBe(2);
		});

		it("returns 401 without authentication", async () => {
			const response = await SELF.fetch("http://example.com/api/auth/api-key/create", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: "Test" }),
			});

			expect(response.status).toBe(401);
		});
	});

	describe("GET /api/device/leagues", () => {
		it("lists user leagues with valid API key", async () => {
			const ctx = await createAuthContext();
			const keyResponse = await createApiKey(ctx.sessionToken);
			const keyData = (await keyResponse.json()) as { key: string };

			const response = await SELF.fetch("http://example.com/api/device/leagues", {
				headers: { Authorization: `Bearer ${keyData.key}` },
			});

			expect(response.status).toBe(200);
			const data = (await response.json()) as { leagues: { slug: string }[] };
			expect(data.leagues).toBeInstanceOf(Array);
			expect(data.leagues.length).toBeGreaterThan(0);
			expect(data.leagues.some((l) => l.slug === ctx.league.slug)).toBe(true);
		});

		it("returns 401 without API key", async () => {
			const response = await SELF.fetch("http://example.com/api/device/leagues");

			expect(response.status).toBe(401);
		});

		it("returns 401 with invalid API key", async () => {
			const response = await SELF.fetch("http://example.com/api/device/leagues", {
				headers: { Authorization: "Bearer sb_dev_invalid_key_here" },
			});

			expect(response.status).toBe(401);
		});
	});

	describe("GET /api/device/leagues/:slug/context", () => {
		it("returns league context with players", async () => {
			const ctx = await createAuthContext();
			const { season } = await setupPlayersAndSeason(ctx, 3);

			const keyResponse = await createApiKey(ctx.sessionToken);
			const keyData = (await keyResponse.json()) as { key: string };

			const response = await SELF.fetch(
				`http://example.com/api/device/leagues/${ctx.league.slug}/context`,
				{
					headers: { Authorization: `Bearer ${keyData.key}` },
				}
			);

			expect(response.status).toBe(200);
			const data = (await response.json()) as {
				league: { id: string; name: string; slug: string };
				season: { id: string; name: string; slug: string } | null;
				players: { id: string; name: string; score: number }[];
			};
			expect(data.league.slug).toBe(ctx.league.slug);
			expect(data.season).not.toBeNull();
			expect(data.season?.slug).toBe(season.slug);
			expect(data.players.length).toBe(3);
		});

		it("returns 403 for league user is not member of", async () => {
			const ctx = await createAuthContext();
			const otherCtx = await createAuthContext();

			const keyResponse = await createApiKey(ctx.sessionToken);
			const keyData = (await keyResponse.json()) as { key: string };

			// Try to access the other user's league
			const response = await SELF.fetch(
				`http://example.com/api/device/leagues/${otherCtx.league.slug}/context`,
				{
					headers: { Authorization: `Bearer ${keyData.key}` },
				}
			);

			expect(response.status).toBe(403);
		});
	});

	describe("POST /api/device/leagues/:slug/matches", () => {
		it("creates a match with player names", async () => {
			const ctx = await createAuthContext();
			const { season, players } = await setupPlayersAndSeason(ctx, 2);

			const keyResponse = await createApiKey(ctx.sessionToken);
			const keyData = (await keyResponse.json()) as { key: string };

			const response = await SELF.fetch(
				`http://example.com/api/device/leagues/${ctx.league.slug}/matches`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${keyData.key}`,
					},
					body: JSON.stringify({
						seasonSlug: season.slug,
						homePlayerNames: [players[0].name],
						awayPlayerNames: [players[1].name],
						homeScore: 3,
						awayScore: 1,
					}),
				}
			);

			expect(response.status).toBe(200);
			const data = (await response.json()) as {
				success: boolean;
				match: { id: string; homeScore: number; awayScore: number };
			};
			expect(data.success).toBe(true);
			expect(data.match.homeScore).toBe(3);
			expect(data.match.awayScore).toBe(1);
		});

		it("matches players by first name", async () => {
			const ctx = await createAuthContext();
			const { season, players } = await setupPlayersAndSeason(ctx, 2);

			const keyResponse = await createApiKey(ctx.sessionToken);
			const keyData = (await keyResponse.json()) as { key: string };

			const firstName0 = players[0].name.split(" ")[0];
			const firstName1 = players[1].name.split(" ")[0];

			const response = await SELF.fetch(
				`http://example.com/api/device/leagues/${ctx.league.slug}/matches`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${keyData.key}`,
					},
					body: JSON.stringify({
						seasonSlug: season.slug,
						homePlayerNames: [firstName0],
						awayPlayerNames: [firstName1],
						homeScore: 2,
						awayScore: 0,
					}),
				}
			);

			expect(response.status).toBe(200);
			const data = (await response.json()) as { success: boolean };
			expect(data.success).toBe(true);
		});

		it("returns error for unmatched players", async () => {
			const ctx = await createAuthContext();
			const { season } = await setupPlayersAndSeason(ctx, 2);

			const keyResponse = await createApiKey(ctx.sessionToken);
			const keyData = (await keyResponse.json()) as { key: string };

			const response = await SELF.fetch(
				`http://example.com/api/device/leagues/${ctx.league.slug}/matches`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${keyData.key}`,
					},
					body: JSON.stringify({
						seasonSlug: season.slug,
						homePlayerNames: ["NonExistentPlayer"],
						awayPlayerNames: ["AnotherFakeName"],
						homeScore: 1,
						awayScore: 0,
					}),
				}
			);

			expect(response.status).toBe(400);
			const data = (await response.json()) as {
				error: string;
				unmatchedPlayers: string[];
				availablePlayers: string[];
			};
			expect(data.error).toBe("Could not match players");
			expect(data.unmatchedPlayers).toContain("NonExistentPlayer");
			expect(data.availablePlayers).toBeInstanceOf(Array);
		});

		it("creates 2v2 match", async () => {
			const ctx = await createAuthContext();
			const { season, players } = await setupPlayersAndSeason(ctx, 4);

			const keyResponse = await createApiKey(ctx.sessionToken);
			const keyData = (await keyResponse.json()) as { key: string };

			const response = await SELF.fetch(
				`http://example.com/api/device/leagues/${ctx.league.slug}/matches`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${keyData.key}`,
					},
					body: JSON.stringify({
						seasonSlug: season.slug,
						homePlayerNames: [players[0].name, players[1].name],
						awayPlayerNames: [players[2].name, players[3].name],
						homeScore: 5,
						awayScore: 3,
					}),
				}
			);

			expect(response.status).toBe(200);
			const data = (await response.json()) as {
				success: boolean;
				match: { homePlayers: string[]; awayPlayers: string[] };
			};
			expect(data.success).toBe(true);
			expect(data.match.homePlayers.length).toBe(2);
			expect(data.match.awayPlayers.length).toBe(2);
		});

		it("returns error for closed season", async () => {
			const ctx = await createAuthContext();
			const { season, players } = await setupPlayersAndSeason(ctx, 2, { closed: true });

			const keyResponse = await createApiKey(ctx.sessionToken);
			const keyData = (await keyResponse.json()) as { key: string };

			const response = await SELF.fetch(
				`http://example.com/api/device/leagues/${ctx.league.slug}/matches`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${keyData.key}`,
					},
					body: JSON.stringify({
						seasonSlug: season.slug,
						homePlayerNames: [players[0].name],
						awayPlayerNames: [players[1].name],
						homeScore: 1,
						awayScore: 0,
					}),
				}
			);

			expect(response.status).toBe(400);
			const data = (await response.json()) as { error: string };
			expect(data.error).toBe("Season is closed");
		});

		it("returns 403 for league user is not member of", async () => {
			const ctx = await createAuthContext();
			const otherCtx = await createAuthContext();
			const { season, players } = await setupPlayersAndSeason(otherCtx, 2);

			const keyResponse = await createApiKey(ctx.sessionToken);
			const keyData = (await keyResponse.json()) as { key: string };

			const response = await SELF.fetch(
				`http://example.com/api/device/leagues/${otherCtx.league.slug}/matches`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${keyData.key}`,
					},
					body: JSON.stringify({
						seasonSlug: season.slug,
						homePlayerNames: [players[0].name],
						awayPlayerNames: [players[1].name],
						homeScore: 1,
						awayScore: 0,
					}),
				}
			);

			expect(response.status).toBe(403);
		});
	});
});
