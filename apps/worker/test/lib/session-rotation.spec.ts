import { describe, expect, it } from "vitest";
import {
	type RotationInput,
	type SessionPlayerState,
	computeNextLineup,
} from "../../src/lib/session-rotation";

function makePlayer(id: string, overrides: Partial<SessionPlayerState> = {}): SessionPlayerState {
	return {
		id,
		seasonPlayerId: `sp-${id}`,
		status: "playing",
		queuePosition: 0,
		gamesPlayedThisSession: 1,
		consecutiveGames: 1,
		...overrides,
	};
}

function waiter(id: string, queuePosition: number, consecutiveGames = 0): SessionPlayerState {
	return makePlayer(id, {
		status: "waiting",
		queuePosition,
		consecutiveGames,
		gamesPlayedThisSession: 0,
	});
}

function base(overrides: Partial<RotationInput> = {}): RotationInput {
	return {
		mode: "winner-stays",
		teamSize: 1,
		maxConsecutiveGames: null,
		autoRandomize: false,
		alwaysSplitConstraints: [],
		players: [],
		lastResult: "home",
		homePlayerIds: [],
		awayPlayerIds: [],
		...overrides,
	};
}

function allPlayerIds(result: { homePlayerIds: string[]; awayPlayerIds: string[] }): string[] {
	return [...result.homePlayerIds, ...result.awayPlayerIds];
}

// ─────────────────────────────────────────────────────────
// Rule 1: No waiters → nobody goes out
// ─────────────────────────────────────────────────────────
describe("Rule 1: No waiters → nobody goes out", () => {
	it("1v1: 2 players, 0 waiters → no rotation", () => {
		const h1 = makePlayer("h1");
		const a1 = makePlayer("a1");
		const result = computeNextLineup(
			base({
				teamSize: 1,
				players: [h1, a1],
				lastResult: "home",
				homePlayerIds: ["h1"],
				awayPlayerIds: ["a1"],
			})
		);
		expect(result.rotatedOut).toHaveLength(0);
		expect(result.coinTossNeeded).toBeNull();
		expect(result.homePlayerIds).toContain("h1");
		expect(result.awayPlayerIds).toContain("a1");
	});

	it("2v2: 4 players, 0 waiters → no rotation", () => {
		const h1 = makePlayer("h1");
		const h2 = makePlayer("h2");
		const a1 = makePlayer("a1");
		const a2 = makePlayer("a2");
		const result = computeNextLineup(
			base({
				teamSize: 2,
				players: [h1, h2, a1, a2],
				lastResult: "home",
				homePlayerIds: ["h1", "h2"],
				awayPlayerIds: ["a1", "a2"],
			})
		);
		expect(result.rotatedOut).toHaveLength(0);
		expect(result.coinTossNeeded).toBeNull();
	});

	it("3v3: 6 players, 0 waiters → no rotation", () => {
		const players = Array.from({ length: 6 }, (_, i) => makePlayer(`p${i}`));
		const result = computeNextLineup(
			base({
				teamSize: 3,
				players,
				lastResult: "away",
				homePlayerIds: ["p0", "p1", "p2"],
				awayPlayerIds: ["p3", "p4", "p5"],
			})
		);
		expect(result.rotatedOut).toHaveLength(0);
		expect(result.coinTossNeeded).toBeNull();
	});

	it("0 waiters + maxConsecutiveGames set → nobody out (Rule 1 overrides Rule 3)", () => {
		const h1 = makePlayer("h1", { consecutiveGames: 5 });
		const a1 = makePlayer("a1", { consecutiveGames: 1 });
		const result = computeNextLineup(
			base({
				teamSize: 1,
				maxConsecutiveGames: 3,
				players: [h1, a1],
				lastResult: "home",
				homePlayerIds: ["h1"],
				awayPlayerIds: ["a1"],
			})
		);
		expect(result.rotatedOut).toHaveLength(0);
		expect(result.coinTossNeeded).toBeNull();
	});

	it("0 waiters + maxConsecutiveGames, 2v2 → nobody out", () => {
		const h1 = makePlayer("h1", { consecutiveGames: 4 });
		const h2 = makePlayer("h2", { consecutiveGames: 4 });
		const a1 = makePlayer("a1", { consecutiveGames: 1 });
		const a2 = makePlayer("a2", { consecutiveGames: 1 });
		const result = computeNextLineup(
			base({
				teamSize: 2,
				maxConsecutiveGames: 3,
				players: [h1, h2, a1, a2],
				lastResult: "home",
				homePlayerIds: ["h1", "h2"],
				awayPlayerIds: ["a1", "a2"],
			})
		);
		expect(result.rotatedOut).toHaveLength(0);
	});
});

// ─────────────────────────────────────────────────────────
// Rule 2: Consecutive games as universal tiebreaker
// ─────────────────────────────────────────────────────────
describe("Rule 2: Consecutive games as tiebreaker", () => {
	it("2 losers, different consecutive → higher consecutive rotates out", () => {
		const h1 = makePlayer("h1", { consecutiveGames: 2 });
		const h2 = makePlayer("h2", { consecutiveGames: 2 });
		const a1 = makePlayer("a1", { consecutiveGames: 3 });
		const a2 = makePlayer("a2", { consecutiveGames: 1 });
		const w1 = waiter("w1", 1);
		const result = computeNextLineup(
			base({
				teamSize: 2,
				players: [h1, h2, a1, a2, w1],
				lastResult: "home",
				homePlayerIds: ["h1", "h2"],
				awayPlayerIds: ["a1", "a2"],
			})
		);
		expect(result.rotatedOut).toEqual(["a1"]);
		expect(result.coinTossNeeded).toBeNull();
	});

	it("2 winners both need to go out → higher consecutive rotates out", () => {
		const h1 = makePlayer("h1", { consecutiveGames: 5 });
		const h2 = makePlayer("h2", { consecutiveGames: 2 });
		const a1 = makePlayer("a1", { consecutiveGames: 1 });
		const a2 = makePlayer("a2", { consecutiveGames: 1 });
		const w1 = waiter("w1", 1);
		const w2 = waiter("w2", 2);
		const w3 = waiter("w3", 3);
		const result = computeNextLineup(
			base({
				teamSize: 2,
				players: [h1, h2, a1, a2, w1, w2, w3],
				lastResult: "home",
				homePlayerIds: ["h1", "h2"],
				awayPlayerIds: ["a1", "a2"],
			})
		);
		// Both losers + h1 (highest consecutive winner) out
		expect(result.rotatedOut).toContain("a1");
		expect(result.rotatedOut).toContain("a2");
		expect(result.rotatedOut).toContain("h1");
		expect(result.rotatedOut).not.toContain("h2");
		expect(result.rotatedOut).toHaveLength(3);
	});

	it("1v1: 3 players, loser has higher consecutive → loser out", () => {
		const h1 = makePlayer("h1", { consecutiveGames: 2 });
		const a1 = makePlayer("a1", { consecutiveGames: 3 });
		const w1 = waiter("w1", 1);
		const result = computeNextLineup(
			base({
				teamSize: 1,
				players: [h1, a1, w1],
				lastResult: "home",
				homePlayerIds: ["h1"],
				awayPlayerIds: ["a1"],
			})
		);
		expect(result.rotatedOut).toEqual(["a1"]);
	});
});

