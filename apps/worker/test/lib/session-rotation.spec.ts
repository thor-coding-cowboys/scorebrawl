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
		maxConsecutiveEnabled: false,
		winnersTakePriority: false,
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

describe("No waiters → nobody rotates", () => {
	it("1v1 no waiters → rotatedOut empty", () => {
		const h1 = makePlayer("h1", { queuePosition: 0 });
		const a1 = makePlayer("a1", { queuePosition: 1 });
		const result = computeNextLineup(
			base({ teamSize: 1, players: [h1, a1], homePlayerIds: ["h1"], awayPlayerIds: ["a1"] })
		);
		expect(result.rotatedOut).toHaveLength(0);
		expect(result.coinTossNeeded).toBeNull();
	});

	it("2v2 no waiters → rotatedOut empty", () => {
		const players = [
			makePlayer("h1", { queuePosition: 0 }),
			makePlayer("h2", { queuePosition: 1 }),
			makePlayer("a1", { queuePosition: 2 }),
			makePlayer("a2", { queuePosition: 3 }),
		];
		const result = computeNextLineup(
			base({ teamSize: 2, players, homePlayerIds: ["h1", "h2"], awayPlayerIds: ["a1", "a2"] })
		);
		expect(result.rotatedOut).toHaveLength(0);
	});
});

describe("Winner-stays: select by queuePosition ASC", () => {
	it("player with highest queuePosition is rotated out regardless of consecutiveGames", () => {
		const h1 = makePlayer("h1", { queuePosition: 3, consecutiveGames: 1 });
		const a1 = makePlayer("a1", { queuePosition: 1, consecutiveGames: 1 });
		const w1 = waiter("w1", 0, 0);
		const w2 = waiter("w2", 2, 0);
		const result = computeNextLineup(
			base({ teamSize: 1, players: [h1, a1, w1, w2], homePlayerIds: ["h1"], awayPlayerIds: ["a1"] })
		);
		expect(result.rotatedOut).toEqual(["h1"]);
	});

	it("player with lowest queuePosition is selected even with high consecutiveGames", () => {
		const h1 = makePlayer("h1", { queuePosition: 0, consecutiveGames: 5 });
		const a1 = makePlayer("a1", { queuePosition: 1, consecutiveGames: 1 });
		const w1 = waiter("w1", 2, 0);
		const result = computeNextLineup(
			base({ teamSize: 1, players: [h1, a1, w1], homePlayerIds: ["h1"], awayPlayerIds: ["a1"] })
		);
		expect(result.rotatedOut).toHaveLength(0);
		expect(allPlayerIds(result)).toContain("h1");
	});

	it("winnersTakePriority setting does NOT affect selection order", () => {
		const h1 = makePlayer("h1", { queuePosition: 3, consecutiveGames: 1 });
		const a1 = makePlayer("a1", { queuePosition: 1, consecutiveGames: 1 });
		const w1 = waiter("w1", 0, 0);
		const w2 = waiter("w2", 2, 0);
		const result = computeNextLineup(
			base({
				teamSize: 1,
				winnersTakePriority: true,
				players: [h1, a1, w1, w2],
				homePlayerIds: ["h1"],
				awayPlayerIds: ["a1"],
			})
		);
		expect(result.rotatedOut).toEqual(["h1"]);
	});
});

describe("Round robin: select by consecutiveGames ASC then queuePosition", () => {
	it("playing players with higher consecutive rotate out", () => {
		const p1 = makePlayer("p1", { status: "playing", queuePosition: 0, consecutiveGames: 1 });
		const p2 = makePlayer("p2", { status: "playing", queuePosition: 1, consecutiveGames: 1 });
		const w1 = waiter("w1", 2, 0);
		const w2 = waiter("w2", 3, 0);
		const result = computeNextLineup(
			base({
				mode: "round-robin",
				teamSize: 1,
				players: [p1, p2, w1, w2],
				homePlayerIds: ["p1"],
				awayPlayerIds: ["p2"],
			})
		);
		expect(result.rotatedOut).toContain("p1");
		expect(result.rotatedOut).toContain("p2");
		expect(result.homePlayerIds).toEqual(["w1"]);
		expect(result.awayPlayerIds).toEqual(["w2"]);
	});
});

describe("Manual mode", () => {
	it("returns empty lineup", () => {
		const result = computeNextLineup(base({ mode: "manual" }));
		expect(result.homePlayerIds).toHaveLength(0);
		expect(result.awayPlayerIds).toHaveLength(0);
		expect(result.coinTossNeeded).toBeNull();
	});
});

describe("autoRandomize", () => {
	it("all selected players are assigned to teams", () => {
		const h1 = makePlayer("h1", { queuePosition: 0 });
		const a1 = makePlayer("a1", { queuePosition: 1 });
		const w1 = waiter("w1", 2);
		const w2 = waiter("w2", 3);
		const result = computeNextLineup(
			base({
				teamSize: 2,
				autoRandomize: true,
				players: [h1, a1, w1, w2],
				homePlayerIds: ["h1"],
				awayPlayerIds: ["a1"],
			})
		);
		expect(allPlayerIds(result)).toHaveLength(4);
		expect(result.homePlayerIds).toHaveLength(2);
		expect(result.awayPlayerIds).toHaveLength(2);
	});
});

describe("Always-split constraints", () => {
	it("constrained players end up on opposite teams", () => {
		const h1 = makePlayer("h1", { queuePosition: 0 });
		const h2 = makePlayer("h2", { queuePosition: 1 });
		const a1 = makePlayer("a1", { queuePosition: 2 });
		const a2 = makePlayer("a2", { queuePosition: 3 });
		const result = computeNextLineup(
			base({
				teamSize: 2,
				players: [h1, h2, a1, a2],
				homePlayerIds: ["h1", "h2"],
				awayPlayerIds: ["a1", "a2"],
				alwaysSplitConstraints: [["sp-h1", "sp-h2"]],
			})
		);
		const h1Home = result.homePlayerIds.includes("h1");
		const h2Home = result.homePlayerIds.includes("h2");
		expect(h1Home).not.toBe(h2Home);
	});
});

describe("Out players", () => {
	it("out players are excluded from selection", () => {
		const h1 = makePlayer("h1", { queuePosition: 0 });
		const a1 = makePlayer("a1", { queuePosition: 1 });
		const out1 = makePlayer("out1", { status: "out", queuePosition: 2 });
		const w1 = waiter("w1", 3);
		const result = computeNextLineup(
			base({
				teamSize: 1,
				players: [h1, a1, out1, w1],
				homePlayerIds: ["h1"],
				awayPlayerIds: ["a1"],
			})
		);
		expect(allPlayerIds(result)).not.toContain("out1");
	});
});

describe("Draw handling", () => {
	it("draw with equal consecutive sums triggers coin toss", () => {
		const h1 = makePlayer("h1", { queuePosition: 0, consecutiveGames: 1 });
		const h2 = makePlayer("h2", { queuePosition: 1, consecutiveGames: 1 });
		const a1 = makePlayer("a1", { queuePosition: 2, consecutiveGames: 1 });
		const a2 = makePlayer("a2", { queuePosition: 3, consecutiveGames: 1 });
		const result = computeNextLineup(
			base({
				teamSize: 2,
				players: [h1, h2, a1, a2],
				lastResult: "draw",
				homePlayerIds: ["h1", "h2"],
				awayPlayerIds: ["a1", "a2"],
			})
		);
		expect(result.coinTossNeeded?.conflictType).toBe("draw-tiebreak");
	});
});
