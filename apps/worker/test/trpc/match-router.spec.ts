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

	it("creates teams for 2+ player matches", async () => {
		const ctx = await createAuthContext();
		const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

		// Create 4 players and season
		await createPlayers(ctx, 4);
		const season = await client.season.create.mutate({
			name: "Test Season",
			initialScore: 1000,
			scoreType: "elo",
			kFactor: 32,
			startDate: new Date(),
		});

		const seasonPlayers = await client.seasonPlayer.getAll.query({
			seasonSlug: season.slug,
		});

		// Create 2v2 match
		await client.match.create.mutate({
			seasonSlug: season.slug,
			homeScore: 2,
			awayScore: 1,
			homeTeamPlayerIds: [seasonPlayers[0].id, seasonPlayers[1].id],
			awayTeamPlayerIds: [seasonPlayers[2].id, seasonPlayers[3].id],
		});

		// Verify teams were created
		const teamStandings = await client.seasonTeam.getStanding.query({
			seasonSlug: season.slug,
		});

		expect(teamStandings.length).toBe(2);
		expect(teamStandings[0].matchCount).toBe(1);
		expect(teamStandings[0].score).not.toBe(1000); // Score should have changed
	});

	it("does not create teams for 1v1 matches", async () => {
		const ctx = await createAuthContext();
		const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

		// Create 2 players and season
		await createPlayers(ctx, 2);
		const season = await client.season.create.mutate({
			name: "Test Season",
			initialScore: 1000,
			scoreType: "elo",
			kFactor: 32,
			startDate: new Date(),
		});

		const seasonPlayers = await client.seasonPlayer.getAll.query({
			seasonSlug: season.slug,
		});

		// Create 1v1 match
		await client.match.create.mutate({
			seasonSlug: season.slug,
			homeScore: 2,
			awayScore: 1,
			homeTeamPlayerIds: [seasonPlayers[0].id],
			awayTeamPlayerIds: [seasonPlayers[1].id],
		});

		// Verify no teams were created
		const teamStandings = await client.seasonTeam.getStanding.query({
			seasonSlug: season.slug,
		});

		expect(teamStandings.length).toBe(0);
	});

	it("updates team scores correctly", async () => {
		const ctx = await createAuthContext();
		const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

		// Create 4 players and season
		await createPlayers(ctx, 4);
		const season = await client.season.create.mutate({
			name: "Test Season",
			initialScore: 1000,
			scoreType: "elo",
			kFactor: 32,
			startDate: new Date(),
		});

		const seasonPlayers = await client.seasonPlayer.getAll.query({
			seasonSlug: season.slug,
		});

		// Create 2v2 match where home team wins
		await client.match.create.mutate({
			seasonSlug: season.slug,
			homeScore: 3,
			awayScore: 1,
			homeTeamPlayerIds: [seasonPlayers[0].id, seasonPlayers[1].id],
			awayTeamPlayerIds: [seasonPlayers[2].id, seasonPlayers[3].id],
		});

		// Get team standings
		const teamStandings = await client.seasonTeam.getStanding.query({
			seasonSlug: season.slug,
		});

		expect(teamStandings.length).toBe(2);

		// Find winning and losing teams
		const winningTeam = teamStandings.find((t) => t.winCount === 1);
		const losingTeam = teamStandings.find((t) => t.lossCount === 1);

		expect(winningTeam).toBeDefined();
		expect(losingTeam).toBeDefined();

		if (winningTeam && losingTeam) {
			expect(winningTeam.score).toBeGreaterThan(1000); // Winner gains points
			expect(losingTeam.score).toBeLessThan(1000); // Loser loses points
			expect(winningTeam.matchCount).toBe(1);
			expect(losingTeam.matchCount).toBe(1);
		}
	});

	it("reverts team scores when match is deleted", async () => {
		const ctx = await createAuthContext();
		const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

		// Create 4 players and season
		await createPlayers(ctx, 4);
		const season = await client.season.create.mutate({
			name: "Test Season",
			initialScore: 1000,
			scoreType: "elo",
			kFactor: 32,
			startDate: new Date(),
		});

		const seasonPlayers = await client.seasonPlayer.getAll.query({
			seasonSlug: season.slug,
		});

		// Create 2v2 match
		const match = await client.match.create.mutate({
			seasonSlug: season.slug,
			homeScore: 2,
			awayScore: 0,
			homeTeamPlayerIds: [seasonPlayers[0].id, seasonPlayers[1].id],
			awayTeamPlayerIds: [seasonPlayers[2].id, seasonPlayers[3].id],
		});

		// Verify team scores changed
		const teamStandingsAfterCreate = await client.seasonTeam.getStanding.query({
			seasonSlug: season.slug,
		});

		expect(teamStandingsAfterCreate.length).toBe(2);
		const team1ScoreAfterCreate = teamStandingsAfterCreate[0].score;
		const team2ScoreAfterCreate = teamStandingsAfterCreate[1].score;

		// Delete match
		await client.match.remove.mutate({
			seasonSlug: season.slug,
			matchId: match.id,
		});

		// Verify team scores reverted to initial
		const teamStandingsAfterDelete = await client.seasonTeam.getStanding.query({
			seasonSlug: season.slug,
		});

		expect(teamStandingsAfterDelete.length).toBe(2);
		expect(teamStandingsAfterDelete[0].score).toBe(1000);
		expect(teamStandingsAfterDelete[1].score).toBe(1000);
		expect(teamStandingsAfterDelete[0].matchCount).toBe(0);
		expect(teamStandingsAfterDelete[1].matchCount).toBe(0);

		// Verify scores actually changed before deletion
		expect(team1ScoreAfterCreate).not.toBe(1000);
		expect(team2ScoreAfterCreate).not.toBe(1000);
	});

	it("reuses existing teams for same player combinations", async () => {
		const ctx = await createAuthContext();
		const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

		// Create 4 players and season
		await createPlayers(ctx, 4);
		const season = await client.season.create.mutate({
			name: "Test Season",
			initialScore: 1000,
			scoreType: "elo",
			kFactor: 32,
			startDate: new Date(),
		});

		const seasonPlayers = await client.seasonPlayer.getAll.query({
			seasonSlug: season.slug,
		});

		// Create first 2v2 match
		await client.match.create.mutate({
			seasonSlug: season.slug,
			homeScore: 2,
			awayScore: 1,
			homeTeamPlayerIds: [seasonPlayers[0].id, seasonPlayers[1].id],
			awayTeamPlayerIds: [seasonPlayers[2].id, seasonPlayers[3].id],
		});

		// Create second 2v2 match with same players
		await client.match.create.mutate({
			seasonSlug: season.slug,
			homeScore: 3,
			awayScore: 2,
			homeTeamPlayerIds: [seasonPlayers[0].id, seasonPlayers[1].id],
			awayTeamPlayerIds: [seasonPlayers[2].id, seasonPlayers[3].id],
		});

		// Verify only 2 teams exist (not 4)
		const teamStandings = await client.seasonTeam.getStanding.query({
			seasonSlug: season.slug,
		});

		expect(teamStandings.length).toBe(2);

		// Verify team scores accumulated across both matches
		expect(teamStandings[0].matchCount).toBe(2);
		expect(teamStandings[1].matchCount).toBe(2);
	});
});
