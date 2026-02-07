import { describe, expect, it } from "vitest";
import { createAuthContext } from "../setup/auth-context-util";
import { createPlayers } from "../setup/season-context-util";
import { createTRPCTestClient } from "./trpc-test-client";

describe("season-player router", () => {
	// Tests use individual auth contexts for better isolation

	it("calculates correct +/- values for today's matches", async () => {
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

		// Get initial standings - should show 0 pointDiff for all players
		const initialStandings = await client.seasonPlayer.getStanding.query({
			seasonSlug: season.slug,
		});

		expect(initialStandings.length).toBe(4);
		// All players should have 0 point difference initially
		for (const standing of initialStandings) {
			expect(standing.pointDiff).toBe(0);
		}

		// Track which players are on which team by their IDs
		const homePlayerIds = [initialStandings[0].id, initialStandings[1].id];
		const awayPlayerIds = [initialStandings[2].id, initialStandings[3].id];

		// Create a match today
		const match = await client.match.create.mutate({
			seasonSlug: season.slug,
			homeScore: 2,
			awayScore: 1,
			homeTeamPlayerIds: homePlayerIds,
			awayTeamPlayerIds: awayPlayerIds,
		});

		expect(match.id).toBeDefined();

		// Get standings after match - should show pointDiff changes
		const updatedStandings = await client.seasonPlayer.getStanding.query({
			seasonSlug: season.slug,
		});

		// Find players in updated standings by their tracked IDs
		const homePlayer1Initial = initialStandings.find((p) => p.id === homePlayerIds[0]);
		const homePlayer1Updated = updatedStandings.find((p) => p.id === homePlayerIds[0]);
		const homePlayer2Initial = initialStandings.find((p) => p.id === homePlayerIds[1]);
		const homePlayer2Updated = updatedStandings.find((p) => p.id === homePlayerIds[1]);

		// Away team (losers) should have negative point changes
		const awayPlayer1Initial = initialStandings.find((p) => p.id === awayPlayerIds[0]);
		const awayPlayer1Updated = updatedStandings.find((p) => p.id === awayPlayerIds[0]);
		const awayPlayer2Initial = initialStandings.find((p) => p.id === awayPlayerIds[1]);
		const awayPlayer2Updated = updatedStandings.find((p) => p.id === awayPlayerIds[1]);

		// Check that pointDiff reflects today's match results
		// Winners should have positive pointDiff
		expect(homePlayer1Updated?.pointDiff).toBeGreaterThan(0);
		expect(homePlayer2Updated?.pointDiff).toBeGreaterThan(0);

		// Losers should have negative pointDiff
		expect(awayPlayer1Updated?.pointDiff).toBeLessThan(0);
		expect(awayPlayer2Updated?.pointDiff).toBeLessThan(0);

		// Verify that pointDiff equals the actual score change from today
		expect(homePlayer1Updated?.pointDiff).toBe(
			(homePlayer1Updated?.score ?? 0) - (homePlayer1Initial?.score ?? 0)
		);
		expect(homePlayer2Updated?.pointDiff).toBe(
			(homePlayer2Updated?.score ?? 0) - (homePlayer2Initial?.score ?? 0)
		);
		expect(awayPlayer1Updated?.pointDiff).toBe(
			(awayPlayer1Updated?.score ?? 0) - (awayPlayer1Initial?.score ?? 0)
		);
		expect(awayPlayer2Updated?.pointDiff).toBe(
			(awayPlayer2Updated?.score ?? 0) - (awayPlayer2Initial?.score ?? 0)
		);
	});

	it("shows cumulative +/- values for multiple matches on same day", async () => {
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

		const initialStandings = await client.seasonPlayer.getStanding.query({
			seasonSlug: season.slug,
		});

		// Create first match - Player 0 & 1 win against Player 2 & 3
		await client.match.create.mutate({
			seasonSlug: season.slug,
			homeScore: 3,
			awayScore: 0,
			homeTeamPlayerIds: [initialStandings[0].id, initialStandings[1].id],
			awayTeamPlayerIds: [initialStandings[2].id, initialStandings[3].id],
		});

		// Create second match - Player 0 & 2 win against Player 1 & 3
		await client.match.create.mutate({
			seasonSlug: season.slug,
			homeScore: 2,
			awayScore: 1,
			homeTeamPlayerIds: [initialStandings[0].id, initialStandings[2].id],
			awayTeamPlayerIds: [initialStandings[1].id, initialStandings[3].id],
		});

		const finalStandings = await client.seasonPlayer.getStanding.query({
			seasonSlug: season.slug,
		});

		// Player 0 should have played 2 matches and won both (highest +/-)
		const player0 = finalStandings.find((p) => p.id === initialStandings[0].id);
		expect(player0?.pointDiff).toBeGreaterThan(0);

		// Player 3 should have played 2 matches and lost both (lowest +/-)
		const player3 = finalStandings.find((p) => p.id === initialStandings[3].id);
		expect(player3?.pointDiff).toBeLessThan(0);

		// Verify that pointDiff is cumulative (sum of all today's match changes)
		const totalScoreChange0 = (player0?.score ?? 1000) - 1000; // Initial score was 1000
		const totalScoreChange3 = (player3?.score ?? 1000) - 1000;

		expect(player0?.pointDiff).toBe(totalScoreChange0);
		expect(player3?.pointDiff).toBe(totalScoreChange3);
	});

	it("shows zero +/- values when no matches played today", async () => {
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

		const standings = await client.seasonPlayer.getStanding.query({
			seasonSlug: season.slug,
		});

		expect(standings.length).toBe(2);
		// No matches played, so pointDiff should be 0 for all players
		for (const standing of standings) {
			expect(standing.pointDiff).toBe(0);
		}
	});

	it("returns form data showing recent match results", async () => {
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

		const initialStandings = await client.seasonPlayer.getStanding.query({
			seasonSlug: season.slug,
		});

		// Initially, form should be empty
		for (const standing of initialStandings) {
			expect(standing.form).toEqual([]);
		}

		// Create a match where home team wins
		await client.match.create.mutate({
			seasonSlug: season.slug,
			homeScore: 2,
			awayScore: 1,
			homeTeamPlayerIds: [initialStandings[0].id, initialStandings[1].id],
			awayTeamPlayerIds: [initialStandings[2].id, initialStandings[3].id],
		});

		const updatedStandings = await client.seasonPlayer.getStanding.query({
			seasonSlug: season.slug,
		});

		// Check form data - winners should have "W", losers should have "L"
		const player0 = updatedStandings.find((p) => p.id === initialStandings[0].id);
		const player1 = updatedStandings.find((p) => p.id === initialStandings[1].id);
		const player2 = updatedStandings.find((p) => p.id === initialStandings[2].id);
		const player3 = updatedStandings.find((p) => p.id === initialStandings[3].id);

		expect(player0?.form).toEqual(["W"]);
		expect(player1?.form).toEqual(["W"]);
		expect(player2?.form).toEqual(["L"]);
		expect(player3?.form).toEqual(["L"]);
	});

	it("gets all season players", async () => {
		const ctx = await createAuthContext();
		const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

		// Create players and season
		await createPlayers(ctx, 3);
		const season = await client.season.create.mutate({
			name: "Test Season",
			initialScore: 1000,
			scoreType: "elo",
			kFactor: 32,
			startDate: new Date(),
		});

		const result = await client.seasonPlayer.getAll.query({
			seasonSlug: season.slug,
		});

		expect(result.length).toBe(3);
		for (const player of result) {
			expect(player.id).toBeDefined();
			expect(player.score).toBe(1000); // Initial score
		}
	});
});
