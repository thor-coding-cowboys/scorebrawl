import { describe, expect, it } from "vitest";
import { createAuthContext } from "../setup/auth-context-util";
import { createPlayers } from "../setup/competition-context-util";
import { createTRPCTestClient } from "./trpc-test-client";

describe("match router", () => {
	it("creates a match in competition", async () => {
		const ctx = await createAuthContext();
		const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

		// Create players and competition
		await createPlayers(ctx, 2);
		const competition = await client.competition.create.mutate({
			name: "Test Competition",
			initialScore: 1000,
			scoreType: "elo",
			kFactor: 32,
			startDate: new Date(),
		});

		// Get competition players
		const competitionPlayers = await client.competitionPlayer.getAll.query({
			competitionSlug: competition.slug,
		});

		expect(competitionPlayers.length).toBe(2);

		// Create match
		const match = await client.match.create.mutate({
			competitionSlug: competition.slug,
			homeScore: 2,
			awayScore: 1,
			homeTeamPlayerIds: [competitionPlayers[0].id],
			awayTeamPlayerIds: [competitionPlayers[1].id],
		});

		expect(match).toBeDefined();
		expect(match.homeScore).toBe(2);
		expect(match.awayScore).toBe(1);
	});

	it("lists matches in competition", async () => {
		const ctx = await createAuthContext();
		const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

		// Create players and competition
		await createPlayers(ctx, 2);
		const competition = await client.competition.create.mutate({
			name: "Test Competition",
			initialScore: 1000,
			scoreType: "elo",
			kFactor: 32,
			startDate: new Date(),
		});

		// Get competition players and create match
		const competitionPlayers = await client.competitionPlayer.getAll.query({
			competitionSlug: competition.slug,
		});

		await client.match.create.mutate({
			competitionSlug: competition.slug,
			homeScore: 3,
			awayScore: 2,
			homeTeamPlayerIds: [competitionPlayers[0].id],
			awayTeamPlayerIds: [competitionPlayers[1].id],
		});

		// Get all matches
		const result = await client.match.getAll.query({
			competitionSlug: competition.slug,
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

		// Create players and competition
		await createPlayers(ctx, 2);
		const competition = await client.competition.create.mutate({
			name: "Test Competition",
			initialScore: 1000,
			scoreType: "elo",
			kFactor: 32,
			startDate: new Date(),
		});

		// Get competition players and create match
		const competitionPlayers = await client.competitionPlayer.getAll.query({
			competitionSlug: competition.slug,
		});

		const match = await client.match.create.mutate({
			competitionSlug: competition.slug,
			homeScore: 2,
			awayScore: 0,
			homeTeamPlayerIds: [competitionPlayers[0].id],
			awayTeamPlayerIds: [competitionPlayers[1].id],
		});

		// Remove match
		const result = await client.match.remove.mutate({
			competitionSlug: competition.slug,
			matchId: match.id,
		});

		expect(result.success).toBe(true);

		// Verify match is gone
		const matches = await client.match.getAll.query({
			competitionSlug: competition.slug,
			limit: 10,
			offset: 0,
		});

		expect(matches.matches.length).toBe(0);
	});
});
