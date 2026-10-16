import { describe, expect, it } from "vitest";
import { resolveLineupNames } from "../../src/services/session/session-service";

const players = [
	{ id: "sp1", displayName: "Ada" },
	{ id: "sp2", displayName: "Bob" },
	{ id: "sp3", displayName: "Carol" },
	{ id: "sp4", displayName: "Dave" },
];

describe("resolveLineupNames", () => {
	it("maps session-player ids to display names", () => {
		const result = resolveLineupNames(players, {
			homePlayerIds: ["sp1", "sp2"],
			awayPlayerIds: ["sp3", "sp4"],
		});
		expect(result).toEqual({ home: ["Ada", "Bob"], away: ["Carol", "Dave"] });
	});

	it("returns null for a null lineup", () => {
		expect(resolveLineupNames(players, null)).toBeNull();
	});

	it("returns null when either side is empty", () => {
		expect(resolveLineupNames(players, { homePlayerIds: [], awayPlayerIds: ["sp3"] })).toBeNull();
		expect(resolveLineupNames(players, { homePlayerIds: ["sp1"], awayPlayerIds: [] })).toBeNull();
	});

	it("drops ids with no matching player and nulls if that empties a side", () => {
		expect(
			resolveLineupNames(players, { homePlayerIds: ["missing"], awayPlayerIds: ["sp3"] })
		).toBeNull();
	});
});
