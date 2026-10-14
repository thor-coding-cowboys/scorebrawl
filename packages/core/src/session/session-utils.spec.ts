import { describe, expect, it } from "vitest";
import { computeWinStreaks, getPlayerById, getPlayerBySeasonId } from "./session-utils";
import type { SessionMatch, SessionPlayer } from "./types";

function player(id: string, seasonPlayerId: string): SessionPlayer {
	return {
		id,
		seasonPlayerId,
		displayName: seasonPlayerId,
		playerImage: null,
		score: 0,
		status: "playing",
		queuePosition: 0,
		gamesPlayedThisSession: 0,
		consecutiveGames: 0,
		userId: null,
	};
}

function match(
	matchNumber: number,
	homePlayerIds: string[],
	awayPlayerIds: string[],
	result: SessionMatch["result"]
): SessionMatch {
	return {
		id: `m${matchNumber}`,
		matchNumber,
		homePlayerIds,
		awayPlayerIds,
		result,
		matchId: null,
		homeSessionScore: 0,
		awaySessionScore: 0,
		selectedHomePlayerIds: null,
		selectedAwayPlayerIds: null,
	};
}

const players = [player("p-a", "sp-a"), player("p-b", "sp-b")];

describe("computeWinStreaks", () => {
	it("counts consecutive wins backwards from the latest match", () => {
		const streaks = computeWinStreaks({
			players,
			matches: [match(1, ["sp-a"], ["sp-b"], "home"), match(2, ["sp-a"], ["sp-b"], "home")],
		});
		expect(streaks.get("sp-a")).toBe(2);
		expect(streaks.get("sp-b")).toBe(0);
	});

	it("resets a streak on a loss and is independent of match order", () => {
		const streaks = computeWinStreaks({
			players,
			matches: [
				match(3, ["sp-a"], ["sp-b"], "away"),
				match(1, ["sp-a"], ["sp-b"], "home"),
				match(2, ["sp-a"], ["sp-b"], "home"),
			],
		});
		expect(streaks.get("sp-a")).toBe(0);
		expect(streaks.get("sp-b")).toBe(1);
	});

	it("ignores matches without a result and seeds every player at zero", () => {
		const streaks = computeWinStreaks({
			players,
			matches: [match(1, ["sp-a"], ["sp-b"], null), match(2, ["sp-a"], ["sp-b"], "draw")],
		});
		expect(streaks.get("sp-a")).toBe(0);
		expect(streaks.get("sp-b")).toBe(0);
	});
});

describe("player lookups", () => {
	it("finds a player by session player id", () => {
		expect(getPlayerById({ players }, "p-b")?.seasonPlayerId).toBe("sp-b");
		expect(getPlayerById({ players }, "nope")).toBeUndefined();
	});

	it("finds a player by season player id", () => {
		expect(getPlayerBySeasonId({ players }, "sp-a")?.id).toBe("p-a");
		expect(getPlayerBySeasonId({ players }, "nope")).toBeUndefined();
	});
});
