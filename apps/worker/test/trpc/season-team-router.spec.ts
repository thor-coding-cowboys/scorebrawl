import { describe, expect, it } from "vitest";
import { createAuthContext } from "../setup/auth-context-util";
import { createPlayers } from "../setup/season-context-util";
import { createTRPCTestClient } from "./trpc-test-client";

describe("season-team router", () => {
	it("should return team standings for a season with matches", async () => {
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

		console.log(`Testing seasonTeam.getStanding with seasonSlug: '${season.slug}'`);

		// Get season players to create team matches
		const seasonPlayers = await client.seasonPlayer.getAll.query({
			seasonSlug: season.slug,
		});

		expect(seasonPlayers.length).toBe(4);

		// Create a team match to generate team standings
		await client.match.create.mutate({
			seasonSlug: season.slug,
			homeScore: 10,
			awayScore: 7,
			homeTeamPlayerIds: [seasonPlayers[0].id, seasonPlayers[1].id],
			awayTeamPlayerIds: [seasonPlayers[2].id, seasonPlayers[3].id],
		});

		try {
			const result = await client.seasonTeam.getStanding.query({
				seasonSlug: season.slug,
			});

			console.log("Teams returned:", result.length);
			if (result.length > 0) {
				console.log("Sample team:", {
					name: result[0].name,
					score: result[0].score,
					matchCount: result[0].matchCount,
					rank: result[0].rank,
				});
			}

			// Basic validations
			expect(Array.isArray(result)).toBe(true);

			// Should have teams since we created a team match
			expect(result.length).toBeGreaterThan(0);

			// Validate team structure
			const team = result[0];
			expect(team).toHaveProperty("id");
			expect(team).toHaveProperty("name");
			expect(team).toHaveProperty("score");
			expect(team).toHaveProperty("rank");
			expect(team).toHaveProperty("matchCount");
			expect(team).toHaveProperty("winCount");
			expect(team).toHaveProperty("lossCount");
			expect(team).toHaveProperty("drawCount");

			// Should have at least one match
			expect(team.matchCount).toBeGreaterThan(0);
		} catch (error) {
			console.error("Error calling seasonTeam.getStanding:", error);
			throw error;
		}
	});

	it("should return empty array for season with no team matches", async () => {
		const ctx = await createAuthContext();
		const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

		// Create players and season but no matches
		await createPlayers(ctx, 2);
		const season = await client.season.create.mutate({
			name: "Empty Season",
			initialScore: 1000,
			scoreType: "elo",
			kFactor: 32,
			startDate: new Date(),
		});

		console.log(`Testing empty season: '${season.slug}'`);

		try {
			const result = await client.seasonTeam.getStanding.query({
				seasonSlug: season.slug,
			});

			console.log("Empty season teams returned:", result.length);

			// Should return empty array for season with no team matches
			expect(Array.isArray(result)).toBe(true);
			expect(result.length).toBe(0);
		} catch (error) {
			console.error("Error calling seasonTeam.getStanding for empty season:", error);
			throw error;
		}
	});
});
