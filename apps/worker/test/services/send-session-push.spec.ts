import { env } from "cloudflare:test";
import { and, eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getDb } from "../../src/db/index";
import { guest, player, seasonPlayer, sessionPlayer } from "../../src/db/schema/league-schema";
import { pushToken, userPreference } from "../../src/db/schema/user-preferences-schema";
import { teamsFormed } from "../../src/services/notification-events";
import { sendSessionPush } from "../../src/services/push-notification";
import { createAuthContext } from "../setup/auth-context-util";
import { createPlayers } from "../setup/season-context-util";
import { createTRPCTestClient } from "../trpc/trpc-test-client";

describe("sendSessionPush", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	async function setup() {
		const db = getDb(env.DB);
		const ctx = await createAuthContext();
		const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });
		// players[0] is ctx.user; players[1] and players[2] are separate users.
		const players = await createPlayers(ctx, 3);

		const season = await client.season.create.mutate({
			name: "Push Season",
			initialScore: 1000,
			scoreType: "elo",
			kFactor: 32,
			startDate: new Date(),
		});
		const seasonPlayers = await client.seasonPlayer.getAll.query({ seasonSlug: season.slug });
		const session = await client.session.create.mutate({
			seasonSlug: season.slug,
			rotationMode: "winner-stays",
			teamSize: 1,
			maxConsecutiveGames: null,
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

		const event = teamsFormed(
			{
				type: "session:teams",
				leagueSlug: ctx.league.slug,
				seasonSlug: season.slug,
				sessionId: session.id,
			},
			{ home: ["Ada"], away: ["Bob"], actorId: ctx.user.id }
		);

		return { db, ctx, players, season, seasonPlayers, session, fetchMock, event };
	}

	function sentMessages(fetchMock: ReturnType<typeof vi.fn>) {
		const calls = fetchMock.mock.calls as Array<[string, RequestInit]>;
		return calls.flatMap(
			([, init]) =>
				JSON.parse(init.body as string) as Array<{
					to: string;
					threadId: string;
					data: { type: string };
				}>
		);
	}

	it("delivers to active players and excludes out players and the actor", async () => {
		const { db, ctx, players, seasonPlayers, session, fetchMock, event } = await setup();

		// getAll orders by score only (all tied), so resolve the row by userId.
		const outSeasonPlayer = seasonPlayers.find((sp) => sp.userId === players[2].userId)!;

		await db
			.update(sessionPlayer)
			.set({ status: "out" })
			.where(
				and(
					eq(sessionPlayer.sessionId, session.id),
					eq(sessionPlayer.seasonPlayerId, outSeasonPlayer.id)
				)
			);

		await sendSessionPush({ db, sessionId: session.id, events: [event] });

		const messages = sentMessages(fetchMock);
		expect(messages).toHaveLength(1);
		// players[0] = actor (excluded), players[2] = out, players[1] = recipient
		expect(messages[0].to).toBe("token-1");
		expect(messages[0].threadId).toBe("session:teams");
		expect(players[0].userId).toBe(ctx.user.id);
	});

	it("skips recipients with notifyTeamsFormed disabled", async () => {
		const { db, players, session, fetchMock, event } = await setup();

		await db.insert(userPreference).values({
			userId: players[1].userId!,
			notifyTeamsFormed: false,
			createdAt: new Date(),
			updatedAt: new Date(),
		});

		await sendSessionPush({ db, sessionId: session.id, events: [event] });

		const messages = sentMessages(fetchMock);
		expect(messages.map((message) => message.to)).toEqual(["token-2"]);
	});

	it("skips guest players who have no user account", async () => {
		const { db, ctx, session, season, fetchMock, event } = await setup();

		const guestId = crypto.randomUUID();
		await db.insert(guest).values({
			id: guestId,
			email: `${guestId}@example.com`,
			displayName: "Guest",
			createdAt: new Date(),
			updatedAt: new Date(),
		});
		const guestPlayerId = crypto.randomUUID();
		await db.insert(player).values({
			id: guestPlayerId,
			guestId,
			leagueId: ctx.league.id,
			disabled: false,
			createdAt: new Date(),
			updatedAt: new Date(),
		});
		const guestSeasonPlayerId = crypto.randomUUID();
		await db.insert(seasonPlayer).values({
			id: guestSeasonPlayerId,
			seasonId: season.id,
			playerId: guestPlayerId,
			score: 1000,
			disabled: false,
			createdAt: new Date(),
			updatedAt: new Date(),
		});
		await db.insert(sessionPlayer).values({
			id: crypto.randomUUID(),
			sessionId: session.id,
			seasonPlayerId: guestSeasonPlayerId,
			status: "waiting",
			queuePosition: 99,
			createdAt: new Date(),
			updatedAt: new Date(),
		});

		await sendSessionPush({ db, sessionId: session.id, events: [event] });

		const messages = sentMessages(fetchMock);
		// actor excluded, players[1] + players[2] remain
		expect(messages.map((message) => message.to).sort()).toEqual(["token-1", "token-2"]);
	});
});
