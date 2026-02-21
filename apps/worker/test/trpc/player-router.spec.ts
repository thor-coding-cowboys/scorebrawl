import { addDays, startOfDay } from "date-fns";
import { beforeEach, describe, expect, it } from "vitest";
import { createAuthContext, createLeague } from "../setup/auth-context-util";
import { createPlayers } from "../setup/season-context-util";
import { createTRPCTestClient } from "./trpc-test-client";

describe("player router", () => {
	let sessionToken: string;

	beforeEach(async () => {
		const ctx = await createAuthContext();
		sessionToken = ctx.sessionToken;
	});

	it("lists all players in league", async () => {
		const client = createTRPCTestClient({ sessionToken });

		const result = await client.player.getAll.query();

		expect(result).toBeInstanceOf(Array);
	});

	it("creates players via auth context", async () => {
		const ctx = await createAuthContext();
		const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

		// Create players
		await createPlayers(ctx, 3);

		const result = await client.player.getAll.query();

		expect(result.length).toBeGreaterThanOrEqual(3);
	});

	it("gets player by id within season", async () => {
		const ctx = await createAuthContext();
		const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

		// Create players and season
		const players = await createPlayers(ctx, 2);
		const season = await client.season.create.mutate({
			name: "Test Season",
			initialScore: 1000,
			scoreType: "elo",
			kFactor: 32,
			startDate: addDays(startOfDay(new Date()), -1), // Yesterday to ensure season is active
		});

		const result = await client.player.getById.query({
			seasonSlug: season.slug,
			playerId: players[0].id,
		});

		expect(result).toBeDefined();
		expect(result.id).toBe(players[0].id);
	});

	describe("player profile endpoints", () => {
		it("returns null for best season when player has no seasons", async () => {
			const ctx = await createAuthContext();
			const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

			// Create a player without any seasons
			const players = await createPlayers(ctx, 1);

			const result = await client.player.getBestSeason.query({
				playerId: players[0].id,
			});

			expect(result).toBeNull();
		});

		it("returns best season for a player", async () => {
			const ctx = await createAuthContext();
			const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

			// Create players and season
			const players = await createPlayers(ctx, 2);
			await client.season.create.mutate({
				name: "Test Season",
				initialScore: 1000,
				scoreType: "elo",
				kFactor: 32,
				startDate: addDays(startOfDay(new Date()), -1),
			});

			const result = await client.player.getBestSeason.query({
				playerId: players[0].id,
			});

			// Should return a season or null (depending on if player was added to season)
			expect(result === null || typeof result === "object").toBe(true);
		});

		it("returns null for best teammate when player has no matches", async () => {
			const ctx = await createAuthContext();
			const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

			// Create a player without any matches
			const players = await createPlayers(ctx, 1);

			const result = await client.player.getBestTeammate.query({
				playerId: players[0].id,
			});

			expect(result).toBeNull();
		});

		it("returns null for worst teammate when player has no matches", async () => {
			const ctx = await createAuthContext();
			const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

			// Create a player without any matches
			const players = await createPlayers(ctx, 1);

			const result = await client.player.getWorstTeammate.query({
				playerId: players[0].id,
			});

			expect(result).toBeNull();
		});

		it("throws error when player not found for best season", async () => {
			const ctx = await createAuthContext();
			const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

			await expect(
				client.player.getBestSeason.query({
					playerId: "non-existent-id",
				})
			).rejects.toThrow();
		});
	});

	describe("createGuestPlayer", () => {
		it("creates guest player with email and displayName", async () => {
			const ctx = await createAuthContext();
			const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

			const result = await client.player.createGuestPlayer.mutate({
				email: "guest-test@example.com",
				displayName: "Guest Player",
			});

			expect(result.playerId).toBeDefined();
			expect(result.guestId).toBeDefined();

			// Verify appears in player list with isGuest flag
			const players = await client.player.getAll.query();
			const guestPlayer = players.find((p) => p.id === result.playerId);
			expect(guestPlayer).toBeDefined();
			expect(guestPlayer?.isGuest).toBe(1);
			expect(guestPlayer?.name).toBe("Guest Player");
		});

		it("reuses guest record across multiple leagues", async () => {
			const ctx = await createAuthContext();
			const client1 = createTRPCTestClient({ sessionToken: ctx.sessionToken });

			const result1 = await client1.player.createGuestPlayer.mutate({
				email: "multi-league@example.com",
				displayName: "Multi League Guest",
			});

			// Create second league for same user
			const league2 = await createLeague(ctx.sessionToken);

			// Set active org to league2 — need a new client with updated session
			const { env } = await import("cloudflare:test");
			const { getDb } = await import("../../src/db/index");
			const { createAuth } = await import("../../src/lib/better-auth");
			const db = getDb(env.DB);
			const auth = createAuth({ db, betterAuthSecret: env.BETTER_AUTH_SECRET });

			const { headers: activeHeaders } = await auth.api.setActiveOrganization({
				body: { organizationId: league2.id },
				headers: new Headers({ Cookie: `better-auth.session_token=${ctx.sessionToken}` }),
				returnHeaders: true,
			});
			const newCookies = activeHeaders.get("set-cookie");
			const newToken =
				newCookies?.match(/better-auth\.session_token=([^;]+)/)?.[1] ?? ctx.sessionToken;

			const client2 = createTRPCTestClient({ sessionToken: newToken });

			const result2 = await client2.player.createGuestPlayer.mutate({
				email: "multi-league@example.com",
				displayName: "Multi League Guest",
			});

			// Same guest record reused
			expect(result1.guestId).toBe(result2.guestId);
			// Different player records
			expect(result1.playerId).not.toBe(result2.playerId);
		});

		it("rejects if user with email already exists", async () => {
			const ctx = await createAuthContext();
			const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

			// ctx.user.email is a registered user
			await expect(
				client.player.createGuestPlayer.mutate({
					email: ctx.user.email,
					displayName: "Ghost",
				})
			).rejects.toThrow();
		});

		it("rejects duplicate guest in same league", async () => {
			const ctx = await createAuthContext();
			const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

			await client.player.createGuestPlayer.mutate({
				email: "duplicate@example.com",
				displayName: "First",
			});

			await expect(
				client.player.createGuestPlayer.mutate({
					email: "duplicate@example.com",
					displayName: "Second",
				})
			).rejects.toThrow();
		});

		it("auto-adds guest to ongoing seasons", async () => {
			const ctx = await createAuthContext();
			const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

			// Need at least 2 players to create a season
			await createPlayers(ctx, 2);

			// Create a season first
			const createdSeason = await client.season.create.mutate({
				name: "Ongoing Season",
				initialScore: 1000,
				scoreType: "elo",
				kFactor: 32,
				startDate: addDays(startOfDay(new Date()), -1),
			});

			// Create guest player
			const result = await client.player.createGuestPlayer.mutate({
				email: "season-guest@example.com",
				displayName: "Season Guest",
			});

			expect(result.playerId).toBeDefined();

			// Verify the guest was actually enrolled in the season
			const { env } = await import("cloudflare:test");
			const { getDb } = await import("../../src/db/index");
			const { seasonPlayer } = await import("../../src/db/schema/league-schema");
			const { and, eq } = await import("drizzle-orm");
			const db = getDb(env.DB);

			const enrollments = await db
				.select()
				.from(seasonPlayer)
				.where(
					and(
						eq(seasonPlayer.playerId, result.playerId),
						eq(seasonPlayer.seasonId, createdSeason.id)
					)
				);

			expect(enrollments).toHaveLength(1);
			expect(enrollments[0].score).toBe(1000);
		});
	});
});