// ─────────────────────────────────────────────────────────
// Rule 3: maxConsecutiveGames forces rotation
// ─────────────────────────────────────────────────────────
describe("Rule 3: maxConsecutiveGames", () => {
	it("winner at max → forced out when waiter available", () => {
		const h1 = makePlayer("h1", { consecutiveGames: 3 });
		const a1 = makePlayer("a1", { consecutiveGames: 0 });
		const w1 = waiter("w1", 1);
		const result = computeNextLineup(
			base({
				teamSize: 1,
				maxConsecutiveGames: 3,
				players: [h1, a1, w1],
				lastResult: "home",
				homePlayerIds: ["h1"],
				awayPlayerIds: ["a1"],
			})
		);
		expect(result.rotatedOut).toContain("h1");
		expect(result.coinTossNeeded).toBeNull();
	});

	it("winner below max → NOT forced out, loser goes instead", () => {
		const h1 = makePlayer("h1", { consecutiveGames: 2 });
		const a1 = makePlayer("a1", { consecutiveGames: 0 });
		const w1 = waiter("w1", 1);
		const result = computeNextLineup(
			base({
				teamSize: 1,
				maxConsecutiveGames: 3,
				players: [h1, a1, w1],
				lastResult: "home",
				homePlayerIds: ["h1"],
				awayPlayerIds: ["a1"],
			})
		);
		expect(result.rotatedOut).toEqual(["a1"]);
		expect(result.rotatedOut).not.toContain("h1");
	});

	it("forced winner + losers: forced winner takes priority slot", () => {
		const h1 = makePlayer("h1", { consecutiveGames: 3 });
		const h2 = makePlayer("h2", { consecutiveGames: 1 });
		const a1 = makePlayer("a1", { consecutiveGames: 0 });
		const a2 = makePlayer("a2", { consecutiveGames: 0 });
		const w1 = waiter("w1", 1);
		const result = computeNextLineup(
			base({
				teamSize: 2,
				maxConsecutiveGames: 3,
				players: [h1, h2, a1, a2, w1],
				lastResult: "home",
				homePlayerIds: ["h1", "h2"],
				awayPlayerIds: ["a1", "a2"],
			})
		);
		// Only 1 waiter → 1 slot. h1 forced out takes that slot.
		expect(result.rotatedOut).toEqual(["h1"]);
	});

	it("2 forced players, 1 slot → highest consecutive forced out", () => {
		const h1 = makePlayer("h1", { consecutiveGames: 5 });
		const h2 = makePlayer("h2", { consecutiveGames: 3 });
		const a1 = makePlayer("a1", { consecutiveGames: 0 });
		const a2 = makePlayer("a2", { consecutiveGames: 0 });
		const w1 = waiter("w1", 1);
		const result = computeNextLineup(
			base({
				teamSize: 2,
				maxConsecutiveGames: 3,
				players: [h1, h2, a1, a2, w1],
				lastResult: "home",
				homePlayerIds: ["h1", "h2"],
				awayPlayerIds: ["a1", "a2"],
			})
		);
		expect(result.rotatedOut).toEqual(["h1"]);
	});

	it("2 forced + 2 waiters → both forced out", () => {
		const h1 = makePlayer("h1", { consecutiveGames: 4 });
		const h2 = makePlayer("h2", { consecutiveGames: 3 });
		const a1 = makePlayer("a1", { consecutiveGames: 0 });
		const a2 = makePlayer("a2", { consecutiveGames: 0 });
		const w1 = waiter("w1", 1);
		const w2 = waiter("w2", 2);
		const result = computeNextLineup(
			base({
				teamSize: 2,
				maxConsecutiveGames: 3,
				players: [h1, h2, a1, a2, w1, w2],
				lastResult: "home",
				homePlayerIds: ["h1", "h2"],
				awayPlayerIds: ["a1", "a2"],
			})
		);
		expect(result.rotatedOut).toContain("h1");
		expect(result.rotatedOut).toContain("h2");
		expect(result.rotatedOut).toHaveLength(2);
	});

	it("forced winner + remaining slot goes to loser", () => {
		const h1 = makePlayer("h1", { consecutiveGames: 3 });
		const h2 = makePlayer("h2", { consecutiveGames: 1 });
		const a1 = makePlayer("a1", { consecutiveGames: 2 });
		const a2 = makePlayer("a2", { consecutiveGames: 0 });
		const w1 = waiter("w1", 1);
		const w2 = waiter("w2", 2);
		const result = computeNextLineup(
			base({
				teamSize: 2,
				maxConsecutiveGames: 3,
				players: [h1, h2, a1, a2, w1, w2],
				lastResult: "home",
				homePlayerIds: ["h1", "h2"],
				awayPlayerIds: ["a1", "a2"],
			})
		);
		// h1 forced, then 1 remaining slot → a1 (higher consecutive loser)
		expect(result.rotatedOut).toContain("h1");
		expect(result.rotatedOut).toHaveLength(2);
		expect(result.rotatedOut).toContain("a1");
	});

	it("2 forced same consecutive, 1 slot → loser goes out (win/lose breaks tie)", () => {
		const h1 = makePlayer("h1", { consecutiveGames: 3 });
		const a1 = makePlayer("a1", { consecutiveGames: 3 });
		const w1 = waiter("w1", 1);
		const result = computeNextLineup(
			base({
				teamSize: 1,
				maxConsecutiveGames: 3,
				players: [h1, a1, w1],
				lastResult: "home",
				homePlayerIds: ["h1"],
				awayPlayerIds: ["a1"],
			})
		);
		expect(result.rotatedOut).toEqual(["a1"]);
		expect(result.coinTossNeeded).toBeNull();
	});

	it("2v2: forced winner + forced loser, same consecutive, 1 slot → loser goes", () => {
		const h1 = makePlayer("h1", { consecutiveGames: 3 });
		const h2 = makePlayer("h2", { consecutiveGames: 1 });
		const a1 = makePlayer("a1", { consecutiveGames: 3 });
		const a2 = makePlayer("a2", { consecutiveGames: 1 });
		const w1 = waiter("w1", 1);
		const result = computeNextLineup(
			base({
				teamSize: 2,
				maxConsecutiveGames: 3,
				players: [h1, h2, a1, a2, w1],
				lastResult: "home",
				homePlayerIds: ["h1", "h2"],
				awayPlayerIds: ["a1", "a2"],
			})
		);
		// Both at max, but only 1 slot → a1 (loser) goes, h1 (winner) stays
		expect(result.rotatedOut).toEqual(["a1"]);
		expect(result.coinTossNeeded).toBeNull();
	});

	it("2 forced losers same consecutive, 1 slot → coin toss (both losers)", () => {
		const h1 = makePlayer("h1", { consecutiveGames: 1 });
		const h2 = makePlayer("h2", { consecutiveGames: 1 });
		const a1 = makePlayer("a1", { consecutiveGames: 3 });
		const a2 = makePlayer("a2", { consecutiveGames: 3 });
		const w1 = waiter("w1", 1);
		const result = computeNextLineup(
			base({
				teamSize: 2,
				maxConsecutiveGames: 3,
				players: [h1, h2, a1, a2, w1],
				lastResult: "home",
				homePlayerIds: ["h1", "h2"],
				awayPlayerIds: ["a1", "a2"],
			})
		);
		// Both forced, both losers, same consecutive → coin toss
		expect(result.coinTossNeeded).not.toBeNull();
		expect(result.coinTossNeeded!.candidates).toContain("a1");
		expect(result.coinTossNeeded!.candidates).toContain("a2");
	});

	it("2 forced winners same consecutive, 1 slot → coin toss (both winners)", () => {
		const h1 = makePlayer("h1", { consecutiveGames: 3 });
		const h2 = makePlayer("h2", { consecutiveGames: 3 });
		const a1 = makePlayer("a1", { consecutiveGames: 1 });
		const a2 = makePlayer("a2", { consecutiveGames: 1 });
		const w1 = waiter("w1", 1);
		const result = computeNextLineup(
			base({
				teamSize: 2,
				maxConsecutiveGames: 3,
				players: [h1, h2, a1, a2, w1],
				lastResult: "home",
				homePlayerIds: ["h1", "h2"],
				awayPlayerIds: ["a1", "a2"],
			})
		);
		// Both forced, both winners, same consecutive → coin toss
		expect(result.coinTossNeeded).not.toBeNull();
		expect(result.coinTossNeeded!.candidates).toContain("h1");
		expect(result.coinTossNeeded!.candidates).toContain("h2");
	});

	it("forced winner with higher consecutive rotates before forced loser with lower consecutive", () => {
		const h1 = makePlayer("h1", { consecutiveGames: 5 });
		const a1 = makePlayer("a1", { consecutiveGames: 3 });
		const w1 = waiter("w1", 1);
		const result = computeNextLineup(
			base({
				teamSize: 1,
				maxConsecutiveGames: 3,
				players: [h1, a1, w1],
				lastResult: "home",
				homePlayerIds: ["h1"],
				awayPlayerIds: ["a1"],
			})
		);
		// h1 (winner, 5 consecutive) should rotate out before a1 (loser, 3 consecutive)
		// because consecutiveGames is the primary sort for forced players
		expect(result.rotatedOut).toEqual(["h1"]);
		expect(result.coinTossNeeded).toBeNull();
	});

	it("forced players same consecutive: loser rotates before winner (tiebreaker)", () => {
		const h1 = makePlayer("h1", { consecutiveGames: 4 });
		const a1 = makePlayer("a1", { consecutiveGames: 4 });
		const w1 = waiter("w1", 1);
		const result = computeNextLineup(
			base({
				teamSize: 1,
				maxConsecutiveGames: 3,
				players: [h1, a1, w1],
				lastResult: "home",
				homePlayerIds: ["h1"],
				awayPlayerIds: ["a1"],
			})
		);
		// Same consecutive → loser (a1) goes first
		expect(result.rotatedOut).toEqual(["a1"]);
		expect(result.coinTossNeeded).toBeNull();
	});

	it("multiple forced tiers: highest consecutive tier fully processed first", () => {
		const h1 = makePlayer("h1", { consecutiveGames: 5 });
		const h2 = makePlayer("h2", { consecutiveGames: 3 });
		const a1 = makePlayer("a1", { consecutiveGames: 5 });
		const a2 = makePlayer("a2", { consecutiveGames: 3 });
		const w1 = waiter("w1", 1);
		const w2 = waiter("w2", 2);
		const result = computeNextLineup(
			base({
				teamSize: 2,
				maxConsecutiveGames: 3,
				players: [h1, h2, a1, a2, w1, w2],
				lastResult: "home",
				homePlayerIds: ["h1", "h2"],
				awayPlayerIds: ["a1", "a2"],
			})
		);
		// Tier 5: a1 (loser) then h1 (winner) — both rotate out
		// Tier 3 not needed since we only need 2 to rotate out
		expect(result.rotatedOut).toContain("h1");
		expect(result.rotatedOut).toContain("a1");
		expect(result.rotatedOut).toHaveLength(2);
		expect(result.coinTossNeeded).toBeNull();
	});
});

