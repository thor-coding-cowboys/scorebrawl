import { describe, expect, it } from "vitest";
import { createAuthContext } from "../setup/auth-context-util";
import { createPlayers } from "../setup/season-context-util";
import { createTRPCTestClient } from "./trpc-test-client";

describe("match router", () => {
	it("creates a match in season", async () => {
		const ctx = await createAuthContext();
		const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

		// Create players and season
		await createPlayers(ctx, 2);
		const season = await client.season.create.mutate({
			name: "Test Season",
			initialScore: 1000,
			scoreType: "elo",
			kFactor: 32,
			startDate: new Date(),
		});

		// Get season players
		const seasonPlayers = await client.seasonPlayer.getAll.query({
			seasonSlug: season.slug,
		});

		expect(seasonPlayers.length).toBe(2);

		// Create match
		const match = await client.match.create.mutate({
			seasonSlug: season.slug,
			homeScore: 2,
			awayScore: 1,
			homeTeamPlayerIds: [seasonPlayers[0].id],
			awayTeamPlayerIds: [seasonPlayers[1].id],
		});

		expect(match).toBeDefined();
		expect(match.homeScore).toBe(2);
		expect(match.awayScore).toBe(1);
	});

	it("fails to create match with uneven teams", async () => {
		const ctx = await createAuthContext();
		const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

		// Create players and season
		await createPlayers(ctx, 4);
		const season = await client.season.create.mutate({
			name: "Test Season",
			initialScore: 1000,
			scoreType: "elo",
			kFactor: 32,
			startDate: new Date(),
		});

		// Get season players
		const seasonPlayers = await client.seasonPlayer.getAll.query({
			seasonSlug: season.slug,
		});

		expect(seasonPlayers.length).toBe(4);

		// Try to create match with uneven teams (3 vs 1)
		await expect(
			client.match.create.mutate({
				seasonSlug: season.slug,
				homeScore: 2,
				awayScore: 1,
				homeTeamPlayerIds: [seasonPlayers[0].id, seasonPlayers[1].id, seasonPlayers[2].id],
				awayTeamPlayerIds: [seasonPlayers[3].id],
			})
		).rejects.toThrow("Teams must have equal number of players");
	});

	it("fails to create match with empty teams", async () => {
		const ctx = await createAuthContext();
		const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

		// Create players and season
		await createPlayers(ctx, 2);
		const season = await client.season.create.mutate({
			name: "Test Season",
			initialScore: 1000,
			scoreType: "elo",
			kFactor: 32,
			startDate: new Date(),
		});

		// Try to create match with empty home team
		await expect(
			client.match.create.mutate({
				seasonSlug: season.slug,
				homeScore: 2,
				awayScore: 1,
				homeTeamPlayerIds: [],
				awayTeamPlayerIds: ["some-id"],
			})
		).rejects.toThrow("Each team must have at least one player");

		// Try to create match with empty away team
		await expect(
			client.match.create.mutate({
				seasonSlug: season.slug,
				homeScore: 2,
				awayScore: 1,
				homeTeamPlayerIds: ["some-id"],
				awayTeamPlayerIds: [],
			})
		).rejects.toThrow("Each team must have at least one player");
	});

	it("lists matches in season", async () => {
		const ctx = await createAuthContext();
		const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

		// Create players and season
		await createPlayers(ctx, 2);
		const season = await client.season.create.mutate({
			name: "Test Season",
			initialScore: 1000,
			scoreType: "elo",
			kFactor: 32,
			startDate: new Date(),
		});

		// Get season players and create match
		const seasonPlayers = await client.seasonPlayer.getAll.query({
			seasonSlug: season.slug,
		});

		await client.match.create.mutate({
			seasonSlug: season.slug,
			homeScore: 3,
			awayScore: 2,
			homeTeamPlayerIds: [seasonPlayers[0].id],
			awayTeamPlayerIds: [seasonPlayers[1].id],
		});

		// Get all matches
		const result = await client.match.getAll.query({
			seasonSlug: season.slug,
			limit: 10,
			offset: 0,
		});

		expect(result.matches).toBeInstanceOf(Array);
		expect(result.matches.length).toBe(1);
		expect(result.total).toBe(1);
	});

	it("removes a match", async () => {
		const ctx = await createAuthContext();
		const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

		// Create players and season
		await createPlayers(ctx, 2);
		const season = await client.season.create.mutate({
			name: "Test Season",
			initialScore: 1000,
			scoreType: "elo",
			kFactor: 32,
			startDate: new Date(),
		});

		// Get season players and create match
		const seasonPlayers = await client.seasonPlayer.getAll.query({
			seasonSlug: season.slug,
		});

		const match = await client.match.create.mutate({
			seasonSlug: season.slug,
			homeScore: 2,
			awayScore: 0,
			homeTeamPlayerIds: [seasonPlayers[0].id],
			awayTeamPlayerIds: [seasonPlayers[1].id],
		});

		// Remove match
		const result = await client.match.remove.mutate({
			seasonSlug: season.slug,
			matchId: match.id,
		});

		expect(result.success).toBe(true);

		// Verify match is gone
		const matches = await client.match.getAll.query({
			seasonSlug: season.slug,
			limit: 10,
			offset: 0,
		});

		expect(matches.matches.length).toBe(0);
	});
});
