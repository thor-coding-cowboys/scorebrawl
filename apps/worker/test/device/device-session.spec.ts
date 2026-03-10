import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { createAuthContext } from "../setup/auth-context-util";
import { createPlayers } from "../setup/season-context-util";
import { createTRPCTestClient } from "../trpc/trpc-test-client";

async function createApiKey(sessionToken: string) {
	const response = await SELF.fetch("http://localhost/api/auth/api-key/create", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Cookie: `better-auth.session_token=${sessionToken}`,
			Origin: "http://localhost",
		},
		body: JSON.stringify({ name: "Test Device" }),
	});
	const data = (await response.json()) as { key: string };
	return data.key;
}

async function setupSessionContext(playerCount = 4) {
	const ctx = await createAuthContext();
	const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

	await createPlayers(ctx, playerCount);
	const season = await client.season.create.mutate({
		name: "Session Test Season",
		initialScore: 1000,
		scoreType: "elo",
		kFactor: 32,
		startDate: new Date(),
	});

	const seasonPlayers = await client.seasonPlayer.getAll.query({ seasonSlug: season.slug });
	const apiKey = await createApiKey(ctx.sessionToken);

	return { ctx, client, season, seasonPlayers, apiKey };
}

function deviceFetch(path: string, apiKey: string, options: RequestInit = {}) {
	return SELF.fetch(`http://localhost/api/device${path}`, {
		...options,
		headers: {
			"x-api-key": apiKey,
			...(options.body ? { "Content-Type": "application/json" } : {}),
			...((options.headers as Record<string, string>) ?? {}),
		},
	});
}

interface SessionResponse {
	session: {
		id: string;
		seasonSlug: string;
		matchCount: number;
		teamSize: number;
		rotationMode: string;
		state: "proposed_lineup" | "match_in_progress" | "coin_toss_pending";
		currentMatch: {
			sessionMatchId: string;
			matchNumber: number;
			home: { sessionPlayerId: string; name: string }[];
			away: { sessionPlayerId: string; name: string }[];
			homeScore: number;
			awayScore: number;
		} | null;
		proposedLineup: {
			home: { sessionPlayerId: string; name: string }[];
			away: { sessionPlayerId: string; name: string }[];
		} | null;
		pendingCoinToss: {
			id: string;
			conflictType: string;
			candidates: { sessionPlayerId: string; name: string }[];
		} | null;
		queue: { sessionPlayerId: string; name: string }[];
	} | null;
}