// ─────────────────────────────────────────────────────────
// Rule 4: Losers rotate out before winners
// ─────────────────────────────────────────────────────────
describe("Rule 4: Losers rotate out before winners", () => {
	it("1v1: 1 waiter → loser out", () => {
		const h1 = makePlayer("h1", { consecutiveGames: 1 });
		const a1 = makePlayer("a1", { consecutiveGames: 1 });
		const w1 = waiter("w1", 1);
		const result = computeNextLineup(
			base({
				teamSize: 1,
				players: [h1, a1, w1],
				lastResult: "home",
				homePlayerIds: ["h1"],
				awayPlayerIds: ["a1"],
			})
		);
		expect(result.rotatedOut).toEqual(["a1"]);
		expect(result.homePlayerIds).toContain("h1");
	});

	it("2v2: 2 waiters → both losers out, winners stay", () => {
		const h1 = makePlayer("h1");
		const h2 = makePlayer("h2");
		const a1 = makePlayer("a1");
		const a2 = makePlayer("a2");
		const w1 = waiter("w1", 1);
		const w2 = waiter("w2", 2);
		const result = computeNextLineup(
			base({
				teamSize: 2,
				players: [h1, h2, a1, a2, w1, w2],
				lastResult: "home",
				homePlayerIds: ["h1", "h2"],
				awayPlayerIds: ["a1", "a2"],
			})
		);
		expect(result.rotatedOut).toContain("a1");
		expect(result.rotatedOut).toContain("a2");
		expect(result.rotatedOut).toHaveLength(2);
		expect(result.homePlayerIds).toContain("h1");
		expect(result.homePlayerIds).toContain("h2");
	});

	it("2v2: 3 waiters → both losers + 1 winner (most consecutive) out", () => {
		const h1 = makePlayer("h1", { consecutiveGames: 4 });
		const h2 = makePlayer("h2", { consecutiveGames: 2 });
		const a1 = makePlayer("a1", { consecutiveGames: 1 });
		const a2 = makePlayer("a2", { consecutiveGames: 1 });
		const w1 = waiter("w1", 1);
		const w2 = waiter("w2", 2);
		const w3 = waiter("w3", 3);
		const result = computeNextLineup(
			base({
				teamSize: 2,
				players: [h1, h2, a1, a2, w1, w2, w3],
				lastResult: "home",
				homePlayerIds: ["h1", "h2"],
				awayPlayerIds: ["a1", "a2"],
			})
		);
		expect(result.rotatedOut).toContain("a1");
		expect(result.rotatedOut).toContain("a2");
		expect(result.rotatedOut).toContain("h1");
		expect(result.rotatedOut).not.toContain("h2");
		expect(result.rotatedOut).toHaveLength(3);
	});

	it("winners should NEVER rotate out if no maxConsecutiveGames and fewer waiters than losers", () => {
		const h1 = makePlayer("h1", { consecutiveGames: 10 });
		const a1 = makePlayer("a1", { consecutiveGames: 1 });
		const w1 = waiter("w1", 1);
		const result = computeNextLineup(
			base({
				teamSize: 1,
				players: [h1, a1, w1],
				lastResult: "home",
				homePlayerIds: ["h1"],
				awayPlayerIds: ["a1"],
			})
		);
		// Even though h1 has 10 consecutive games, no maxConsecutiveGames, and 1 waiter
		// fills 1 slot → loser goes, winner stays indefinitely
		expect(result.rotatedOut).toEqual(["a1"]);
	});

	it("winners stay indefinitely when no maxConsecutiveGames (high consecutive)", () => {
		const h1 = makePlayer("h1", { consecutiveGames: 50 });
		const h2 = makePlayer("h2", { consecutiveGames: 50 });
		const a1 = makePlayer("a1", { consecutiveGames: 1 });
		const a2 = makePlayer("a2", { consecutiveGames: 1 });
		const w1 = waiter("w1", 1);
		const w2 = waiter("w2", 2);
		const result = computeNextLineup(
			base({
				teamSize: 2,
				players: [h1, h2, a1, a2, w1, w2],
				lastResult: "home",
				homePlayerIds: ["h1", "h2"],
				awayPlayerIds: ["a1", "a2"],
			})
		);
		// 2 waiters = 2 losers → losers out, winners stay
		expect(result.rotatedOut).toContain("a1");
		expect(result.rotatedOut).toContain("a2");
		expect(result.rotatedOut).toHaveLength(2);
	});

	it("3v3: 3 waiters → all 3 losers out, all 3 winners stay", () => {
		const players = [
			makePlayer("h1", { consecutiveGames: 2 }),
			makePlayer("h2", { consecutiveGames: 2 }),
			makePlayer("h3", { consecutiveGames: 2 }),
			makePlayer("a1", { consecutiveGames: 1 }),
			makePlayer("a2", { consecutiveGames: 1 }),
			makePlayer("a3", { consecutiveGames: 1 }),
			waiter("w1", 1),
			waiter("w2", 2),
			waiter("w3", 3),
		];
		const result = computeNextLineup(
			base({
				teamSize: 3,
				players,
				lastResult: "home",
				homePlayerIds: ["h1", "h2", "h3"],
				awayPlayerIds: ["a1", "a2", "a3"],
			})
		);
		expect(result.rotatedOut).toContain("a1");
		expect(result.rotatedOut).toContain("a2");
		expect(result.rotatedOut).toContain("a3");
		expect(result.rotatedOut).toHaveLength(3);
	});
});

