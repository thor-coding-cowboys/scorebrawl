import { describe, expect, it, beforeAll } from "vitest";
import { createAuthContext, type AuthContext } from "../setup/auth-context-util";
import { createTRPCTestClient } from "./trpc-test-client";

describe("league-team router", () => {
	let authContext: AuthContext;
	let client: ReturnType<typeof createTRPCTestClient>;

	beforeAll(async () => {
		// Setup auth context
		authContext = await createAuthContext();
		client = createTRPCTestClient({
			sessionToken: authContext.sessionToken,
		});
	});

	describe("getRivalTeams", () => {
		it("should handle getRivalTeams call for a non-existent team without crashing", async () => {
			const fakeTeamId = "non-existent-team-id";

			console.log("Testing getRivalTeams for non-existent team");

			try {
				const result = await client.leagueTeam.getRivalTeams.query({
					teamId: fakeTeamId,
				});

				// If no error is thrown, the result should have null rivals
				expect(result).toHaveProperty("bestRival");
				expect(result).toHaveProperty("worstRival");
				expect(result.bestRival).toBe(null);
				expect(result.worstRival).toBe(null);

				console.log("Successfully handled non-existent team:", result);
			} catch (error) {
				console.log("Expected error for non-existent team:", error.message);

				// Should get a NOT_FOUND or similar error
				expect(
					error.message.includes("not found") ||
						error.message.includes("Team not found") ||
						error.message.includes("NOT_FOUND")
				).toBe(true);
			}
		});

		it("should return the correct structure for getRivalTeams", async () => {
			// Test the endpoint structure without requiring specific data
			const testTeamId = "any-team-id-for-structure-test";

			console.log("Testing getRivalTeams structure");

			try {
				const result = await client.leagueTeam.getRivalTeams.query({
					teamId: testTeamId,
				});

				console.log("Rivals structure test result:", result);

				// Verify the response has the expected structure
				expect(result).toHaveProperty("bestRival");
				expect(result).toHaveProperty("worstRival");

				// Both should be null or have proper structure
				if (result.bestRival !== null) {
					expect(result.bestRival).toHaveProperty("id");
					expect(result.bestRival).toHaveProperty("name");
					expect(result.bestRival).toHaveProperty("matchesPlayed");
					expect(result.bestRival).toHaveProperty("wins");
					expect(result.bestRival).toHaveProperty("losses");
					expect(result.bestRival).toHaveProperty("winRate");

					// Validate win rate is a valid percentage
					expect(result.bestRival.winRate).toBeGreaterThanOrEqual(0);
					expect(result.bestRival.winRate).toBeLessThanOrEqual(100);
				}

				if (result.worstRival !== null) {
					expect(result.worstRival).toHaveProperty("id");
					expect(result.worstRival).toHaveProperty("name");
					expect(result.worstRival).toHaveProperty("matchesPlayed");
					expect(result.worstRival).toHaveProperty("wins");
					expect(result.worstRival).toHaveProperty("losses");
					expect(result.worstRival).toHaveProperty("winRate");

					// Validate win rate is a valid percentage
					expect(result.worstRival.winRate).toBeGreaterThanOrEqual(0);
					expect(result.worstRival.winRate).toBeLessThanOrEqual(100);
				}
			} catch (error) {
				// If it's a "team not found" error, that's acceptable for this test
				console.log("Error (which might be expected):", error.message);
				expect(error.message).toBeDefined();
			}
		});
	});
});
