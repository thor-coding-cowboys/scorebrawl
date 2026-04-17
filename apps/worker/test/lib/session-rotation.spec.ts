import { describe, expect, it } from "vitest";
import {
	type SessionPlayerState,
	computeWinnerStaysLineup,
	type WinnerStaysRotationInput,
} from "../../src/services/session/strategies/winner-stays";
import { diversityShuffle, fisherYatesShuffle } from "../../src/lib/shuffle";

function makePlayer(id: string, overrides: Partial<SessionPlayerState> = {}): SessionPlayerState {
	return {
		id,
		seasonPlayerId: `sp-${id}`,
		status: "playing",
		queuePosition: 0,
		consecutiveGames: 1,
		...overrides,
	};
}

function waiter(id: string, queuePosition: number, consecutiveGames = 0): SessionPlayerState {
	return makePlayer(id, {
		status: "waiting",
		queuePosition,
		consecutiveGames,
	});
}

function base(overrides: Partial<WinnerStaysRotationInput> = {}): WinnerStaysRotationInput {
	return {
		settings: {
			mode: "winner-stays",
			maxConsecutiveGames: null,
			winnersTakePriority: false,
			autoRandomize: false,
			randomizerType: "fisher-yates",
			autoCoinToss: false,
			alwaysSplitConstraints: [],
		},
		teamSize: 1,
		players: [],
		lastMatchResult: "home",
		lastMatchHome: [],
		lastMatchAway: [],
		matchHistory: [],
		resolvedCoinTossWinnerIds: null,
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
		const result = computeWinnerStaysLineup(
			base({ teamSize: 1, players: [h1, a1], lastMatchHome: ["h1"], lastMatchAway: ["a1"] })
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
		const result = computeWinnerStaysLineup(
			base({ teamSize: 2, players, lastMatchHome: ["h1", "h2"], lastMatchAway: ["a1", "a2"] })
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
		const result = computeWinnerStaysLineup(
			base({ teamSize: 1, players: [h1, a1, w1, w2], lastMatchHome: ["h1"], lastMatchAway: ["a1"] })
		);
		expect(result.rotatedOut).toEqual(["h1"]);
	});

	it("player with lowest queuePosition is selected even with high consecutiveGames", () => {
		const h1 = makePlayer("h1", { queuePosition: 0, consecutiveGames: 5 });
		const a1 = makePlayer("a1", { queuePosition: 1, consecutiveGames: 1 });
		const w1 = waiter("w1", 2, 0);
		const result = computeWinnerStaysLineup(
			base({ teamSize: 1, players: [h1, a1, w1], lastMatchHome: ["h1"], lastMatchAway: ["a1"] })
		);
		expect(result.rotatedOut).toHaveLength(0);
		expect(allPlayerIds(result)).toContain("h1");
	});

	it("winnersTakePriority setting does NOT affect selection order", () => {
		const h1 = makePlayer("h1", { queuePosition: 3, consecutiveGames: 1 });
		const a1 = makePlayer("a1", { queuePosition: 1, consecutiveGames: 1 });
		const w1 = waiter("w1", 0, 0);
		const w2 = waiter("w2", 2, 0);
		const result = computeWinnerStaysLineup(
			base({
				teamSize: 1,
				settings: {
					mode: "winner-stays",
					maxConsecutiveGames: null,
					winnersTakePriority: true,
					autoRandomize: false,
					randomizerType: "fisher-yates",
					autoCoinToss: false,
					alwaysSplitConstraints: [],
				},
				players: [h1, a1, w1, w2],
				lastMatchHome: ["h1"],
				lastMatchAway: ["a1"],
			})
		);
		expect(result.rotatedOut).toEqual(["h1"]);
	});
});

describe("autoRandomize", () => {
	it("all selected players are assigned to teams", () => {
		const h1 = makePlayer("h1", { queuePosition: 0 });
		const a1 = makePlayer("a1", { queuePosition: 1 });
		const w1 = waiter("w1", 2);
		const w2 = waiter("w2", 3);
		const result = computeWinnerStaysLineup(
			base({
				teamSize: 2,
				settings: {
					mode: "winner-stays",
					maxConsecutiveGames: null,
					winnersTakePriority: false,
					autoRandomize: true,
					randomizerType: "fisher-yates",
					autoCoinToss: false,
					alwaysSplitConstraints: [],
				},
				players: [h1, a1, w1, w2],
				lastMatchHome: ["h1"],
				lastMatchAway: ["a1"],
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
		const result = computeWinnerStaysLineup(
			base({
				teamSize: 2,
				settings: {
					mode: "winner-stays",
					maxConsecutiveGames: null,
					winnersTakePriority: false,
					autoRandomize: false,
					randomizerType: "fisher-yates",
					autoCoinToss: false,
					alwaysSplitConstraints: [["sp-h1", "sp-h2"]],
				},
				players: [h1, h2, a1, a2],
				lastMatchHome: ["h1", "h2"],
				lastMatchAway: ["a1", "a2"],
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
		const result = computeWinnerStaysLineup(
			base({
				teamSize: 1,
				players: [h1, a1, out1, w1],
				lastMatchHome: ["h1"],
				lastMatchAway: ["a1"],
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
		const result = computeWinnerStaysLineup(
			base({
				teamSize: 2,
				players: [h1, h2, a1, a2],
				lastMatchResult: "draw",
				lastMatchHome: ["h1", "h2"],
				lastMatchAway: ["a1", "a2"],
			})
		);
		expect(result.coinTossNeeded?.conflictType).toBe("draw-tiebreak");
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

	const countAdjacencies = (shuffled: string[], x: string, y: string): number => {
		const ix = shuffled.indexOf(x);
		const iy = shuffled.indexOf(y);
		return Math.abs(ix - iy) === 1 ? 1 : 0;
	};

	it("places frequent co-players adjacent far less often than random", () => {
		const items = ["a", "b", "c", "d"];
		const pairWeights = new Map<string, number>();
		pairWeights.set("a|b", 1000);

		const iterations = 1000;
		let adjacencyCount = 0;
		for (let i = 0; i < iterations; i++) {
			const shuffled = diversityShuffle([...items], pairWeights);
			adjacencyCount += countAdjacencies(shuffled, "a", "b");
		}

		const adjacencyRate = adjacencyCount / iterations;
		// Random baseline for 4 items: 50% adjacency. Correct diversity keeps
		// it well below that (theoretical floor ~16.67% — when c,d happen to
		// be placed first, a,b inevitably end up adjacent at positions 2,3).
		expect(adjacencyRate).toBeLessThan(0.25);
	});

	it("makes frequent pairs less adjacent than infrequent pairs", () => {
		const items = ["a", "b", "c", "d"];
		const pairWeights = new Map<string, number>();
		pairWeights.set("a|b", 1000);

		const iterations = 1000;
		let frequentAdjacency = 0;
		let infrequentAdjacency = 0;
		for (let i = 0; i < iterations; i++) {
			const shuffled = diversityShuffle([...items], pairWeights);
			frequentAdjacency += countAdjacencies(shuffled, "a", "b");
			infrequentAdjacency += countAdjacencies(shuffled, "c", "d");
		}

		expect(frequentAdjacency).toBeLessThan(infrequentAdjacency);
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