// ─────────────────────────────────────────────────────────
// Rule 5 & 6: Coin toss / random draw
// ─────────────────────────────────────────────────────────
describe("Rule 5 & 6: Coin toss and random draw", () => {
	it("2 losers same consecutive, 1 slot → coin toss", () => {
		const h1 = makePlayer("h1", { consecutiveGames: 2 });
		const h2 = makePlayer("h2", { consecutiveGames: 2 });
		const a1 = makePlayer("a1", { consecutiveGames: 2 });
		const a2 = makePlayer("a2", { consecutiveGames: 2 });
		const w1 = waiter("w1", 1);
		const result = computeNextLineup(
			base({
				teamSize: 2,
				players: [h1, h2, a1, a2, w1],
				lastResult: "home",
				homePlayerIds: ["h1", "h2"],
				awayPlayerIds: ["a1", "a2"],
			})
		);
		expect(result.coinTossNeeded).not.toBeNull();
		expect(result.coinTossNeeded?.conflictType).toBe("loser-rotation");
		expect(result.coinTossNeeded?.candidates).toContain("a1");
		expect(result.coinTossNeeded?.candidates).toContain("a2");
		expect(result.coinTossNeeded?.candidates).toHaveLength(2);
	});

	it("3 losers same consecutive, 2 slots → coin toss among 3 (3v3 scenario)", () => {
		const players = [
			makePlayer("h1", { consecutiveGames: 1 }),
			makePlayer("h2", { consecutiveGames: 1 }),
			makePlayer("h3", { consecutiveGames: 1 }),
			makePlayer("a1", { consecutiveGames: 1 }),
			makePlayer("a2", { consecutiveGames: 1 }),
			makePlayer("a3", { consecutiveGames: 1 }),
			waiter("w1", 1),
			waiter("w2", 2),
		];
		const result = computeNextLineup(
			base({
				teamSize: 3,
				players,
				lastResult: "home",
				homePlayerIds: ["h1", "h2", "h3"],
				awayPlayerIds: ["a1", "a2", "a3"],
			})
		);
		// 2 waiters, 3 losers with same consecutive → need to pick 2 of 3
		expect(result.coinTossNeeded).not.toBeNull();
		expect(result.coinTossNeeded?.conflictType).toBe("loser-rotation");
		expect(result.coinTossNeeded?.candidates).toHaveLength(3);
	});

	it("coin toss only includes losers when winners have different stats", () => {
		const h1 = makePlayer("h1", { consecutiveGames: 3 });
		const h2 = makePlayer("h2", { consecutiveGames: 1 });
		const a1 = makePlayer("a1", { consecutiveGames: 1 });
		const a2 = makePlayer("a2", { consecutiveGames: 1 });
		const w1 = waiter("w1", 1);
		const result = computeNextLineup(
			base({
				teamSize: 2,
				players: [h1, h2, a1, a2, w1],
				lastResult: "away",
				homePlayerIds: ["h1", "h2"],
				awayPlayerIds: ["a1", "a2"],
			})
		);
		// Home lost. h1 (3 consec) and h2 (1 consec) are losers.
		// 1 slot, h1 goes first (higher consec). No coin toss needed.
		expect(result.coinTossNeeded).toBeNull();
		expect(result.rotatedOut).toEqual(["h1"]);
	});

	it("2 winners same consecutive both need to go → coin toss among winners", () => {
		const h1 = makePlayer("h1", { consecutiveGames: 2 });
		const h2 = makePlayer("h2", { consecutiveGames: 2 });
		const a1 = makePlayer("a1", { consecutiveGames: 1 });
		const a2 = makePlayer("a2", { consecutiveGames: 1 });
		const w1 = waiter("w1", 1);
		const w2 = waiter("w2", 2);
		const w3 = waiter("w3", 3);
		// 3 waiters, 2v2: 3 need to go (both losers + 1 winner)
		// Both winners have same consecutive → coin toss among winners for the 1 remaining slot
		const result = computeNextLineup(
			base({
				teamSize: 2,
				players: [h1, h2, a1, a2, w1, w2, w3],
				lastResult: "home",
				homePlayerIds: ["h1", "h2"],
				awayPlayerIds: ["a1", "a2"],
			})
		);
		// Both losers definitely out. 1 more slot needs to be filled.
		// h1 and h2 tied → coin toss
		expect(result.coinTossNeeded).not.toBeNull();
		expect(result.coinTossNeeded?.candidates).toContain("h1");
		expect(result.coinTossNeeded?.candidates).toContain("h2");
		expect(result.coinTossNeeded?.candidates).toHaveLength(2);
		// The 2 losers should already be marked as definite outs
		expect(result.rotatedOut).toContain("a1");
		expect(result.rotatedOut).toContain("a2");
	});

	it("coin toss resolved → correct lineup produced", () => {
		const h1 = makePlayer("h1", { status: "waiting", queuePosition: 0, consecutiveGames: 2 });
		const h2 = makePlayer("h2", { status: "waiting", queuePosition: 1, consecutiveGames: 2 });
		const a1 = makePlayer("a1", { status: "waiting", queuePosition: 2, consecutiveGames: 0 });
		const a2 = makePlayer("a2", { status: "waiting", queuePosition: 3, consecutiveGames: 0 });
		const w1 = waiter("w1", 4);
		const result = computeNextLineup(
			base({
				teamSize: 2,
				players: [h1, h2, a1, a2, w1],
				lastResult: "home",
				homePlayerIds: ["h1", "h2"],
				awayPlayerIds: ["a1", "a2"],
				resolvedCoinTossWinnerIds: ["a1"],
			})
		);
		expect(result.coinTossNeeded).toBeNull();
		// a2 should be displaced (coin toss loser), a1 stays
		expect(result.rotatedOut).toContain("a2");
		expect(result.rotatedOut).toHaveLength(1);
		const playing = allPlayerIds(result);
		expect(playing).toContain("h1");
		expect(playing).toContain("h2");
		expect(playing).toContain("a1");
		expect(playing).toContain("w1");
		expect(playing).toHaveLength(4);
	});

	it("forced players with same consecutive → coin toss among forced", () => {
		const h1 = makePlayer("h1", { consecutiveGames: 3 });
		const h2 = makePlayer("h2", { consecutiveGames: 3 });
		const a1 = makePlayer("a1", { consecutiveGames: 0 });
		const a2 = makePlayer("a2", { consecutiveGames: 0 });
		const w1 = waiter("w1", 1);
		// maxConsecutiveGames=3, 2 forced, only 1 slot
		const result = computeNextLineup(
			base({
				teamSize: 2,
				maxConsecutiveGames: 3,
				players: [h1, h2, a1, a2, w1],
				lastResult: "home",
				homePlayerIds: ["h1", "h2"],
				awayPlayerIds: ["a1", "a2"],
			})
		);
		expect(result.coinTossNeeded).not.toBeNull();
		expect(result.coinTossNeeded?.conflictType).toBe("max-consecutive-exceeded");
		expect(result.coinTossNeeded?.candidates).toContain("h1");
		expect(result.coinTossNeeded?.candidates).toContain("h2");
	});
});

