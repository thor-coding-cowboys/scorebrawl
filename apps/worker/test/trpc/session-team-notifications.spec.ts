import { env } from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getDb } from "../../src/db/index";
import { pushToken } from "../../src/db/schema/user-preferences-schema";
import { createAuthContext } from "../setup/auth-context-util";
import { createPlayers } from "../setup/season-context-util";
import { createTRPCTestClient } from "./trpc-test-client";

describe("session team notifications", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	async function setup(playerCount = 4, autoCoinToss = false) {
		const db = getDb(env.DB);
		const ctx = await createAuthContext();
		const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });
		const players = await createPlayers(ctx, playerCount);

		const season = await client.season.create.mutate({
			name: "Teams Season",
			initialScore: 1000,
			scoreType: "elo",
			kFactor: 32,
			startDate: new Date(),
		});
		const seasonPlayers = await client.seasonPlayer.getAll.query({ seasonSlug: season.slug });
		const session = await client.session.create.mutate({
			seasonSlug: season.slug,
			rotationMode: "winner-stays",
			teamSize: 2,
			maxConsecutiveGames: null,
			autoCoinToss,
			seasonPlayerIds: seasonPlayers.map((p) => p.id),
		});

		await db.insert(pushToken).values(
			players.map((p, i) => ({
				id: crypto.randomUUID(),
				userId: p.userId!,
				token: `token-${i}`,
				platform: "ios" as const,
				createdAt: new Date(),
				updatedAt: new Date(),
			}))
		);

		const fetchMock = vi.fn(
			async () => new Response(JSON.stringify({ data: [] }), { status: 200 })
		);
		vi.stubGlobal("fetch", fetchMock);

		return { db, ctx, client, players, season, seasonPlayers, session, fetchMock };
	}

	function sentMessages(fetchMock: ReturnType<typeof vi.fn>) {
		const calls = fetchMock.mock.calls as Array<[string, RequestInit]>;
		return calls.flatMap(
			([, init]) =>
				JSON.parse(init.body as string) as Array<{
					to: string;
					title: string;
					body: string;
					data: { type: string };
				}>
		);
	}

	function teamMessages(fetchMock: ReturnType<typeof vi.fn>) {
		return sentMessages(fetchMock).filter((message) => message.data.type === "session:teams");
	}

	it("pushes New teams to the other active players after a recorded game", async () => {
		const { client, seasonPlayers, session, fetchMock } = await setup(4);

		await client.session.startNextMatch.mutate({
			sessionId: session.id,
			homeSeasonPlayerIds: [seasonPlayers[0].id, seasonPlayers[1].id],
			awaySeasonPlayerIds: [seasonPlayers[2].id, seasonPlayers[3].id],
		});
		const withMatch = await client.session.getById.query({ sessionId: session.id });
		const match = withMatch.matches.find((m) => m.result === null)!;

		await client.session.recordResult.mutate({
			sessionId: session.id,
			sessionMatchId: match.id,
			homeScore: 3,
			awayScore: 1,
		});

		await vi.waitFor(() => expect(teamMessages(fetchMock).length).toBeGreaterThan(0));

		const messages = teamMessages(fetchMock);
		expect(messages.every((message) => message.title === "New teams")).toBe(true);
		expect(messages.every((message) => message.body.includes(" vs "))).toBe(true);
		// players[0] is the actor and must be excluded
		expect(new Set(messages.map((message) => message.to))).toEqual(
			new Set(["token-1", "token-2", "token-3"])
		);
	});

	it("does not push when no teams are formed (draw, autoCoinToss off)", async () => {
		const { client, seasonPlayers, session, fetchMock } = await setup(4, false);

		await client.session.startNextMatch.mutate({
			sessionId: session.id,
			homeSeasonPlayerIds: [seasonPlayers[0].id, seasonPlayers[1].id],
			awaySeasonPlayerIds: [seasonPlayers[2].id, seasonPlayers[3].id],
		});
		const withMatch = await client.session.getById.query({ sessionId: session.id });
		const match = withMatch.matches.find((m) => m.result === null)!;

		await client.session.recordResult.mutate({
			sessionId: session.id,
			sessionMatchId: match.id,
			homeScore: 1,
			awayScore: 1,
		});

		await new Promise((resolve) => setTimeout(resolve, 100));
		expect(teamMessages(fetchMock)).toHaveLength(0);
	});

	it("pushes New teams after a player leaves and teams reform", async () => {
		const { client, players, session, fetchMock } = await setup(4);

		const full = await client.session.getById.query({ sessionId: session.id });
		const playerToRemove = full.players.find((p) => p.status === "waiting")!;

		await client.session.removePlayer.mutate({
			sessionId: session.id,
			sessionPlayerId: playerToRemove.id,
		});

		await vi.waitFor(() => expect(teamMessages(fetchMock).length).toBeGreaterThan(0));

		const after = await client.session.getById.query({ sessionId: session.id });
		const nameById = new Map(after.players.map((p) => [p.id, p.displayName]));
		const lineup = after.proposedLineup!;
		const names = (ids: string[]) => ids.map((id) => nameById.get(id)).join(" & ");
		const expectedBody = `${names(lineup.homePlayerIds)} vs ${names(lineup.awayPlayerIds)}`;

		const tokenByUserId = new Map(players.map((p, i) => [p.userId, `token-${i}`]));
		const expectedTokens = players
			.filter((p, i) => i !== 0 && p.userId !== playerToRemove.userId)
			.map((p) => tokenByUserId.get(p.userId)!);

		const messages = teamMessages(fetchMock);
		expect(messages.every((message) => message.title === "New teams")).toBe(true);
		expect(messages.every((message) => message.body === expectedBody)).toBe(true);
		expect(messages.map((message) => message.to).sort()).toEqual(expectedTokens.sort());
		expect(messages.map((message) => message.to)).not.toContain(
			tokenByUserId.get(playerToRemove.userId)
		);
	});

	it("pushes New teams once when a coin toss is resolved", async () => {
		const { client, players, seasonPlayers, session, fetchMock } = await setup(4, false);

		await client.session.startNextMatch.mutate({
			sessionId: session.id,
			homeSeasonPlayerIds: [seasonPlayers[0].id, seasonPlayers[1].id],
			awaySeasonPlayerIds: [seasonPlayers[2].id, seasonPlayers[3].id],
		});
		const withMatch = await client.session.getById.query({ sessionId: session.id });
		const match = withMatch.matches.find((m) => m.result === null)!;

		await client.session.recordResult.mutate({
			sessionId: session.id,
			sessionMatchId: match.id,
			homeScore: 1,
			awayScore: 1,
		});

		await new Promise((resolve) => setTimeout(resolve, 100));
		expect(teamMessages(fetchMock)).toHaveLength(0);

		const pending = await client.session.getById.query({ sessionId: session.id });
		expect(pending.pendingCoinTosses).toHaveLength(1);
		const homeSessionPlayerIds = pending.players
			.filter((p) => match.homePlayerIds.includes(p.seasonPlayerId))
			.map((p) => p.id);

		const resolved = await client.session.resolveCoinToss.mutate({
			coinTossId: pending.pendingCoinTosses[0]!.id,
			resolvedWinnerIds: homeSessionPlayerIds,
		});

		await vi.waitFor(() => expect(teamMessages(fetchMock).length).toBeGreaterThan(0));
		await new Promise((resolve) => setTimeout(resolve, 100));

		const nameById = new Map(pending.players.map((p) => [p.id, p.displayName]));
		const lineup = resolved.proposedLineup!;
		const names = (ids: string[]) => ids.map((id) => nameById.get(id)).join(" & ");
		const expectedBody = `${names(lineup.homePlayerIds)} vs ${names(lineup.awayPlayerIds)}`;

		const messages = teamMessages(fetchMock);
		expect(messages).toHaveLength(3);
		expect(messages.every((message) => message.title === "New teams")).toBe(true);
		expect(messages.every((message) => message.body === expectedBody)).toBe(true);
		expect(messages.map((message) => message.to).sort()).toEqual(
			players
				.slice(1)
				.map((_, i) => `token-${i + 1}`)
				.sort()
		);
	});
});
