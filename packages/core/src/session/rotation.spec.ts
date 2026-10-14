import { describe, expect, it } from "vitest";
import { diversityShuffle, enforceAlwaysSplit, fisherYatesShuffle } from "./rotation";
import type { SplitPlayer } from "./types";

function player(id: string, queuePosition: number): SplitPlayer {
	return { id, seasonPlayerId: `sp-${id}`, queuePosition };
}

function sameTeam(result: { homeIds: string[]; awayIds: string[] }, x: string, y: string): boolean {
	return (
		(result.homeIds.includes(x) && result.homeIds.includes(y)) ||
		(result.awayIds.includes(x) && result.awayIds.includes(y))
	);
}

describe("enforceAlwaysSplit", () => {
	it("returns the teams unchanged when there are no constraints", () => {
		const homeIds = ["a", "b"];
		const awayIds = ["c", "d"];
		const result = enforceAlwaysSplit(homeIds, awayIds, [], [
			player("a", 0),
			player("b", 1),
			player("c", 2),
			player("d", 3),
		]);
		expect(result).toEqual({ homeIds, awayIds });
	});

	it("moves one of a constrained pair to the other team", () => {
		const players = [player("a", 0), player("b", 1), player("c", 2), player("d", 3)];
		const result = enforceAlwaysSplit(["a", "b"], ["c", "d"], [["sp-a", "sp-b"]], players);
		expect(sameTeam(result, "a", "b")).toBe(false);
		expect([...result.homeIds, ...result.awayIds].sort()).toEqual(["a", "b", "c", "d"]);
	});

	it("re-checks pairs that a later swap re-violates", () => {
		const players = [player("a", 0), player("b", 1), player("c", 2), player("d", 3)];
		const result = enforceAlwaysSplit(
			["a", "b"],
			["c", "d"],
			[
				["sp-b", "sp-d"],
				["sp-a", "sp-b"],
			],
			players
		);
		// Single-pass leaves `b` and `d` together; the loop must not.
		expect(sameTeam(result, "b", "d")).toBe(false);
		expect(sameTeam(result, "a", "b")).toBe(false);
		expect([...result.homeIds, ...result.awayIds].sort()).toEqual(["a", "b", "c", "d"]);
	});

	it("ignores constraint pairs referencing players who are not in the session", () => {
		const players = [player("a", 0), player("b", 1)];
		const result = enforceAlwaysSplit(["a"], ["b"], [["sp-a", "sp-missing"]], players);
		expect(result).toEqual({ homeIds: ["a"], awayIds: ["b"] });
	});
});

describe("diversityShuffle", () => {
	it("shuffles without errors", () => {
		const items = ["a", "b", "c", "d"];
		const pairWeights = new Map<string, number>();

		for (let i = 0; i < 10; i++) {
			const shuffled = diversityShuffle([...items], pairWeights);
			expect(shuffled).toHaveLength(4);
			expect(new Set(shuffled).size).toBe(4);
		}
	});

	// Helper to check if two players end up on the same team (for 2v2)
	const countSameTeam = (shuffled: string[], x: string, y: string, teamSize = 2): number => {
		const ix = shuffled.indexOf(x);
		const iy = shuffled.indexOf(y);
		const teamX = Math.floor(ix / teamSize);
		const teamY = Math.floor(iy / teamSize);
		return teamX === teamY ? 1 : 0;
	};

	it("places frequent co-players on different teams when possible", () => {
		const items = ["a", "b", "c", "d"];
		const pairWeights = new Map<string, number>();
		pairWeights.set("a|b", 1000);

		const iterations = 1000;
		let sameTeamCount = 0;
		for (let i = 0; i < iterations; i++) {
			const shuffled = diversityShuffle([...items], pairWeights);
			sameTeamCount += countSameTeam(shuffled, "a", "b");
		}

		const sameTeamRate = sameTeamCount / iterations;
		// With optimal diversity, a&b should almost never be on the same team
		// when alternatives exist (weight=1000 makes it very strongly avoided)
		expect(sameTeamRate).toBeLessThan(0.05);
	});

	it("strongly prefers optimal team splits when available", () => {
		const items = ["a", "b", "c", "d"];
		const pairWeights = new Map<string, number>();
		pairWeights.set("a|b", 100);
		pairWeights.set("c|d", 100);

		const iterations = 2000;
		let badSplitCount = 0;
		for (let i = 0; i < iterations; i++) {
			const shuffled = diversityShuffle([...items], pairWeights);
			// Check if a,b or c,d ended up on same team (bad splits)
			const aIdx = shuffled.indexOf("a");
			const bIdx = shuffled.indexOf("b");
			const cIdx = shuffled.indexOf("c");
			const dIdx = shuffled.indexOf("d");

			const abSameTeam = Math.floor(aIdx / 2) === Math.floor(bIdx / 2);
			const cdSameTeam = Math.floor(cIdx / 2) === Math.floor(dIdx / 2);

			if (abSameTeam || cdSameTeam) {
				badSplitCount++;
			}
		}

		// Weighted random selection gives optimal splits overwhelming weight,
		// but every split keeps a small chance (see diversityShuffle), so bad
		// splits should be far rarer than the ~33% a uniform shuffle would give.
		expect(badSplitCount / iterations).toBeLessThan(0.05);
	});
});

describe("fisherYatesShuffle", () => {
	it("returns array with same elements", () => {
		const items = ["a", "b", "c", "d"];
		const shuffled = fisherYatesShuffle([...items]);
		expect(shuffled).toHaveLength(4);
		expect(new Set(shuffled)).toEqual(new Set(items));
	});
});