// ─────────────────────────────────────────────────────────
// Special: Waiters >= playing → all rotate out
// ─────────────────────────────────────────────────────────
describe("Special: Waiters >= playing → all rotate out", () => {
	it("2v2: 8 players (4 waiting) → all 4 playing rotate out", () => {
		const h1 = makePlayer("h1", { consecutiveGames: 1 });
		const h2 = makePlayer("h2", { consecutiveGames: 1 });
		const a1 = makePlayer("a1", { consecutiveGames: 1 });
		const a2 = makePlayer("a2", { consecutiveGames: 1 });
		const result = computeNextLineup(
			base({
				teamSize: 2,
				players: [
					h1,
					h2,
					a1,
					a2,
					waiter("w1", 1),
					waiter("w2", 2),
					waiter("w3", 3),
					waiter("w4", 4),
				],
				lastResult: "home",
				homePlayerIds: ["h1", "h2"],
				awayPlayerIds: ["a1", "a2"],
			})
		);
		expect(result.rotatedOut).toHaveLength(4);
		expect(result.rotatedOut).toContain("h1");
		expect(result.rotatedOut).toContain("h2");
		expect(result.rotatedOut).toContain("a1");
		expect(result.rotatedOut).toContain("a2");
		expect(result.coinTossNeeded).toBeNull();
		// All waiters play
		const playing = allPlayerIds(result);
		expect(playing).toContain("w1");
		expect(playing).toContain("w2");
		expect(playing).toContain("w3");
		expect(playing).toContain("w4");
	});

	it("1v1: 4 players (2 waiting) → both playing rotate out", () => {
		const h1 = makePlayer("h1", { consecutiveGames: 5 });
		const a1 = makePlayer("a1", { consecutiveGames: 1 });
		const result = computeNextLineup(
			base({
				teamSize: 1,
				players: [h1, a1, waiter("w1", 1), waiter("w2", 2)],
				lastResult: "home",
				homePlayerIds: ["h1"],
				awayPlayerIds: ["a1"],
			})
		);
		expect(result.rotatedOut).toHaveLength(2);
		expect(result.rotatedOut).toContain("h1");
		expect(result.rotatedOut).toContain("a1");
	});

	it("3v3: 12 players (6 waiting) → all 6 playing rotate out", () => {
		const playing = Array.from({ length: 6 }, (_, i) =>
			makePlayer(`p${i}`, { consecutiveGames: 3 })
		);
		const waiting = Array.from({ length: 6 }, (_, i) => waiter(`w${i}`, i + 1));
		const result = computeNextLineup(
			base({
				teamSize: 3,
				players: [...playing, ...waiting],
				lastResult: "home",
				homePlayerIds: ["p0", "p1", "p2"],
				awayPlayerIds: ["p3", "p4", "p5"],
			})
		);
		expect(result.rotatedOut).toHaveLength(6);
		expect(result.coinTossNeeded).toBeNull();
	});

	it("2v2: 5+ waiters → all rotate out, winners have no privilege", () => {
		const h1 = makePlayer("h1", { consecutiveGames: 1 });
		const h2 = makePlayer("h2", { consecutiveGames: 1 });
		const a1 = makePlayer("a1", { consecutiveGames: 1 });
		const a2 = makePlayer("a2", { consecutiveGames: 1 });
		const result = computeNextLineup(
			base({
				teamSize: 2,
				players: [
					h1,
					h2,
					a1,
					a2,
					waiter("w1", 1),
					waiter("w2", 2),
					waiter("w3", 3),
					waiter("w4", 4),
					waiter("w5", 5),
				],
				lastResult: "home",
				homePlayerIds: ["h1", "h2"],
				awayPlayerIds: ["a1", "a2"],
			})
		);
		// 5 waiters >= 4 playing → all 4 rotate out
		expect(result.rotatedOut).toHaveLength(4);
	});
});