describe("device session API", () => {
	describe("GET /session/active", () => {
		it("returns null when no active session", async () => {
			const { ctx, apiKey } = await setupSessionContext(2);

			const response = await deviceFetch(`/leagues/${ctx.league.slug}/session/active`, apiKey);

			expect(response.status).toBe(200);
			const data = (await response.json()) as SessionResponse;
			expect(data.session).toBeNull();
		});

		it("returns session with proposed lineup", async () => {
			const { ctx, client, season, seasonPlayers, apiKey } = await setupSessionContext(4);

			await client.session.create.mutate({
				seasonSlug: season.slug,
				rotationMode: "winner-stays",
				teamSize: 1,
				maxConsecutiveGames: null,
				seasonPlayerIds: seasonPlayers.map((p) => p.id),
			});

			const response = await deviceFetch(`/leagues/${ctx.league.slug}/session/active`, apiKey);

			expect(response.status).toBe(200);
			const data = (await response.json()) as SessionResponse;
			expect(data.session).not.toBeNull();
			expect(data.session!.state).toBe("proposed_lineup");
			expect(data.session!.rotationMode).toBe("winner-stays");
			expect(data.session!.teamSize).toBe(1);
			expect(data.session!.proposedLineup).not.toBeNull();
			expect(data.session!.proposedLineup!.home.length).toBe(1);
			expect(data.session!.proposedLineup!.away.length).toBe(1);
			expect(data.session!.currentMatch).toBeNull();
			expect(data.session!.queue.length).toBe(2);
		});

		it("returns session with match in progress", async () => {
			const { ctx, client, season, seasonPlayers, apiKey } = await setupSessionContext(4);

			const session = await client.session.create.mutate({
				seasonSlug: season.slug,
				rotationMode: "winner-stays",
				teamSize: 1,
				maxConsecutiveGames: null,
				seasonPlayerIds: seasonPlayers.map((p) => p.id),
			});

			await client.session.startNextMatch.mutate({
				sessionId: session.id,
				homeSeasonPlayerIds: [seasonPlayers[0].id],
				awaySeasonPlayerIds: [seasonPlayers[1].id],
			});

			const response = await deviceFetch(`/leagues/${ctx.league.slug}/session/active`, apiKey);

			expect(response.status).toBe(200);
			const data = (await response.json()) as SessionResponse;
			expect(data.session).not.toBeNull();
			expect(data.session!.state).toBe("match_in_progress");
			expect(data.session!.currentMatch).not.toBeNull();
			expect(data.session!.currentMatch!.matchNumber).toBe(1);
			expect(data.session!.currentMatch!.home.length).toBe(1);
			expect(data.session!.currentMatch!.away.length).toBe(1);
		});
	});

	describe("POST /session/start-match", () => {
		it("starts match from proposed lineup", async () => {
			const { ctx, client, season, seasonPlayers, apiKey } = await setupSessionContext(4);

			await client.session.create.mutate({
				seasonSlug: season.slug,
				rotationMode: "winner-stays",
				teamSize: 1,
				maxConsecutiveGames: null,
				seasonPlayerIds: seasonPlayers.map((p) => p.id),
			});

			const response = await deviceFetch(
				`/leagues/${ctx.league.slug}/session/start-match`,
				apiKey,
				{ method: "POST" }
			);

			expect(response.status).toBe(200);
			const data = (await response.json()) as { success: boolean; matchNumber: number };
			expect(data.success).toBe(true);
			expect(data.matchNumber).toBe(1);

			const stateResponse = await deviceFetch(`/leagues/${ctx.league.slug}/session/active`, apiKey);
			const state = (await stateResponse.json()) as SessionResponse;
			expect(state.session!.state).toBe("match_in_progress");
		});

		it("errors when no proposed lineup", async () => {
			const { ctx, client, season, seasonPlayers, apiKey } = await setupSessionContext(4);

			const session = await client.session.create.mutate({
				seasonSlug: season.slug,
				rotationMode: "winner-stays",
				teamSize: 1,
				maxConsecutiveGames: null,
				seasonPlayerIds: seasonPlayers.map((p) => p.id),
			});

			await client.session.startNextMatch.mutate({
				sessionId: session.id,
				homeSeasonPlayerIds: [seasonPlayers[0].id],
				awaySeasonPlayerIds: [seasonPlayers[1].id],
			});

			const fullSession = await client.session.getById.query({ sessionId: session.id });
			const match = fullSession.matches.find((m) => m.result === null)!;

			await client.session.recordResult.mutate({
				sessionId: session.id,
				sessionMatchId: match.id,
				homeScore: 1,
				awayScore: 0,
			});

			await client.session.startNextMatch.mutate({
				sessionId: session.id,
				homeSeasonPlayerIds: [seasonPlayers[0].id],
				awaySeasonPlayerIds: [seasonPlayers[2].id],
			});

			const response = await deviceFetch(
				`/leagues/${ctx.league.slug}/session/start-match`,
				apiKey,
				{ method: "POST" }
			);

			expect(response.status).toBe(400);
		});

		it("errors when match already in progress", async () => {
			const { ctx, client, season, seasonPlayers, apiKey } = await setupSessionContext(4);

			const session = await client.session.create.mutate({
				seasonSlug: season.slug,
				rotationMode: "winner-stays",
				teamSize: 1,
				maxConsecutiveGames: null,
				seasonPlayerIds: seasonPlayers.map((p) => p.id),
			});

			await client.session.startNextMatch.mutate({
				sessionId: session.id,
				homeSeasonPlayerIds: [seasonPlayers[0].id],
				awaySeasonPlayerIds: [seasonPlayers[1].id],
			});

			const response = await deviceFetch(
				`/leagues/${ctx.league.slug}/session/start-match`,
				apiKey,
				{ method: "POST" }
			);

			expect(response.status).toBe(400);
		});
	});

	describe("POST /session/record-result", () => {
		it("records result and returns new state with proposed lineup", async () => {
			const { ctx, client, season, seasonPlayers, apiKey } = await setupSessionContext(4);

			const session = await client.session.create.mutate({
				seasonSlug: season.slug,
				rotationMode: "winner-stays",
				teamSize: 1,
				maxConsecutiveGames: null,
				seasonPlayerIds: seasonPlayers.map((p) => p.id),
			});

			await client.session.startNextMatch.mutate({
				sessionId: session.id,
				homeSeasonPlayerIds: [seasonPlayers[0].id],
				awaySeasonPlayerIds: [seasonPlayers[1].id],
			});

			const response = await deviceFetch(
				`/leagues/${ctx.league.slug}/session/record-result?homeScore=3&awayScore=1`,
				apiKey,
				{
					method: "POST",
				}
			);

			expect(response.status).toBe(200);
			const data = (await response.json()) as SessionResponse;
			expect(data.session).not.toBeNull();
			expect(data.session!.matchCount).toBe(1);
			expect(data.session!.proposedLineup).not.toBeNull();
			expect(data.session!.currentMatch).toBeNull();
		});

		it("errors when no match in progress", async () => {
			const { ctx, client, season, seasonPlayers, apiKey } = await setupSessionContext(4);

			await client.session.create.mutate({
				seasonSlug: season.slug,
				rotationMode: "winner-stays",
				teamSize: 1,
				maxConsecutiveGames: null,
				seasonPlayerIds: seasonPlayers.map((p) => p.id),
			});

			const response = await deviceFetch(
				`/leagues/${ctx.league.slug}/session/record-result?homeScore=1&awayScore=0`,
				apiKey,
				{
					method: "POST",
				}
			);

			expect(response.status).toBe(400);
		});
	});

	describe("auth", () => {
		it("returns 401 without API key", async () => {
			const ctx = await createAuthContext();

			const response = await SELF.fetch(
				`http://localhost/api/device/leagues/${ctx.league.slug}/session/active`
			);

			expect(response.status).toBe(401);
		});

		it("returns 403 for non-member league", async () => {
			const ctx = await createAuthContext();
			const otherCtx = await createAuthContext();
			const apiKey = await createApiKey(ctx.sessionToken);

			const response = await deviceFetch(`/leagues/${otherCtx.league.slug}/session/active`, apiKey);

			expect(response.status).toBe(403);
		});
	});
});
