import { describe, expect, it } from "vitest";
import { diversityShuffleWithHistory } from "../../src/lib/shuffle";

describe("diversityShuffleWithHistory - 2v2 scenarios", () => {
	it("should avoid putting players on same team after they played together", () => {
		// Players a,b played together on home team in last match
		// Players c,d played together on away team
		const playerIds = ["a", "b", "c", "d"];
		const matchHistory = [{ homePlayerIds: ["a", "b"], awayPlayerIds: ["c", "d"] }];

		// Run many iterations to check team distribution
		let sameTeamCount = 0;
		const iterations = 1000;

		for (let i = 0; i < iterations; i++) {
			const shuffled = diversityShuffleWithHistory(playerIds, matchHistory);
			const homeTeam = new Set(shuffled.slice(0, 2).sort());

			// Check if a and b are on same team again
			const aOnHome = homeTeam.has("a");
			const bOnHome = homeTeam.has("b");
			if (aOnHome === bOnHome) {
				sameTeamCount++;
			}
		}

		// With pure random, a&b would be on same team ~50% of the time
		// Diversity should keep this well below 25%
		const sameTeamRate = sameTeamCount / iterations;
		expect(sameTeamRate).toBeLessThan(0.25);
	});

	it("strongly reduces same teammates after many matches together", () => {
		const playerIds = ["a", "b", "c", "d"];

		// a&b have played together 5 times
		const matchHistory = [
			{ homePlayerIds: ["a", "b"], awayPlayerIds: ["c", "d"] },
			{ homePlayerIds: ["a", "b"], awayPlayerIds: ["c", "d"] },
			{ homePlayerIds: ["a", "b"], awayPlayerIds: ["c", "d"] },
			{ homePlayerIds: ["a", "b"], awayPlayerIds: ["c", "d"] },
			{ homePlayerIds: ["a", "b"], awayPlayerIds: ["c", "d"] },
		];

		let sameTeamCount = 0;
		const iterations = 1000;

		for (let i = 0; i < iterations; i++) {
			const shuffled = diversityShuffleWithHistory(playerIds, matchHistory);
			const homeTeam = new Set(shuffled.slice(0, 2).sort());
			const aOnHome = homeTeam.has("a");
			const bOnHome = homeTeam.has("b");
			if (aOnHome === bOnHome) {
				sameTeamCount++;
			}
		}

		// After 5 matches together, should be very unlikely (under 10%)
		const sameTeamRate = sameTeamCount / iterations;
		expect(sameTeamRate).toBeLessThan(0.1);
	});

	it("allows ~30% chance of same teammates (not 0%, not 100%)", () => {
		const playerIds = ["a", "b", "c", "d"];
		const matchHistory = [{ homePlayerIds: ["a", "b"], awayPlayerIds: ["c", "d"] }];

		let sameTeamCount = 0;
		const iterations = 1000;

		for (let i = 0; i < iterations; i++) {
			const shuffled = diversityShuffleWithHistory(playerIds, matchHistory);
			const homeTeam = new Set(shuffled.slice(0, 2).sort());
			const aOnHome = homeTeam.has("a");
			const bOnHome = homeTeam.has("b");
			if (aOnHome === bOnHome) {
				sameTeamCount++;
			}
		}

		const sameTeamRate = sameTeamCount / iterations;
		// Should be around 15-20% after 1 match - unlikely but not impossible
		expect(sameTeamRate).toBeGreaterThan(0.1);
		expect(sameTeamRate).toBeLessThan(0.25);
	});

	it("produces diverse team splits favoring new combinations", () => {
		const playerIds = ["a", "b", "c", "d"];
		const matchHistory = [{ homePlayerIds: ["a", "b"], awayPlayerIds: ["c", "d"] }];

		const distribution = new Map<string, number>();
		const iterations = 1000;

		for (let i = 0; i < iterations; i++) {
			const shuffled = diversityShuffleWithHistory(playerIds, matchHistory);
			const homeTeam = shuffled.slice(0, 2).sort().join(",");
			const awayTeam = shuffled.slice(2, 4).sort().join(",");
			const key = `{${homeTeam}} vs {${awayTeam}}`;
			distribution.set(key, (distribution.get(key) || 0) + 1);
		}

		// Calculate ratio of bad splits (a,b or c,d together) vs good splits
		let badSplitCount = 0;
		for (const [key, count] of distribution) {
			if (key.includes("a,b") || key.includes("c,d")) {
				badSplitCount += count;
			}
		}

		const badSplitRate = badSplitCount / iterations;
		// Bad splits should be around 15-20% (not 0%, not 50%+)
		expect(badSplitRate).toBeGreaterThan(0.1);
		expect(badSplitRate).toBeLessThan(0.25);

		// Should have multiple different splits
		expect(distribution.size).toBeGreaterThan(1);
	});
});