// ─────────────────────────────────────────────────────────
// Special: 7 players in 2v2 (3 waiters, 4 playing)
// ─────────────────────────────────────────────────────────
describe("Special: 7 players in 2v2", () => {
	it("3 waiters → 2 losers + 1 winner (most consecutive) out", () => {
		const h1 = makePlayer("h1", { consecutiveGames: 3 });
		const h2 = makePlayer("h2", { consecutiveGames: 1 });
		const a1 = makePlayer("a1", { consecutiveGames: 2 });
		const a2 = makePlayer("a2", { consecutiveGames: 1 });
		const result = computeNextLineup(
			base({
				teamSize: 2,
				players: [h1, h2, a1, a2, waiter("w1", 1), waiter("w2", 2), waiter("w3", 3)],
				lastResult: "home",
				homePlayerIds: ["h1", "h2"],
				awayPlayerIds: ["a1", "a2"],
			})
		);
		expect(result.rotatedOut).toContain("a1");
		expect(result.rotatedOut).toContain("a2");
		expect(result.rotatedOut).toContain("h1");
		expect(result.rotatedOut).not.toContain("h2");
		expect(result.rotatedOut).toHaveLength(3);
		expect(result.coinTossNeeded).toBeNull();
	});

	it("3 waiters, winners with equal consecutive → coin toss for which winner goes", () => {
		const h1 = makePlayer("h1", { consecutiveGames: 2 });
		const h2 = makePlayer("h2", { consecutiveGames: 2 });
		const a1 = makePlayer("a1", { consecutiveGames: 1 });
		const a2 = makePlayer("a2", { consecutiveGames: 1 });
		const result = computeNextLineup(
			base({
				teamSize: 2,
				players: [h1, h2, a1, a2, waiter("w1", 1), waiter("w2", 2), waiter("w3", 3)],
				lastResult: "home",
				homePlayerIds: ["h1", "h2"],
				awayPlayerIds: ["a1", "a2"],
			})
		);
		// 2 losers definitely out. 1 more winner needed → tied → coin toss
		expect(result.coinTossNeeded).not.toBeNull();
		expect(result.coinTossNeeded?.candidates).toContain("h1");
		expect(result.coinTossNeeded?.candidates).toContain("h2");
		expect(result.rotatedOut).toContain("a1");
		expect(result.rotatedOut).toContain("a2");
	});
});

// ─────────────────────────────────────────────────────────
// Draw handling
// ─────────────────────────────────────────────────────────
describe("Draw handling", () => {
	it("draw with unequal consecutive sums → higher sum team treated as loser", () => {
		const h1 = makePlayer("h1", { consecutiveGames: 4 });
		const h2 = makePlayer("h2", { consecutiveGames: 3 });
		const a1 = makePlayer("a1", { consecutiveGames: 1 });
		const a2 = makePlayer("a2", { consecutiveGames: 1 });
		const w1 = waiter("w1", 1);
		const result = computeNextLineup(
			base({
				teamSize: 2,
				players: [h1, h2, a1, a2, w1],
				lastResult: "draw",
				homePlayerIds: ["h1", "h2"],
				awayPlayerIds: ["a1", "a2"],
			})
		);
		// Home sum (7) > away sum (2) → home treated as loser
		expect(result.coinTossNeeded).toBeNull();
		expect(result.rotatedOut).toHaveLength(1);
		expect(["h1", "h2"]).toContain(result.rotatedOut[0]);
	});

	it("draw with equal sums → draw-tiebreak coin toss", () => {
		const h1 = makePlayer("h1", { consecutiveGames: 2 });
		const h2 = makePlayer("h2", { consecutiveGames: 1 });
		const a1 = makePlayer("a1", { consecutiveGames: 2 });
		const a2 = makePlayer("a2", { consecutiveGames: 1 });
		const w1 = waiter("w1", 1);
		const result = computeNextLineup(
			base({
				teamSize: 2,
				players: [h1, h2, a1, a2, w1],
				lastResult: "draw",
				homePlayerIds: ["h1", "h2"],
				awayPlayerIds: ["a1", "a2"],
			})
		);
		expect(result.coinTossNeeded?.conflictType).toBe("draw-tiebreak");
		expect(result.coinTossNeeded?.candidates).toHaveLength(4);
	});

	it("draw coin toss resolved → correct rotation", () => {
		const h1 = makePlayer("h1", { consecutiveGames: 1 });
		const h2 = makePlayer("h2", { consecutiveGames: 1 });
		const a1 = makePlayer("a1", { consecutiveGames: 1 });
		const a2 = makePlayer("a2", { consecutiveGames: 1 });
		const w1 = waiter("w1", 1);
		const result = computeNextLineup(
			base({
				teamSize: 2,
				players: [h1, h2, a1, a2, w1],
				lastResult: "draw",
				homePlayerIds: ["h1", "h2"],
				awayPlayerIds: ["a1", "a2"],
				resolvedCoinTossWinnerIds: ["h1", "h2"],
			})
		);
		expect(result.coinTossNeeded).toBeNull();
		// Home wins coin toss → away treated as losers → 1 away player out
		expect(result.rotatedOut).toHaveLength(1);
		expect(["a1", "a2"]).toContain(result.rotatedOut[0]);
	});

	it("draw with 0 waiters → draw-tiebreak coin toss (but no displacement)", () => {
		const h1 = makePlayer("h1", { consecutiveGames: 1 });
		const a1 = makePlayer("a1", { consecutiveGames: 1 });
		const result = computeNextLineup(
			base({
				teamSize: 1,
				players: [h1, a1],
				lastResult: "draw",
				homePlayerIds: ["h1"],
				awayPlayerIds: ["a1"],
			})
		);
		// 0 waiters → Rule 1: nobody out. But draw with equal sums...
		// Actually with 0 waiters, it doesn't matter who is "winner" — nobody goes out.
		expect(result.rotatedOut).toHaveLength(0);
		expect(result.coinTossNeeded).toBeNull();
	});

	it("1v1 draw, 1 waiter, unequal consecutive → higher out", () => {
		const h1 = makePlayer("h1", { consecutiveGames: 3 });
		const a1 = makePlayer("a1", { consecutiveGames: 1 });
		const w1 = waiter("w1", 1);
		const result = computeNextLineup(
			base({
				teamSize: 1,
				players: [h1, a1, w1],
				lastResult: "draw",
				homePlayerIds: ["h1"],
				awayPlayerIds: ["a1"],
			})
		);
		// h1 sum (3) > a1 sum (1) → h1 treated as loser
		expect(result.rotatedOut).toEqual(["h1"]);
	});
});

