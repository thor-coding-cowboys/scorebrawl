import { describe, expect, it } from "vitest";
import {
	buildMatchResultToast,
	getSideLabel,
	getTeamInfo,
	type MatchDisplayPlayer,
} from "./match-names";

function player(
	overrides: Partial<MatchDisplayPlayer> & { id: string; name: string }
): MatchDisplayPlayer {
	return {
		image: null,
		teamName: null,
		teamLogo: null,
		homeTeam: true,
		...overrides,
	};
}

const solo = [player({ id: "p1", name: "Ada Lovelace" })];
const pair = [player({ id: "p1", name: "Ada Lovelace" }), player({ id: "p2", name: "Bo Chan" })];

describe("getTeamInfo", () => {
	it("returns null for fewer than two players", () => {
		expect(getTeamInfo([])).toBeNull();
		expect(getTeamInfo(solo)).toBeNull();
	});

	it("prefers the team name and logo", () => {
		const team = pair.map((p) => ({ ...p, teamName: "Darts United", teamLogo: "logo.png" }));
		expect(getTeamInfo(team)).toEqual({ name: "Darts United", logo: "logo.png" });
	});

	it("falls back to first names joined with an ampersand", () => {
		expect(getTeamInfo(pair)).toEqual({ name: "Ada & Bo", logo: null });
	});
});

describe("getSideLabel", () => {
	it("returns Unknown for an empty side", () => {
		expect(getSideLabel([])).toBe("Unknown");
	});

	it("uses the single player's full name", () => {
		expect(getSideLabel(solo)).toBe("Ada Lovelace");
	});

	it("uses the team name, then the first-name join", () => {
		expect(getSideLabel(pair.map((p) => ({ ...p, teamName: "Darts United" })))).toBe(
			"Darts United"
		);
		expect(getSideLabel(pair)).toBe("Ada & Bo");
	});
});

describe("buildMatchResultToast", () => {
	it("announces the winner for 1-v-n-elo", () => {
		expect(
			buildMatchResultToast({
				scoreType: "1-v-n-elo",
				players: [
					player({ id: "h1", name: "Ada Lovelace", homeTeam: true }),
					player({ id: "a1", name: "Bo Chan", homeTeam: false }),
				],
				homeScore: 3,
				awayScore: 1,
			})
		).toBe("Ada Lovelace won the match");
	});

	it("announces both sides with the score otherwise", () => {
		expect(
			buildMatchResultToast({
				scoreType: "elo",
				players: [
					player({ id: "h1", name: "Ada Lovelace", homeTeam: true }),
					player({ id: "a1", name: "Bo Chan", homeTeam: false }),
				],
				homeScore: 3,
				awayScore: 1,
			})
		).toBe("Ada Lovelace 3–1 Bo Chan");
	});
});
