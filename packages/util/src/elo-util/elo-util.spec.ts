import { describe, expect, it } from "vitest";
import { calculate1vN, calculateElo, calculateEloMatch, determineMatchResult } from "./index.js";

describe("elo-util", () => {
	describe("calculateElo", () => {
		describe("equal-rated players", () => {
			it("should calculate correct ELO for home win", () => {
				const result = calculateElo({
					kFactor: 32,
					scoreType: "elo",
					homeScore: 3,
					awayScore: 1,
					homePlayers: [{ id: "p1", score: 1000 }],
					awayPlayers: [{ id: "p2", score: 1000 }],
				});

				expect(result.homeTeam.players[0].scoreAfter).toBe(1016);
				expect(result.awayTeam.players[0].scoreAfter).toBe(984);
				expect(result.homeTeam.winningOdds).toBeCloseTo(0.5);
				expect(result.awayTeam.winningOdds).toBeCloseTo(0.5);
			});

			it("should calculate correct ELO for away win", () => {
				const result = calculateElo({
					kFactor: 32,
					scoreType: "elo",
					homeScore: 1,
					awayScore: 3,
					homePlayers: [{ id: "p1", score: 1000 }],
					awayPlayers: [{ id: "p2", score: 1000 }],
				});

				expect(result.homeTeam.players[0].scoreAfter).toBe(984);
				expect(result.awayTeam.players[0].scoreAfter).toBe(1016);
			});

			it("should calculate correct ELO for draw", () => {
				const result = calculateElo({
					kFactor: 32,
					scoreType: "elo",
					homeScore: 2,
					awayScore: 2,
					homePlayers: [{ id: "p1", score: 1000 }],
					awayPlayers: [{ id: "p2", score: 1000 }],
				});

				expect(result.homeTeam.players[0].scoreAfter).toBe(1000);
				expect(result.awayTeam.players[0].scoreAfter).toBe(1000);
				expect(result.homeTeam.winningOdds).toBeCloseTo(0.5);
			});
		});

		describe("unequal-rated players", () => {
			it("should calculate higher expected score for higher-rated player", () => {
				const result = calculateElo({
					kFactor: 32,
					scoreType: "elo",
					homeScore: 3,
					awayScore: 1,
					homePlayers: [{ id: "p1", score: 1200 }],
					awayPlayers: [{ id: "p2", score: 1000 }],
				});

				expect(result.homeTeam.winningOdds).toBeGreaterThan(0.5);
				expect(result.awayTeam.winningOdds).toBeLessThan(0.5);
				expect(result.homeTeam.players[0].scoreAfter).toBeGreaterThan(1200);
				expect(result.awayTeam.players[0].scoreAfter).toBeLessThan(1000);
			});

			it("should penalize higher-rated player more for losing", () => {
				const result = calculateElo({
					kFactor: 32,
					scoreType: "elo",
					homeScore: 1,
					awayScore: 3,
					homePlayers: [{ id: "p1", score: 1200 }],
					awayPlayers: [{ id: "p2", score: 1000 }],
				});

				const homeRatingChange = result.homeTeam.players[0].scoreAfter - 1200;
				const awayRatingChange = result.awayTeam.players[0].scoreAfter - 1000;

				expect(homeRatingChange).toBeLessThan(0);
				expect(awayRatingChange).toBeGreaterThan(0);
				expect(Math.abs(homeRatingChange)).toBeGreaterThan(16);
				expect(awayRatingChange).toBeGreaterThan(16);
			});
		});

		describe("team matches", () => {
			it("should handle multi-player teams", () => {
				const result = calculateElo({
					kFactor: 32,
					scoreType: "elo",
					homeScore: 3,
					awayScore: 1,
					homePlayers: [
						{ id: "p1", score: 1000 },
						{ id: "p2", score: 1000 },
					],
					awayPlayers: [
						{ id: "p3", score: 1000 },
						{ id: "p4", score: 1000 },
					],
				});

				expect(result.homeTeam.players).toHaveLength(2);
				expect(result.awayTeam.players).toHaveLength(2);
				expect(result.homeTeam.players[0].scoreAfter).toBeGreaterThan(1000);
				expect(result.homeTeam.players[1].scoreAfter).toBeGreaterThan(1000);
				expect(result.awayTeam.players[0].scoreAfter).toBeLessThan(1000);
				expect(result.awayTeam.players[1].scoreAfter).toBeLessThan(1000);
			});

			it("should use average rating for team winning odds", () => {
				const result = calculateElo({
					kFactor: 32,
					scoreType: "elo",
					homeScore: 3,
					awayScore: 1,
					homePlayers: [
						{ id: "p1", score: 1100 },
						{ id: "p2", score: 900 },
					],
					awayPlayers: [
						{ id: "p3", score: 1000 },
						{ id: "p4", score: 1000 },
					],
				});

				expect(result.homeTeam.winningOdds).toBeCloseTo(0.5, 1);
				expect(result.awayTeam.winningOdds).toBeCloseTo(0.5, 1);
			});
		});

		describe("elo-individual-vs-team strategy", () => {
			it("should apply WEIGHTED_TEAMS strategy", () => {
				const result = calculateElo({
					kFactor: 32,
					scoreType: "elo-individual-vs-team",
					homeScore: 3,
					awayScore: 1,
					homePlayers: [{ id: "p1", score: 1000 }],
					awayPlayers: [{ id: "p2", score: 1000 }],
				});

				expect(result.homeTeam.players).toHaveLength(1);
				expect(result.awayTeam.players).toHaveLength(1);
				expect(result.homeTeam.players[0].scoreAfter).toBeGreaterThan(1000);
				expect(result.awayTeam.players[0].scoreAfter).toBeLessThan(1000);
			});

			it("should handle unequal team sizes with weighted strategy", () => {
				const result = calculateElo({
					kFactor: 32,
					scoreType: "elo-individual-vs-team",
					homeScore: 3,
					awayScore: 1,
					homePlayers: [{ id: "p1", score: 1000 }],
					awayPlayers: [
						{ id: "p2", score: 1000 },
						{ id: "p3", score: 1000 },
					],
				});

				expect(result.homeTeam.players).toHaveLength(1);
				expect(result.awayTeam.players).toHaveLength(2);
			});
		});

		describe("k-factor variations", () => {
			it("should apply larger rating changes with higher k-factor", () => {
				const lowK = calculateElo({
					kFactor: 16,
					scoreType: "elo",
					homeScore: 3,
					awayScore: 1,
					homePlayers: [{ id: "p1", score: 1000 }],
					awayPlayers: [{ id: "p2", score: 1000 }],
				});

				const highK = calculateElo({
					kFactor: 64,
					scoreType: "elo",
					homeScore: 3,
					awayScore: 1,
					homePlayers: [{ id: "p1", score: 1000 }],
					awayPlayers: [{ id: "p2", score: 1000 }],
				});

				const lowKChange = lowK.homeTeam.players[0].scoreAfter - 1000;
				const highKChange = highK.homeTeam.players[0].scoreAfter - 1000;

				expect(highKChange).toBeGreaterThan(lowKChange);
			});
		});
	});

	describe("calculateEloMatch", () => {
		it("should route to calculateElo for elo score type", () => {
			const result = calculateEloMatch({
				scoreType: "elo",
				kFactor: 32,
				homeScore: 3,
				awayScore: 1,
				homePlayers: [{ id: "p1", score: 1000 }],
				awayPlayers: [{ id: "p2", score: 1000 }],
			});

			expect(result.homeTeam.players[0].scoreAfter).toBe(1016);
		});

		it("should route to calculateElo for elo-individual-vs-team score type", () => {
			const result = calculateEloMatch({
				scoreType: "elo-individual-vs-team",
				kFactor: 32,
				homeScore: 3,
				awayScore: 1,
				homePlayers: [{ id: "p1", score: 1000 }],
				awayPlayers: [{ id: "p2", score: 1000 }],
			});

			expect(result.homeTeam.players).toHaveLength(1);
			expect(result.awayTeam.players).toHaveLength(1);
		});

		it("should handle 3-1-0 score type", () => {
			const result = calculateEloMatch({
				scoreType: "3-1-0",
				kFactor: 32,
				homeScore: 3,
				awayScore: 1,
				homePlayers: [{ id: "p1", score: 10 }],
				awayPlayers: [{ id: "p2", score: 10 }],
			});

			expect(result.homeTeam.players[0].scoreAfter).toBe(13);
			expect(result.awayTeam.players[0].scoreAfter).toBe(10);
			expect(result.homeTeam.winningOdds).toBe(0.5);
		});

		it("should handle 3-1-0 draw", () => {
			const result = calculateEloMatch({
				scoreType: "3-1-0",
				kFactor: 32,
				homeScore: 2,
				awayScore: 2,
				homePlayers: [{ id: "p1", score: 10 }],
				awayPlayers: [{ id: "p2", score: 10 }],
			});

			expect(result.homeTeam.players[0].scoreAfter).toBe(11);
			expect(result.awayTeam.players[0].scoreAfter).toBe(11);
		});

		it("should throw error for invalid score type", () => {
			expect(() =>
				calculateEloMatch({
					scoreType: "invalid" as any,
					kFactor: 32,
					homeScore: 3,
					awayScore: 1,
					homePlayers: [{ id: "p1", score: 1000 }],
					awayPlayers: [{ id: "p2", score: 1000 }],
				})
			).toThrow("Invalid score type: invalid");
		});
	});

	describe("determineMatchResult", () => {
		it("should return home win when home score is higher", () => {
			const result = determineMatchResult(3, 1);
			expect(result.homeResult).toBe("W");
			expect(result.awayResult).toBe("L");
		});

		it("should return away win when away score is higher", () => {
			const result = determineMatchResult(1, 3);
			expect(result.homeResult).toBe("L");
			expect(result.awayResult).toBe("W");
		});

		it("should return draw when scores are equal", () => {
			const result = determineMatchResult(2, 2);
			expect(result.homeResult).toBe("D");
			expect(result.awayResult).toBe("D");
		});
	});

	describe("calculate1vN", () => {
		it("n=2 matches standard 1v1 ELO", () => {
			const result = calculate1vN({
				kFactor: 32,
				winner: { id: "w", score: 1000 },
				losers: [{ id: "l1", score: 1000 }],
			});

			expect(result.winner.scoreAfter).toBe(1016);
			expect(result.losers[0].scoreAfter).toBe(984);
		});

		it("n=4 with equal ratings: winner gains k*(1/2) total, losers split", () => {
			const result = calculate1vN({
				kFactor: 32,
				winner: { id: "w", score: 1000 },
				losers: [
					{ id: "l1", score: 1000 },
					{ id: "l2", score: 1000 },
					{ id: "l3", score: 1000 },
				],
			});

			expect(result.winner.scoreAfter).toBe(1015);
			for (const loser of result.losers) {
				expect(loser.scoreAfter).toBe(995);
			}
		});

		it("rating changes sum to ~0 (zero-sum)", () => {
			const losers = [
				{ id: "l1", score: 1000 },
				{ id: "l2", score: 900 },
				{ id: "l3", score: 1000 },
				{ id: "l4", score: 800 },
			];
			const result = calculate1vN({
				kFactor: 32,
				winner: { id: "w", score: 1100 },
				losers,
			});

			const winnerDelta = result.winner.scoreAfter - 1100;
			const losersDelta = losers.reduce(
				(sum, l, i) => sum + (result.losers[i].scoreAfter - l.score),
				0
			);
			expect(winnerDelta + losersDelta).toBeCloseTo(0, 5);
		});

		it("higher-rated winner gains less than lower-rated winner", () => {
			const strong = calculate1vN({
				kFactor: 32,
				winner: { id: "w", score: 1500 },
				losers: [{ id: "l1", score: 1000 }],
			});
			const weak = calculate1vN({
				kFactor: 32,
				winner: { id: "w", score: 1000 },
				losers: [{ id: "l1", score: 1000 }],
			});

			expect(strong.winner.scoreAfter - 1500).toBeLessThan(weak.winner.scoreAfter - 1000);
			expect(strong.losers[0].scoreAfter - 1000).toBeGreaterThan(weak.losers[0].scoreAfter - 1000);
		});
	});
});