// ─────────────────────────────────────────────────────────
// Team placement after rotation
// ─────────────────────────────────────────────────────────
describe("Team placement", () => {
	it("winners stay on their original side", () => {
		const h1 = makePlayer("h1", { consecutiveGames: 2 });
		const h2 = makePlayer("h2", { consecutiveGames: 2 });
		const a1 = makePlayer("a1", { consecutiveGames: 1 });
		const a2 = makePlayer("a2", { consecutiveGames: 1 });
		const w1 = waiter("w1", 1);
		const w2 = waiter("w2", 2);
		const result = computeNextLineup(
			base({
				teamSize: 2,
				players: [h1, h2, a1, a2, w1, w2],
				lastResult: "home",
				homePlayerIds: ["h1", "h2"],
				awayPlayerIds: ["a1", "a2"],
			})
		);
		expect(result.homePlayerIds).toContain("h1");
		expect(result.homePlayerIds).toContain("h2");
		expect(result.homePlayerIds).toHaveLength(2);
		expect(result.awayPlayerIds).toContain("w1");
		expect(result.awayPlayerIds).toContain("w2");
		expect(result.awayPlayerIds).toHaveLength(2);
	});

	it("when away wins, away stays on away side", () => {
		const h1 = makePlayer("h1", { consecutiveGames: 1 });
		const a1 = makePlayer("a1", { consecutiveGames: 1 });
		const w1 = waiter("w1", 1);
		const result = computeNextLineup(
			base({
				teamSize: 1,
				players: [h1, a1, w1],
				lastResult: "away",
				homePlayerIds: ["h1"],
				awayPlayerIds: ["a1"],
			})
		);
		expect(result.awayPlayerIds).toContain("a1");
		expect(result.homePlayerIds).toContain("w1");
	});

	it("waiters fill opposing team by queue position order", () => {
		const h1 = makePlayer("h1", { consecutiveGames: 2 });
		const h2 = makePlayer("h2", { consecutiveGames: 2 });
		const a1 = makePlayer("a1", { consecutiveGames: 1 });
		const a2 = makePlayer("a2", { consecutiveGames: 1 });
		const w1 = waiter("w1", 1);
		const w2 = waiter("w2", 2);
		const result = computeNextLineup(
			base({
				teamSize: 2,
				players: [h1, h2, a1, a2, w1, w2],
				lastResult: "home",
				homePlayerIds: ["h1", "h2"],
				awayPlayerIds: ["a1", "a2"],
			})
		);
		// Away team should be waiters in queue order
		expect(result.awayPlayerIds[0]).toBe("w1");
		expect(result.awayPlayerIds[1]).toBe("w2");
	});

	it("total playing count correct: 2v2 has 4 players", () => {
		const h1 = makePlayer("h1", { consecutiveGames: 2 });
		const h2 = makePlayer("h2", { consecutiveGames: 2 });
		const a1 = makePlayer("a1", { consecutiveGames: 2 });
		const a2 = makePlayer("a2", { consecutiveGames: 1 });
		const w1 = waiter("w1", 1);
		const result = computeNextLineup(
			base({
				teamSize: 2,
				players: [h1, h2, a1, a2, w1],
				lastResult: "home",
				homePlayerIds: ["h1", "h2"],
				awayPlayerIds: ["a1", "a2"],
			})
		);
		const playing = allPlayerIds(result);
		expect(playing).toHaveLength(4);
		expect(new Set(playing).size).toBe(4);
	});
});

// ─────────────────────────────────────────────────────────
// Always-split constraints
// ─────────────────────────────────────────────────────────
describe("Always-split constraints", () => {
	it("constrained players swapped to opposite teams", () => {
		const h1 = makePlayer("h1");
		const h2 = makePlayer("h2");
		const a1 = makePlayer("a1");
		const a2 = makePlayer("a2");
		const result = computeNextLineup(
			base({
				teamSize: 2,
				players: [h1, h2, a1, a2],
				lastResult: "home",
				homePlayerIds: ["h1", "h2"],
				awayPlayerIds: ["a1", "a2"],
				alwaysSplitConstraints: [["sp-h1", "sp-h2"]],
			})
		);
		const h1Home = result.homePlayerIds.includes("h1");
		const h2Home = result.homePlayerIds.includes("h2");
		expect(h1Home).not.toBe(h2Home);
	});

	it("already-split players not affected", () => {
		const h1 = makePlayer("h1");
		const h2 = makePlayer("h2");
		const a1 = makePlayer("a1");
		const a2 = makePlayer("a2");
		const result = computeNextLineup(
			base({
				teamSize: 2,
				players: [h1, h2, a1, a2],
				lastResult: "home",
				homePlayerIds: ["h1", "h2"],
				awayPlayerIds: ["a1", "a2"],
				alwaysSplitConstraints: [["sp-h1", "sp-a1"]],
			})
		);
		expect(result.homePlayerIds).toContain("h1");
		expect(result.awayPlayerIds).toContain("a1");
	});
});

// ─────────────────────────────────────────────────────────
// Round-robin mode (keep existing behavior)
// ─────────────────────────────────────────────────────────
describe("Round-robin mode", () => {
	it("all playing rotate out, waiters fill in order", () => {
		const p1 = makePlayer("p1", { status: "playing", queuePosition: 0 });
		const p2 = makePlayer("p2", { status: "playing", queuePosition: 1 });
		const w1 = makePlayer("w1", { status: "waiting", queuePosition: 2, consecutiveGames: 0 });
		const w2 = makePlayer("w2", { status: "waiting", queuePosition: 3, consecutiveGames: 0 });
		const result = computeNextLineup(
			base({
				mode: "round-robin",
				teamSize: 1,
				players: [p1, p2, w1, w2],
				lastResult: "home",
				homePlayerIds: ["p1"],
				awayPlayerIds: ["p2"],
			})
		);
		expect(result.homePlayerIds).toEqual(["w1"]);
		expect(result.awayPlayerIds).toEqual(["w2"]);
		expect(result.coinTossNeeded).toBeNull();
	});
});

// ─────────────────────────────────────────────────────────
// Manual mode
// ─────────────────────────────────────────────────────────
describe("Manual mode", () => {
	it("returns empty lineup", () => {
		const result = computeNextLineup(base({ mode: "manual" }));
		expect(result.homePlayerIds).toHaveLength(0);
		expect(result.awayPlayerIds).toHaveLength(0);
		expect(result.coinTossNeeded).toBeNull();
	});
});

