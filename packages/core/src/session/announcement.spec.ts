import { describe, expect, it } from "vitest";
import { buildAnnouncement, getNextLineup, lineupSignature } from "./announcement";
import type { SessionPlayer } from "./types";

function player(id: string, displayName: string): SessionPlayer {
	return {
		id,
		seasonPlayerId: `sp-${id}`,
		displayName,
		playerImage: null,
		score: 0,
		status: "playing",
		queuePosition: 0,
		gamesPlayedThisSession: 0,
		consecutiveGames: 0,
		userId: null,
	};
}

const players = [player("a", "Ada"), player("b", "Bo"), player("c", "Cy"), player("d", "Di")];

const proposedLineup = {
	homePlayerIds: ["a", "b"],
	awayPlayerIds: ["c", "d"],
	rotatedOut: [],
	coinTossNeeded: null,
};

describe("getNextLineup", () => {
	it("returns the proposed teams when both sides are complete", () => {
		expect(getNextLineup({ players, matches: [], proposedLineup, teamSize: 2 })).toEqual({
			homeIds: ["a", "b"],
			awayIds: ["c", "d"],
		});
	});

	it("returns null while a match is still in progress", () => {
		expect(
			getNextLineup({
				players,
				matches: [
					{
						id: "m1",
						matchNumber: 1,
						homePlayerIds: ["sp-a"],
						awayPlayerIds: ["sp-b"],
						result: null,
						matchId: null,
						homeSessionScore: 0,
						awaySessionScore: 0,
						selectedHomePlayerIds: null,
						selectedAwayPlayerIds: null,
					},
				],
				proposedLineup,
				teamSize: 2,
			})
		).toBeNull();
	});

	it("returns null when the lineup is the wrong size, and drops unknown players", () => {
		expect(getNextLineup({ players, matches: [], proposedLineup, teamSize: 3 })).toBeNull();
		expect(
			getNextLineup({
				players,
				matches: [],
				proposedLineup: {
					...proposedLineup,
					homePlayerIds: ["a", "ghost"],
					awayPlayerIds: ["c", "d"],
				},
				teamSize: 2,
			})
		).toBeNull();
	});

	it("prefers the selected ids over the proposed ones", () => {
		expect(
			getNextLineup({
				players,
				matches: [],
				proposedLineup: {
					...proposedLineup,
					selectedHomePlayerIds: ["a", "c"],
					selectedAwayPlayerIds: ["b", "d"],
				},
				teamSize: 2,
			})
		).toEqual({ homeIds: ["a", "c"], awayIds: ["b", "d"] });
	});
});

describe("lineupSignature", () => {
	it("ignores the order of ids inside a team", () => {
		expect(lineupSignature({ homeIds: ["b", "a"], awayIds: ["d", "c"] })).toBe(
			lineupSignature({ homeIds: ["a", "b"], awayIds: ["c", "d"] })
		);
	});

	it("differs when the teams are swapped", () => {
		expect(lineupSignature({ homeIds: ["a", "b"], awayIds: ["c", "d"] })).not.toBe(
			lineupSignature({ homeIds: ["c", "d"], awayIds: ["a", "b"] })
		);
	});
});

describe("buildAnnouncement", () => {
	it("announces both complete teams", () => {
		expect(buildAnnouncement({ players }, { homeIds: ["a", "b"], awayIds: ["c", "d"] })).toBe(
			"Next game: Ada and Bo versus Cy and Di"
		);
	});
});
