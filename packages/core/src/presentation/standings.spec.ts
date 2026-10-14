import { describe, expect, it } from "vitest";
import {
	FORM_COLORS,
	STREAK_FIRE_THRESHOLD,
	STREAK_ICE_THRESHOLD,
	calculateStreak,
	compareStandings,
	getStreakType,
	sortStandings,
	winPct,
} from "./standings";

function item(overrides: { score: number; matchCount: number; winCount?: number }) {
	return {
		score: overrides.score,
		matchCount: overrides.matchCount,
		winCount: overrides.winCount ?? 0,
	};
}

describe("calculateStreak", () => {
	it("returns 0 for an absent or empty form", () => {
		expect(calculateStreak(undefined)).toBe(0);
		expect(calculateStreak([])).toBe(0);
	});

	it("counts a leading run of wins or losses and stops at the first change", () => {
		expect(calculateStreak(["W", "W", "L"])).toBe(2);
		expect(calculateStreak(["L", "L", "L", "W"])).toBe(-3);
		expect(calculateStreak(["W", "L", "W"])).toBe(1);
	});

	it("returns 0 when the leading run is draws", () => {
		expect(calculateStreak(["D", "D", "W"])).toBe(0);
		expect(calculateStreak(["W", "D"])).toBe(1);
	});
});

describe("getStreakType", () => {
	it("uses the documented thresholds", () => {
		expect(getStreakType(0)).toBe("none");
		expect(getStreakType(STREAK_FIRE_THRESHOLD - 1)).toBe("none");
		expect(getStreakType(STREAK_FIRE_THRESHOLD)).toBe("fire");
		expect(getStreakType(STREAK_ICE_THRESHOLD + 1)).toBe("none");
		expect(getStreakType(STREAK_ICE_THRESHOLD)).toBe("ice");
	});
});

describe("winPct", () => {
	it("rounds and guards against division by zero", () => {
		expect(winPct({ matchCount: 0, winCount: 0 })).toBe(0);
		expect(winPct({ matchCount: 3, winCount: 2 })).toBe(67);
		expect(winPct({ matchCount: 3, winCount: 0 })).toBe(0);
		expect(winPct({ matchCount: 7, winCount: 1 })).toBe(14);
	});
});

describe("compareStandings / sortStandings", () => {
	it("sorts players with no matches last", () => {
		expect(
			compareStandings(item({ score: 1100, matchCount: 0 }), item({ score: 900, matchCount: 4 }))
		).toBe(1);
		expect(
			compareStandings(item({ score: 900, matchCount: 4 }), item({ score: 1100, matchCount: 0 }))
		).toBe(-1);
	});

	it("sorts the rest by score descending", () => {
		expect(
			compareStandings(item({ score: 1000, matchCount: 2 }), item({ score: 1200, matchCount: 6 }))
		).toBe(200);
	});

	it("keeps two players with no matches in score order", () => {
		expect(
			compareStandings(item({ score: 1100, matchCount: 0 }), item({ score: 1000, matchCount: 0 }))
		).toBe(-100);
	});

	it("sorts without mutating the input", () => {
		const input = [item({ score: 900, matchCount: 1 }), item({ score: 1200, matchCount: 5 })];
		const sorted = sortStandings(input);
		expect(sorted.map((i) => i.score)).toEqual([1200, 900]);
		expect(input.map((i) => i.score)).toEqual([900, 1200]);
	});
});

describe("FORM_COLORS", () => {
	it("covers every form result", () => {
		expect(FORM_COLORS).toEqual({ W: "#16a34a", D: "#d97706", L: "#dc2626" });
	});
});