// ─────────────────────────────────────────────────────────
// Edge cases and regression tests
// ─────────────────────────────────────────────────────────
describe("Edge cases", () => {
	it("player with 2 consecutive wins should NOT be kicked when max is 3", () => {
		const h1 = makePlayer("h1", { consecutiveGames: 2 });
		const h2 = makePlayer("h2", { consecutiveGames: 2 });
		const a1 = makePlayer("a1", { consecutiveGames: 1 });
		const a2 = makePlayer("a2", { consecutiveGames: 0 });
		const w1 = waiter("w1", 1);
		const result = computeNextLineup(
			base({
				teamSize: 2,
				maxConsecutiveGames: 3,
				players: [h1, h2, a1, a2, w1],
				lastResult: "home",
				homePlayerIds: ["h1", "h2"],
				awayPlayerIds: ["a1", "a2"],
			})
		);
		expect(result.rotatedOut).not.toContain("h1");
		expect(result.rotatedOut).not.toContain("h2");
		expect(result.rotatedOut).toHaveLength(1);
		expect(result.rotatedOut[0]).toMatch(/^a[12]$/);
	});

	it("player at exactly max consecutive → forced out", () => {
		const h1 = makePlayer("h1", { consecutiveGames: 3 });
		const h2 = makePlayer("h2", { consecutiveGames: 2 });
		const a1 = makePlayer("a1", { consecutiveGames: 0 });
		const a2 = makePlayer("a2", { consecutiveGames: 0 });
		const w1 = waiter("w1", 1);
		const result = computeNextLineup(
			base({
				teamSize: 2,
				maxConsecutiveGames: 3,
				players: [h1, h2, a1, a2, w1],
				lastResult: "home",
				homePlayerIds: ["h1", "h2"],
				awayPlayerIds: ["a1", "a2"],
			})
		);
		expect(result.rotatedOut).toContain("h1");
		expect(result.rotatedOut).toHaveLength(1);
		const playing = allPlayerIds(result);
		expect(playing).toHaveLength(4);
		expect(playing).toContain("w1");
	});

	it("all players with same stats, first game → coin toss among losers only", () => {
		const h1 = makePlayer("h1");
		const h2 = makePlayer("h2");
		const a1 = makePlayer("a1");
		const a2 = makePlayer("a2");
		const w1 = waiter("w1", 1);
		const result = computeNextLineup(
			base({
				teamSize: 2,
				players: [h1, h2, a1, a2, w1],
				lastResult: "away",
				homePlayerIds: ["h1", "h2"],
				awayPlayerIds: ["a1", "a2"],
			})
		);
		// Home lost. Both have same consecutive → coin toss among losers
		expect(result.coinTossNeeded).not.toBeNull();
		expect(result.coinTossNeeded?.conflictType).toBe("loser-rotation");
		expect(result.coinTossNeeded?.candidates).toEqual(expect.arrayContaining(["h1", "h2"]));
		expect(result.coinTossNeeded?.candidates).toHaveLength(2);
	});

	it("1v1 with multiple waiters: waiter replaces loser, winner stays", () => {
		const h1 = makePlayer("h1", { consecutiveGames: 3 });
		const a1 = makePlayer("a1", { consecutiveGames: 1 });
		const result = computeNextLineup(
			base({
				teamSize: 1,
				players: [h1, a1, waiter("w1", 1)],
				lastResult: "home",
				homePlayerIds: ["h1"],
				awayPlayerIds: ["a1"],
			})
		);
		expect(result.rotatedOut).toEqual(["a1"]);
		expect(result.homePlayerIds).toContain("h1");
		expect(result.awayPlayerIds).toContain("w1");
	});

	it("handles player list with out status players (ignored)", () => {
		const h1 = makePlayer("h1", { consecutiveGames: 2 });
		const a1 = makePlayer("a1", { consecutiveGames: 1 });
		const out1 = makePlayer("out1", { status: "out", consecutiveGames: 0 });
		const w1 = waiter("w1", 1);
		const result = computeNextLineup(
			base({
				teamSize: 1,
				players: [h1, a1, out1, w1],
				lastResult: "home",
				homePlayerIds: ["h1"],
				awayPlayerIds: ["a1"],
			})
		);
		expect(result.rotatedOut).toEqual(["a1"]);
		const playing = allPlayerIds(result);
		expect(playing).not.toContain("out1");
	});
});

// ─────────────────────────────────────────────────────────
// Auto-randomize: team assignment shuffled
// ─────────────────────────────────────────────────────────
describe("Auto-randomize", () => {
	it("rotation logic unchanged: same players rotate out", () => {
		const h1 = makePlayer("h1", { consecutiveGames: 3 });
		const a1 = makePlayer("a1", { consecutiveGames: 1 });
		const w1 = waiter("w1", 1);
		const result = computeNextLineup(
			base({
				teamSize: 1,
				autoRandomize: true,
				players: [h1, a1, w1],
				lastResult: "home",
				homePlayerIds: ["h1"],
				awayPlayerIds: ["a1"],
			})
		);
		expect(result.rotatedOut).toEqual(["a1"]);
		const playing = allPlayerIds(result);
		expect(playing).toHaveLength(2);
		expect(playing).toContain("h1");
		expect(playing).toContain("w1");
	});

	it("correct players are playing in 2v2", () => {
		const h1 = makePlayer("h1", { consecutiveGames: 2 });
		const h2 = makePlayer("h2", { consecutiveGames: 1 });
		const a1 = makePlayer("a1", { consecutiveGames: 2 });
		const a2 = makePlayer("a2", { consecutiveGames: 1 });
		const w1 = waiter("w1", 1);
		const w2 = waiter("w2", 2);
		const result = computeNextLineup(
			base({
				teamSize: 2,
				autoRandomize: true,
				players: [h1, h2, a1, a2, w1, w2],
				lastResult: "home",
				homePlayerIds: ["h1", "h2"],
				awayPlayerIds: ["a1", "a2"],
			})
		);
		// Losers with highest consecutive rotate out
		expect(result.rotatedOut).toHaveLength(2);
		expect(result.rotatedOut).toContain("a1");
		expect(result.rotatedOut).toContain("a2");
		// Correct 4 players are playing, team assignment is random
		const playing = allPlayerIds(result);
		expect(playing).toHaveLength(4);
		expect(playing).toContain("h1");
		expect(playing).toContain("h2");
		expect(playing).toContain("w1");
		expect(playing).toContain("w2");
		expect(result.homePlayerIds).toHaveLength(2);
		expect(result.awayPlayerIds).toHaveLength(2);
	});

	it("all-rotate-out path also shuffles teams", () => {
		const h1 = makePlayer("h1", { consecutiveGames: 1 });
		const h2 = makePlayer("h2", { consecutiveGames: 1 });
		const a1 = makePlayer("a1", { consecutiveGames: 1 });
		const a2 = makePlayer("a2", { consecutiveGames: 1 });
		const w1 = waiter("w1", 1);
		const w2 = waiter("w2", 2);
		const w3 = waiter("w3", 3);
		const w4 = waiter("w4", 4);
		const result = computeNextLineup(
			base({
				teamSize: 2,
				autoRandomize: true,
				players: [h1, h2, a1, a2, w1, w2, w3, w4],
				lastResult: "home",
				homePlayerIds: ["h1", "h2"],
				awayPlayerIds: ["a1", "a2"],
			})
		);
		expect(result.rotatedOut).toHaveLength(4);
		const playing = allPlayerIds(result);
		expect(playing).toHaveLength(4);
		expect(playing).toContain("w1");
		expect(playing).toContain("w2");
		expect(playing).toContain("w3");
		expect(playing).toContain("w4");
		expect(result.homePlayerIds).toHaveLength(2);
		expect(result.awayPlayerIds).toHaveLength(2);
	});

	it("without autoRandomize: winners stay on their side", () => {
		const h1 = makePlayer("h1", { consecutiveGames: 1 });
		const a1 = makePlayer("a1", { consecutiveGames: 1 });
		const w1 = waiter("w1", 1);
		const result = computeNextLineup(
			base({
				teamSize: 1,
				autoRandomize: false,
				players: [h1, a1, w1],
				lastResult: "home",
				homePlayerIds: ["h1"],
				awayPlayerIds: ["a1"],
			})
		);
		// Winner h1 stays on home side
		expect(result.homePlayerIds).toContain("h1");
		expect(result.awayPlayerIds).toContain("w1");
	});
});
