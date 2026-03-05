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

function base(overrides: Partial<RotationInput> = {}): RotationInput {
	return {
		mode: "winner-stays",
		teamSize: 2,
		maxConsecutiveGames: null,
		alwaysSplitConstraints: [],
		players: [],
		lastResult: "home",
		homePlayerIds: [],
		awayPlayerIds: [],
		...overrides,
	};
}

describe("computeNextLineup – winner-stays", () => {
	describe("5-player 2v2 (1 waiter)", () => {
		it("1 waiter displaces 1 loser; other loser stays on opposing team with waiter", () => {
			// Home wins. Away loses.
			// Waiter = w1. Should displace 1 loser. Other loser plays with waiter.
			const h1 = makePlayer("h1", { consecutiveGames: 2, gamesPlayedThisSession: 2 });
			const h2 = makePlayer("h2", { consecutiveGames: 2, gamesPlayedThisSession: 2 });
			const a1 = makePlayer("a1", { consecutiveGames: 2, gamesPlayedThisSession: 2 });
			const a2 = makePlayer("a2", { consecutiveGames: 1, gamesPlayedThisSession: 1 });
			const w1 = makePlayer("w1", {
				status: "waiting",
				queuePosition: 1,
				consecutiveGames: 0,
				gamesPlayedThisSession: 0,
			});

			const result = computeNextLineup(
				base({
					teamSize: 2,
					players: [h1, h2, a1, a2, w1],
					lastResult: "home",
					homePlayerIds: ["h1", "h2"],
					awayPlayerIds: ["a1", "a2"],
				})
			);

			expect(result.coinTossNeeded).toBeNull();
			// 1 loser displaced: a1 has more consecutive games → leaves
			expect(result.rotatedOut).toEqual(["a1"]);
			// winners stay on home
			expect(result.homePlayerIds).toContain("h1");
			expect(result.homePlayerIds).toContain("h2");
			// opposing = waiter + surviving loser
			expect(result.awayPlayerIds).toContain("w1");
			expect(result.awayPlayerIds).toContain("a2");
		});

		it("when both losers have equal stats, triggers coin toss for 1 displaced", () => {
			const h1 = makePlayer("h1");
			const h2 = makePlayer("h2");
			const a1 = makePlayer("a1", { consecutiveGames: 2, gamesPlayedThisSession: 2 });
			const a2 = makePlayer("a2", { consecutiveGames: 2, gamesPlayedThisSession: 2 });
			const w1 = makePlayer("w1", {
				status: "waiting",
				queuePosition: 1,
				consecutiveGames: 0,
				gamesPlayedThisSession: 0,
			});

			const result = computeNextLineup(
				base({
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
		});
	});

	describe("5-player 2v2 (1 waiter) – post-mutation snapshot + coin toss resolution", () => {
		// Simulates resolveCoinToss path: all players are status="waiting" after recordMatchResult
		// h1, h2 won (consecutiveGames incremented), a1, a2 lost (consecutiveGames reset to 0), w1 waiting
		// Both losers have equal stats → coin toss triggered. Now resolving it with a1 staying in.

		const makePostMutation = () => {
			const h1 = makePlayer("h1", {
				status: "waiting",
				queuePosition: 0,
				consecutiveGames: 2,
				gamesPlayedThisSession: 2,
			});
			const h2 = makePlayer("h2", {
				status: "waiting",
				queuePosition: 1,
				consecutiveGames: 2,
				gamesPlayedThisSession: 2,
			});
			const a1 = makePlayer("a1", {
				status: "waiting",
				queuePosition: 2,
				consecutiveGames: 0,
				gamesPlayedThisSession: 2,
			});
			const a2 = makePlayer("a2", {
				status: "waiting",
				queuePosition: 3,
				consecutiveGames: 0,
				gamesPlayedThisSession: 2,
			});
			const w1 = makePlayer("w1", {
				status: "waiting",
				queuePosition: 4,
				consecutiveGames: 0,
				gamesPlayedThisSession: 0,
			});
			return { h1, h2, a1, a2, w1 };
		};

		it("without resolution: coin toss triggered for tied losers", () => {
			const { h1, h2, a1, a2, w1 } = makePostMutation();
			const result = computeNextLineup(
				base({
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
		});

		it("after coin toss resolved (a1 wins = stays), correct 2v2 lineup with right team sizes", () => {
			const { h1, h2, a1, a2, w1 } = makePostMutation();
			const result = computeNextLineup(
				base({
					players: [h1, h2, a1, a2, w1],
					lastResult: "home",
					homePlayerIds: ["h1", "h2"],
					awayPlayerIds: ["a1", "a2"],
					resolvedCoinTossWinnerIds: ["a1"],
				})
			);
			expect(result.coinTossNeeded).toBeNull();
			// a2 is displaced (coin toss loser), w1 comes in
			expect(result.rotatedOut).toContain("a2");
			expect(result.rotatedOut).toHaveLength(1);
			// winners stay on home
			expect(result.homePlayerIds).toContain("h1");
			expect(result.homePlayerIds).toContain("h2");
			expect(result.homePlayerIds).toHaveLength(2);
			// away = w1 (waiter) + a1 (surviving loser)
			expect(result.awayPlayerIds).toContain("w1");
			expect(result.awayPlayerIds).toContain("a1");
			expect(result.awayPlayerIds).toHaveLength(2);
		});
	});

	describe("5-player 2v2 first game – all equal stats (reported bug)", () => {
		it("coin toss candidates only include losers, not all 4 players", () => {
			const h1 = makePlayer("h1");
			const h2 = makePlayer("h2");
			const a1 = makePlayer("a1");
			const a2 = makePlayer("a2");
			const w1 = makePlayer("w1", {
				status: "waiting",
				queuePosition: 1,
				consecutiveGames: 0,
				gamesPlayedThisSession: 0,
			});

			const result = computeNextLineup(
				base({
					maxConsecutiveGames: 3,
					players: [h1, h2, a1, a2, w1],
					lastResult: "away",
					homePlayerIds: ["h1", "h2"],
					awayPlayerIds: ["a1", "a2"],
				})
			);

			expect(result.coinTossNeeded).not.toBeNull();
			expect(result.coinTossNeeded?.conflictType).toBe("loser-rotation");
			// Only home losers should be candidates, NOT all 4 players
			expect(result.coinTossNeeded?.candidates).toEqual(expect.arrayContaining(["h1", "h2"]));
			expect(result.coinTossNeeded?.candidates).toHaveLength(2);
		});

		it("after coin toss resolved, produces correct 2v2 lineup", () => {
			const h1 = makePlayer("h1");
			const h2 = makePlayer("h2");
			const a1 = makePlayer("a1");
			const a2 = makePlayer("a2");
			const w1 = makePlayer("w1", {
				status: "waiting",
				queuePosition: 1,
				consecutiveGames: 0,
				gamesPlayedThisSession: 0,
			});

			const result = computeNextLineup(
				base({
					maxConsecutiveGames: 3,
					players: [h1, h2, a1, a2, w1],
					lastResult: "away",
					homePlayerIds: ["h1", "h2"],
					awayPlayerIds: ["a1", "a2"],
					resolvedCoinTossWinnerIds: ["h2"],
				})
			);

			expect(result.coinTossNeeded).toBeNull();
			expect(result.rotatedOut).toEqual(["h1"]);
			// Away winners stay on away side
			expect(result.awayPlayerIds).toContain("a1");
			expect(result.awayPlayerIds).toContain("a2");
			expect(result.awayPlayerIds).toHaveLength(2);
			// Home = waiter + surviving loser
			expect(result.homePlayerIds).toContain("w1");
			expect(result.homePlayerIds).toContain("h2");
			expect(result.homePlayerIds).toHaveLength(2);
		});
	});

	describe("4-player 2v2 (0 waiters)", () => {
		it("0 waiters → nobody displaced, losers join winners on opposing side", () => {
			const h1 = makePlayer("h1");
			const h2 = makePlayer("h2");
			const a1 = makePlayer("a1");
			const a2 = makePlayer("a2");

			const result = computeNextLineup(
				base({
					players: [h1, h2, a1, a2],
					lastResult: "home",
					homePlayerIds: ["h1", "h2"],
					awayPlayerIds: ["a1", "a2"],
				})
			);

			expect(result.coinTossNeeded).toBeNull();
			expect(result.rotatedOut).toHaveLength(0);
			// winners stay on home side
			expect(result.homePlayerIds).toContain("h1");
			expect(result.homePlayerIds).toContain("h2");
			// losers stay on away side (no waiters to displace them)
			expect(result.awayPlayerIds).toContain("a1");
			expect(result.awayPlayerIds).toContain("a2");
		});
	});

	describe("6-player 2v2 (2 waiters)", () => {
		it("2 waiters displace both losers entirely", () => {
			const h1 = makePlayer("h1");
			const h2 = makePlayer("h2");
			const a1 = makePlayer("a1");
			const a2 = makePlayer("a2");
			const w1 = makePlayer("w1", {
				status: "waiting",
				queuePosition: 1,
				consecutiveGames: 0,
				gamesPlayedThisSession: 0,
			});
			const w2 = makePlayer("w2", {
				status: "waiting",
				queuePosition: 2,
				consecutiveGames: 0,
				gamesPlayedThisSession: 0,
			});

			const result = computeNextLineup(
				base({
					players: [h1, h2, a1, a2, w1, w2],
					lastResult: "home",
					homePlayerIds: ["h1", "h2"],
					awayPlayerIds: ["a1", "a2"],
				})
			);

			expect(result.coinTossNeeded).toBeNull();
			expect(result.rotatedOut).toContain("a1");
			expect(result.rotatedOut).toContain("a2");
			expect(result.rotatedOut).toHaveLength(2);
			// winners stay, waiters form opposing team
			expect(result.homePlayerIds).toContain("h1");
			expect(result.homePlayerIds).toContain("h2");
			expect(result.awayPlayerIds).toContain("w1");
			expect(result.awayPlayerIds).toContain("w2");
		});
	});

	describe("7-player 2v2 (3 waiters)", () => {
		it("3 waiters displace both losers and 1 winner (most consecutive)", () => {
			const h1 = makePlayer("h1", { consecutiveGames: 3, gamesPlayedThisSession: 3 });
			const h2 = makePlayer("h2", { consecutiveGames: 1, gamesPlayedThisSession: 1 });
			const a1 = makePlayer("a1");
			const a2 = makePlayer("a2");
			const w1 = makePlayer("w1", {
				status: "waiting",
				queuePosition: 1,
				consecutiveGames: 0,
				gamesPlayedThisSession: 0,
			});
			const w2 = makePlayer("w2", {
				status: "waiting",
				queuePosition: 2,
				consecutiveGames: 0,
				gamesPlayedThisSession: 0,
			});
			const w3 = makePlayer("w3", {
				status: "waiting",
				queuePosition: 3,
				consecutiveGames: 0,
				gamesPlayedThisSession: 0,
			});

			const result = computeNextLineup(
				base({
					players: [h1, h2, a1, a2, w1, w2, w3],
					lastResult: "home",
					homePlayerIds: ["h1", "h2"],
					awayPlayerIds: ["a1", "a2"],
				})
			);

			expect(result.coinTossNeeded).toBeNull();
			// Both losers displaced + h1 (most consecutive winner)
			expect(result.rotatedOut).toContain("a1");
			expect(result.rotatedOut).toContain("a2");
			expect(result.rotatedOut).toContain("h1");
			expect(result.rotatedOut).toHaveLength(3);
			// h2 survives on home side
			expect(result.homePlayerIds).toContain("h2");
		});
	});

	describe("maxConsecutiveGames", () => {
		it("winner over the limit is displaced first among winners", () => {
			const h1 = makePlayer("h1", { consecutiveGames: 3, gamesPlayedThisSession: 3 });
			const h2 = makePlayer("h2", { consecutiveGames: 1, gamesPlayedThisSession: 1 });
			const a1 = makePlayer("a1");
			const a2 = makePlayer("a2");
			const w1 = makePlayer("w1", {
				status: "waiting",
				queuePosition: 1,
				consecutiveGames: 0,
				gamesPlayedThisSession: 0,
			});
			const w2 = makePlayer("w2", {
				status: "waiting",
				queuePosition: 2,
				consecutiveGames: 0,
				gamesPlayedThisSession: 0,
			});
			const w3 = makePlayer("w3", {
				status: "waiting",
				queuePosition: 3,
				consecutiveGames: 0,
				gamesPlayedThisSession: 0,
			});

			const result = computeNextLineup(
				base({
					maxConsecutiveGames: 3,
					players: [h1, h2, a1, a2, w1, w2, w3],
					lastResult: "home",
					homePlayerIds: ["h1", "h2"],
					awayPlayerIds: ["a1", "a2"],
				})
			);

			expect(result.coinTossNeeded).toBeNull();
			expect(result.rotatedOut).toContain("h1");
		});

		it("forced winner displaced before losers when 1 waiter (5-player 2v2)", () => {
			// h1 exceeded maxConsecutiveGames. With 1 waiter, the forced winner should
			// be displaced instead of a loser.
			const h1 = makePlayer("h1", { consecutiveGames: 3, gamesPlayedThisSession: 3 });
			const h2 = makePlayer("h2", { consecutiveGames: 1, gamesPlayedThisSession: 1 });
			const a1 = makePlayer("a1", { consecutiveGames: 0, gamesPlayedThisSession: 2 });
			const a2 = makePlayer("a2", { consecutiveGames: 0, gamesPlayedThisSession: 1 });
			const w1 = makePlayer("w1", {
				status: "waiting",
				queuePosition: 1,
				consecutiveGames: 0,
				gamesPlayedThisSession: 0,
			});

			const result = computeNextLineup(
				base({
					maxConsecutiveGames: 3,
					players: [h1, h2, a1, a2, w1],
					lastResult: "home",
					homePlayerIds: ["h1", "h2"],
					awayPlayerIds: ["a1", "a2"],
				})
			);

			expect(result.coinTossNeeded).toBeNull();
			// forced winner h1 should be displaced, not a loser
			expect(result.rotatedOut).toEqual(["h1"]);
			// h2 survives on winner side, needs a loser promoted to fill h1's spot
			expect(result.homePlayerIds).toHaveLength(2);
			expect(result.homePlayerIds).toContain("h2");
			// opposing team = waiter + remaining loser
			expect(result.awayPlayerIds).toHaveLength(2);
			expect(result.awayPlayerIds).toContain("w1");
		});

		it("N=0 waiters: forced winner stays (best-effort enforcement)", () => {
			// 4 players, 0 waiters, h1 over the limit. Nobody can be displaced.
			const h1 = makePlayer("h1", { consecutiveGames: 3, gamesPlayedThisSession: 3 });
			const h2 = makePlayer("h2", { consecutiveGames: 1, gamesPlayedThisSession: 1 });
			const a1 = makePlayer("a1", { consecutiveGames: 0, gamesPlayedThisSession: 2 });
			const a2 = makePlayer("a2", { consecutiveGames: 0, gamesPlayedThisSession: 1 });

			const result = computeNextLineup(
				base({
					maxConsecutiveGames: 3,
					players: [h1, h2, a1, a2],
					lastResult: "home",
					homePlayerIds: ["h1", "h2"],
					awayPlayerIds: ["a1", "a2"],
				})
			);

			expect(result.coinTossNeeded).toBeNull();
			expect(result.rotatedOut).toHaveLength(0);
			// all 4 players must play, teams stay as-is
			expect(result.homePlayerIds).toHaveLength(2);
			expect(result.awayPlayerIds).toHaveLength(2);
		});

		it("2 waiters + 1 forced winner: forced winner displaced first, then 1 loser", () => {
			// 6 players, 2 waiters. Displacement order: forced h1, then losers.
			// With N=2, h1 (forced) + a1 (loser with more games) displaced.
			const h1 = makePlayer("h1", { consecutiveGames: 3, gamesPlayedThisSession: 3 });
			const h2 = makePlayer("h2", { consecutiveGames: 1, gamesPlayedThisSession: 1 });
			const a1 = makePlayer("a1", { consecutiveGames: 0, gamesPlayedThisSession: 2 });
			const a2 = makePlayer("a2", { consecutiveGames: 0, gamesPlayedThisSession: 1 });
			const w1 = makePlayer("w1", {
				status: "waiting",
				queuePosition: 1,
				consecutiveGames: 0,
				gamesPlayedThisSession: 0,
			});
			const w2 = makePlayer("w2", {
				status: "waiting",
				queuePosition: 2,
				consecutiveGames: 0,
				gamesPlayedThisSession: 0,
			});

			const result = computeNextLineup(
				base({
					maxConsecutiveGames: 3,
					players: [h1, h2, a1, a2, w1, w2],
					lastResult: "home",
					homePlayerIds: ["h1", "h2"],
					awayPlayerIds: ["a1", "a2"],
				})
			);

			expect(result.coinTossNeeded).toBeNull();
			// forced winner h1 + loser a1 (most gamesPlayed) displaced
			expect(result.rotatedOut).toContain("h1");
			expect(result.rotatedOut).toContain("a1");
			expect(result.rotatedOut).toHaveLength(2);
			// h2 stays on winner side with a2 promoted from opposing pool
			expect(result.homePlayerIds).toHaveLength(2);
			expect(result.homePlayerIds).toContain("h2");
			// opposing = waiters
			expect(result.awayPlayerIds).toHaveLength(2);
			expect(result.awayPlayerIds).toContain("w1");
			expect(result.awayPlayerIds).toContain("w2");
		});
	});

	describe("draw tiebreak", () => {
		it("returns draw-tiebreak coin toss when consecutive sums are equal", () => {
			const h1 = makePlayer("h1", { consecutiveGames: 1 });
			const h2 = makePlayer("h2", { consecutiveGames: 1 });
			const a1 = makePlayer("a1", { consecutiveGames: 1 });
			const a2 = makePlayer("a2", { consecutiveGames: 1 });

			const result = computeNextLineup(
				base({
					players: [h1, h2, a1, a2],
					lastResult: "draw",
					homePlayerIds: ["h1", "h2"],
					awayPlayerIds: ["a1", "a2"],
				})
			);

			expect(result.coinTossNeeded?.conflictType).toBe("draw-tiebreak");
		});
	});

	describe("manual mode", () => {
		it("returns empty lineup", () => {
			const result = computeNextLineup(base({ mode: "manual" }));
			expect(result.homePlayerIds).toHaveLength(0);
			expect(result.awayPlayerIds).toHaveLength(0);
			expect(result.coinTossNeeded).toBeNull();
		});
	});

	describe("alwaysSplitConstraints", () => {
		it("swaps constrained players to opposite teams while preserving team sizes", () => {
			const h1 = makePlayer("h1");
			const h2 = makePlayer("h2");
			const a1 = makePlayer("a1");
			const a2 = makePlayer("a2");

			const result = computeNextLineup(
				base({
					players: [h1, h2, a1, a2],
					lastResult: "home",
					homePlayerIds: ["h1", "h2"],
					awayPlayerIds: ["a1", "a2"],
					alwaysSplitConstraints: [["sp-h1", "sp-h2"]],
				})
			);

			expect(result.homePlayerIds).toHaveLength(2);
			expect(result.awayPlayerIds).toHaveLength(2);
			const h1Home = result.homePlayerIds.includes("h1");
			const h2Home = result.homePlayerIds.includes("h2");
			expect(h1Home).not.toBe(h2Home);
		});

		it("does nothing when constrained players are already on opposite teams", () => {
			const h1 = makePlayer("h1");
			const h2 = makePlayer("h2");
			const a1 = makePlayer("a1");
			const a2 = makePlayer("a2");

			const result = computeNextLineup(
				base({
					players: [h1, h2, a1, a2],
					lastResult: "home",
					homePlayerIds: ["h1", "h2"],
					awayPlayerIds: ["a1", "a2"],
					alwaysSplitConstraints: [["sp-h1", "sp-a1"]],
				})
			);

			expect(result.homePlayerIds).toContain("h1");
			expect(result.homePlayerIds).toContain("h2");
			expect(result.awayPlayerIds).toContain("a1");
			expect(result.awayPlayerIds).toContain("a2");
		});

		it("skips constraint when one player is not in the game (rotated out)", () => {
			const h1 = makePlayer("h1", { consecutiveGames: 2, gamesPlayedThisSession: 2 });
			const h2 = makePlayer("h2", { consecutiveGames: 2, gamesPlayedThisSession: 2 });
			const a1 = makePlayer("a1", { consecutiveGames: 2, gamesPlayedThisSession: 2 });
			const a2 = makePlayer("a2", { consecutiveGames: 1, gamesPlayedThisSession: 1 });
			const w1 = makePlayer("w1", {
				status: "waiting",
				queuePosition: 1,
				consecutiveGames: 0,
				gamesPlayedThisSession: 0,
			});

			// Constraint between h1 (playing/winner) and w1 (waiting → will come in as opposing).
			// After rotation: h1, h2 on home (winners), w1 + a2 on away.
			// Constraint [h1, w1]: h1 is home, w1 is away → already split, no swap needed.
			const result = computeNextLineup(
				base({
					players: [h1, h2, a1, a2, w1],
					lastResult: "home",
					homePlayerIds: ["h1", "h2"],
					awayPlayerIds: ["a1", "a2"],
					alwaysSplitConstraints: [["sp-h1", "sp-w1"]],
				})
			);

			expect(result.homePlayerIds).toHaveLength(2);
			expect(result.awayPlayerIds).toHaveLength(2);
			expect(result.homePlayerIds).toContain("h1");
			expect(result.awayPlayerIds).toContain("w1");
		});

		it("swap does not introduce a new constraint violation", () => {
			const h1 = makePlayer("h1", { queuePosition: 1 });
			const h2 = makePlayer("h2", { queuePosition: 2 });
			const a1 = makePlayer("a1", { queuePosition: 3 });
			const a2 = makePlayer("a2", { queuePosition: 4 });

			const result = computeNextLineup(
				base({
					players: [h1, h2, a1, a2],
					lastResult: "home",
					homePlayerIds: ["h1", "h2"],
					awayPlayerIds: ["a1", "a2"],
					alwaysSplitConstraints: [
						["sp-h1", "sp-h2"],
						["sp-h1", "sp-a1"],
					],
				})
			);

			expect(result.homePlayerIds).toHaveLength(2);
			expect(result.awayPlayerIds).toHaveLength(2);
			const h1Team = result.homePlayerIds.includes("h1") ? "home" : "away";
			const h2Team = result.homePlayerIds.includes("h2") ? "home" : "away";
			const a1Team = result.homePlayerIds.includes("a1") ? "home" : "away";
			expect(h1Team).not.toBe(h2Team);
			expect(h1Team).not.toBe(a1Team);
		});

		it("works correctly with 5-player rotation (1 waiter)", () => {
			const h1 = makePlayer("h1", { consecutiveGames: 2, gamesPlayedThisSession: 2 });
			const h2 = makePlayer("h2", { consecutiveGames: 2, gamesPlayedThisSession: 2 });
			const a1 = makePlayer("a1", { consecutiveGames: 2, gamesPlayedThisSession: 2 });
			const a2 = makePlayer("a2", { consecutiveGames: 1, gamesPlayedThisSession: 1 });
			const w1 = makePlayer("w1", {
				status: "waiting",
				queuePosition: 1,
				consecutiveGames: 0,
				gamesPlayedThisSession: 0,
			});

			const result = computeNextLineup(
				base({
					players: [h1, h2, a1, a2, w1],
					lastResult: "home",
					homePlayerIds: ["h1", "h2"],
					awayPlayerIds: ["a1", "a2"],
					alwaysSplitConstraints: [["sp-h1", "sp-h2"]],
				})
			);

			expect(result.homePlayerIds).toHaveLength(2);
			expect(result.awayPlayerIds).toHaveLength(2);
			const h1Home = result.homePlayerIds.includes("h1");
			const h2Home = result.homePlayerIds.includes("h2");
			if (result.homePlayerIds.includes("h1") || result.awayPlayerIds.includes("h1")) {
				if (result.homePlayerIds.includes("h2") || result.awayPlayerIds.includes("h2")) {
					expect(h1Home).not.toBe(h2Home);
				}
			}
		});
	});
});

describe("computeNextLineup – round-robin", () => {
	it("rotates all playing players out, takes from queue in order", () => {
		const p1 = makePlayer("p1", { status: "playing", queuePosition: 0 });
		const p2 = makePlayer("p2", { status: "playing", queuePosition: 1 });
		const p3 = makePlayer("p3", { status: "playing", queuePosition: 2 });
		const p4 = makePlayer("p4", { status: "playing", queuePosition: 3 });
		const w1 = makePlayer("w1", { status: "waiting", queuePosition: 4, consecutiveGames: 0 });
		const w2 = makePlayer("w2", { status: "waiting", queuePosition: 5, consecutiveGames: 0 });
		const w3 = makePlayer("w3", { status: "waiting", queuePosition: 6, consecutiveGames: 0 });
		const w4 = makePlayer("w4", { status: "waiting", queuePosition: 7, consecutiveGames: 0 });

		const result = computeNextLineup(
			base({
				mode: "round-robin",
				teamSize: 2,
				players: [p1, p2, p3, p4, w1, w2, w3, w4],
				lastResult: "home",
				homePlayerIds: ["p1", "p2"],
				awayPlayerIds: ["p3", "p4"],
			})
		);

		expect(result.rotatedOut).toEqual(["p1", "p2", "p3", "p4"]);
		expect(result.homePlayerIds).toEqual(["w1", "w2"]);
		expect(result.awayPlayerIds).toEqual(["w3", "w4"]);
		expect(result.coinTossNeeded).toBeNull();
	});

	it("re-queues playing players in ascending queuePosition order", () => {
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

		// w1 and w2 play next, p1 and p2 go to back of queue
		expect(result.homePlayerIds).toEqual(["w1"]);
		expect(result.awayPlayerIds).toEqual(["w2"]);
	});

	it("4 players 2v2 (no waiters) — all rotate through in round-robin order", () => {
		const p1 = makePlayer("p1", { status: "playing", queuePosition: 0 });
		const p2 = makePlayer("p2", { status: "playing", queuePosition: 1 });
		const p3 = makePlayer("p3", { status: "playing", queuePosition: 2 });
		const p4 = makePlayer("p4", { status: "playing", queuePosition: 3 });

		const result = computeNextLineup(
			base({
				mode: "round-robin",
				teamSize: 2,
				players: [p1, p2, p3, p4],
				lastResult: "home",
				homePlayerIds: ["p1", "p2"],
				awayPlayerIds: ["p3", "p4"],
			})
		);

		// All playing, so they re-queue and same 4 come back
		expect(result.rotatedOut).toEqual(["p1", "p2", "p3", "p4"]);
		expect(result.homePlayerIds).toHaveLength(2);
		expect(result.awayPlayerIds).toHaveLength(2);
		// p1 and p2 go to positions 4,5 in queue; they appear first via ascending sort
		expect(result.homePlayerIds).toContain("p1");
		expect(result.homePlayerIds).toContain("p2");
	});

	it("never triggers coin toss", () => {
		const p1 = makePlayer("p1", { status: "playing", queuePosition: 0 });
		const p2 = makePlayer("p2", { status: "playing", queuePosition: 1 });

		const result = computeNextLineup(
			base({
				mode: "round-robin",
				teamSize: 1,
				players: [p1, p2],
				lastResult: "draw",
				homePlayerIds: ["p1"],
				awayPlayerIds: ["p2"],
			})
		);

		expect(result.coinTossNeeded).toBeNull();
	});
});

describe("computeNextLineup – draw with waiters (winner-stays)", () => {
	it("draw with unequal consecutive sums → higher sum team is 'loser', waiter displaces one", () => {
		const h1 = makePlayer("h1", { consecutiveGames: 4, gamesPlayedThisSession: 4 });
		const h2 = makePlayer("h2", { consecutiveGames: 2, gamesPlayedThisSession: 2 });
		const a1 = makePlayer("a1", { consecutiveGames: 1, gamesPlayedThisSession: 1 });
		const a2 = makePlayer("a2", { consecutiveGames: 1, gamesPlayedThisSession: 1 });
		const w1 = makePlayer("w1", {
			status: "waiting",
			queuePosition: 1,
			consecutiveGames: 0,
			gamesPlayedThisSession: 0,
		});

		const result = computeNextLineup(
			base({
				teamSize: 2,
				players: [h1, h2, a1, a2, w1],
				lastResult: "draw",
				homePlayerIds: ["h1", "h2"],
				awayPlayerIds: ["a1", "a2"],
			})
		);

		expect(result.coinTossNeeded).toBeNull();
		// home has higher consecutive sum → they become "losers"
		expect(result.rotatedOut).toHaveLength(1);
		expect(["h1", "h2"]).toContain(result.rotatedOut[0]);
	});

	it("draw with equal sums and waiters → coin toss for draw-tiebreak", () => {
		const h1 = makePlayer("h1", { consecutiveGames: 2, gamesPlayedThisSession: 2 });
		const h2 = makePlayer("h2", { consecutiveGames: 1, gamesPlayedThisSession: 1 });
		const a1 = makePlayer("a1", { consecutiveGames: 2, gamesPlayedThisSession: 2 });
		const a2 = makePlayer("a2", { consecutiveGames: 1, gamesPlayedThisSession: 1 });
		const w1 = makePlayer("w1", {
			status: "waiting",
			queuePosition: 1,
			consecutiveGames: 0,
			gamesPlayedThisSession: 0,
		});

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
		// candidates should be all playing IDs
		expect(result.coinTossNeeded?.candidates).toHaveLength(4);
	});

	it("draw coin toss resolved with home team winning → away treated as losers", () => {
		const h1 = makePlayer("h1", { consecutiveGames: 1, gamesPlayedThisSession: 1 });
		const h2 = makePlayer("h2", { consecutiveGames: 1, gamesPlayedThisSession: 1 });
		const a1 = makePlayer("a1", { consecutiveGames: 1, gamesPlayedThisSession: 1 });
		const a2 = makePlayer("a2", { consecutiveGames: 1, gamesPlayedThisSession: 1 });
		const w1 = makePlayer("w1", {
			status: "waiting",
			queuePosition: 1,
			consecutiveGames: 0,
			gamesPlayedThisSession: 0,
		});

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
		// home wins coin toss → away are losers → 1 away player displaced
		expect(result.rotatedOut).toHaveLength(1);
		expect(["a1", "a2"]).toContain(result.rotatedOut[0]);
		expect(result.homePlayerIds).toContain("h1");
		expect(result.homePlayerIds).toContain("h2");
		expect(result.awayPlayerIds).toContain("w1");
	});

	it("draw with 0 waiters and equal sums → still coin toss (no displacement possible)", () => {
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

		expect(result.coinTossNeeded?.conflictType).toBe("draw-tiebreak");
	});
});
