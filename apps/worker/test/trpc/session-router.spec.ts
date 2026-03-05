import { describe, expect, it } from "vitest";
import { createAuthContext } from "../setup/auth-context-util";
import { createPlayers } from "../setup/season-context-util";
import { createTRPCTestClient } from "./trpc-test-client";

async function setupSeasonWithPlayers(count = 4) {
	const ctx = await createAuthContext();
	const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

	await createPlayers(ctx, count);
	const season = await client.season.create.mutate({
		name: "Session Test Season",
		initialScore: 1000,
		scoreType: "elo",
		kFactor: 32,
		startDate: new Date(),
	});

	const seasonPlayers = await client.seasonPlayer.getAll.query({ seasonSlug: season.slug });

	return { ctx, client, season, seasonPlayers };
}

describe("session router", () => {
	describe("create", () => {
		it("creates a session with players", async () => {
			const { client, season, seasonPlayers } = await setupSeasonWithPlayers(4);

			const session = await client.session.create.mutate({
				seasonSlug: season.slug,
				rotationMode: "winner-stays",
				teamSize: 1,
				maxConsecutiveGames: null,
				seasonPlayerIds: seasonPlayers.map((p) => p.id),
			});

			expect(session.id).toBeDefined();
			expect(session.status).toBe("active");
			expect(session.rotationMode).toBe("winner-stays");
			expect(session.teamSize).toBe(1);
		});

		it("rejects duplicate active session for same season", async () => {
			const { client, season, seasonPlayers } = await setupSeasonWithPlayers(4);

			await client.session.create.mutate({
				seasonSlug: season.slug,
				rotationMode: "winner-stays",
				teamSize: 1,
				maxConsecutiveGames: null,
				seasonPlayerIds: seasonPlayers.map((p) => p.id),
			});

			await expect(
				client.session.create.mutate({
					seasonSlug: season.slug,
					rotationMode: "round-robin",
					teamSize: 1,
					maxConsecutiveGames: null,
					seasonPlayerIds: seasonPlayers.map((p) => p.id),
				})
			).rejects.toThrow("active session");
		});
	});

	describe("getActive", () => {
		it("returns null when no active session", async () => {
			const { client, season } = await setupSeasonWithPlayers(2);
			const active = await client.session.getActive.query({ seasonSlug: season.slug });
			expect(active).toBeNull();
		});

		it("returns the active session", async () => {
			const { client, season, seasonPlayers } = await setupSeasonWithPlayers(4);

			const created = await client.session.create.mutate({
				seasonSlug: season.slug,
				rotationMode: "winner-stays",
				teamSize: 1,
				maxConsecutiveGames: null,
				seasonPlayerIds: seasonPlayers.map((p) => p.id),
			});

			const active = await client.session.getActive.query({ seasonSlug: season.slug });
			expect(active?.id).toBe(created.id);
		});
	});

	describe("getById", () => {
		it("returns full session with players and empty matches", async () => {
			const { client, season, seasonPlayers } = await setupSeasonWithPlayers(4);

			const created = await client.session.create.mutate({
				seasonSlug: season.slug,
				rotationMode: "winner-stays",
				teamSize: 1,
				maxConsecutiveGames: null,
				seasonPlayerIds: seasonPlayers.map((p) => p.id),
			});

			const session = await client.session.getById.query({ sessionId: created.id });

			expect(session.id).toBe(created.id);
			expect(session.players).toHaveLength(4);
			expect(session.matches).toHaveLength(0);
			expect(session.pendingCoinTosses).toHaveLength(0);

			const player = session.players[0];
			expect(player.id).toBeDefined();
			expect(player.displayName).toBeDefined();
			expect(player.score).toBeDefined();
			expect(player.status).toBe("waiting");
		});
	});

	describe("addPlayer", () => {
		it("adds a new player to an active session", async () => {
			const { client, season, seasonPlayers } = await setupSeasonWithPlayers(4);

			const session = await client.session.create.mutate({
				seasonSlug: season.slug,
				rotationMode: "winner-stays",
				teamSize: 1,
				maxConsecutiveGames: null,
				seasonPlayerIds: seasonPlayers.slice(0, 3).map((p) => p.id),
			});

			await client.session.addPlayer.mutate({
				sessionId: session.id,
				seasonPlayerId: seasonPlayers[3].id,
			});

			const updated = await client.session.getById.query({ sessionId: session.id });
			expect(updated.players).toHaveLength(4);
		});
	});

	describe("startNextMatch + recordResult", () => {
		it("starts a match and records a result", async () => {
			const { client, season, seasonPlayers } = await setupSeasonWithPlayers(4);

			const session = await client.session.create.mutate({
				seasonSlug: season.slug,
				rotationMode: "winner-stays",
				teamSize: 2,
				maxConsecutiveGames: null,
				seasonPlayerIds: seasonPlayers.map((p) => p.id),
			});

			await client.session.startNextMatch.mutate({
				sessionId: session.id,
				homeSeasonPlayerIds: [seasonPlayers[0].id, seasonPlayers[1].id],
				awaySeasonPlayerIds: [seasonPlayers[2].id, seasonPlayers[3].id],
			});

			const withMatch = await client.session.getById.query({ sessionId: session.id });
			const currentMatch = withMatch.matches.find((m) => m.result === null);
			expect(currentMatch).toBeDefined();
			expect(currentMatch?.homePlayerIds).toHaveLength(2);
			expect(currentMatch?.awayPlayerIds).toHaveLength(2);

			const result = await client.session.recordResult.mutate({
				sessionId: session.id,
				sessionMatchId: currentMatch!.id,
				homeScore: 3,
				awayScore: 1,
			});

			expect(result.match.result).toBe("home");
			expect(result.proposedLineup).toBeDefined();
		});

		it("records a draw result correctly", async () => {
			const { client, season, seasonPlayers } = await setupSeasonWithPlayers(4);

			const session = await client.session.create.mutate({
				seasonSlug: season.slug,
				rotationMode: "round-robin",
				teamSize: 2,
				maxConsecutiveGames: null,
				seasonPlayerIds: seasonPlayers.map((p) => p.id),
			});

			await client.session.startNextMatch.mutate({
				sessionId: session.id,
				homeSeasonPlayerIds: [seasonPlayers[0].id, seasonPlayers[1].id],
				awaySeasonPlayerIds: [seasonPlayers[2].id, seasonPlayers[3].id],
			});

			const withMatch = await client.session.getById.query({ sessionId: session.id });
			const match = withMatch.matches.find((m) => m.result === null)!;

			const result = await client.session.recordResult.mutate({
				sessionId: session.id,
				sessionMatchId: match.id,
				homeScore: 1,
				awayScore: 1,
			});

			expect(result.match.result).toBe("draw");
		});
	});

	describe("end", () => {
		it("ends an active session", async () => {
			const { client, season, seasonPlayers } = await setupSeasonWithPlayers(4);

			const session = await client.session.create.mutate({
				seasonSlug: season.slug,
				rotationMode: "winner-stays",
				teamSize: 1,
				maxConsecutiveGames: null,
				seasonPlayerIds: seasonPlayers.map((p) => p.id),
			});

			const ended = await client.session.end.mutate({ sessionId: session.id });
			expect(ended.status).toBe("ended");

			const active = await client.session.getActive.query({ seasonSlug: season.slug });
			expect(active).toBeNull();
		});
	});

	describe("getSummary", () => {
		it("returns summary for an ended session", async () => {
			const { client, season, seasonPlayers } = await setupSeasonWithPlayers(4);

			const session = await client.session.create.mutate({
				seasonSlug: season.slug,
				rotationMode: "winner-stays",
				teamSize: 2,
				maxConsecutiveGames: null,
				seasonPlayerIds: seasonPlayers.map((p) => p.id),
			});

			await client.session.startNextMatch.mutate({
				sessionId: session.id,
				homeSeasonPlayerIds: [seasonPlayers[0].id, seasonPlayers[1].id],
				awaySeasonPlayerIds: [seasonPlayers[2].id, seasonPlayers[3].id],
			});

			const withMatch = await client.session.getById.query({ sessionId: session.id });
			const match = withMatch.matches.find((m) => m.result === null)!;

			await client.session.recordResult.mutate({
				sessionId: session.id,
				sessionMatchId: match.id,
				homeScore: 2,
				awayScore: 0,
			});

			await client.session.end.mutate({ sessionId: session.id });

			const summary = await client.session.getSummary.query({ sessionId: session.id });
			expect(summary).toBeDefined();
			expect(summary.totalMatches).toBe(1);
			expect(summary.playerStats).toHaveLength(4);
			expect(summary.playerStats.some((p) => p.wins > 0)).toBe(true);
		});
	});

	describe("removePlayer", () => {
		it("removes a waiting player from the session", async () => {
			const { client, season, seasonPlayers } = await setupSeasonWithPlayers(4);

			const session = await client.session.create.mutate({
				seasonSlug: season.slug,
				rotationMode: "winner-stays",
				teamSize: 1,
				maxConsecutiveGames: null,
				seasonPlayerIds: seasonPlayers.map((p) => p.id),
			});

			const fullSession = await client.session.getById.query({ sessionId: session.id });
			const playerToRemove = fullSession.players[3];

			await client.session.removePlayer.mutate({
				sessionId: session.id,
				sessionPlayerId: playerToRemove.id,
			});

			const updated = await client.session.getById.query({ sessionId: session.id });
			const removedPlayer = updated.players.find((p) => p.id === playerToRemove.id);
			expect(removedPlayer).toBeDefined();
			expect(removedPlayer!.status).toBe("out");
			const activePlayers = updated.players.filter((p) => p.status !== "out");
			expect(activePlayers).toHaveLength(3);
		});

		it("reorders queue positions after removal", async () => {
			const { client, season, seasonPlayers } = await setupSeasonWithPlayers(4);

			const session = await client.session.create.mutate({
				seasonSlug: season.slug,
				rotationMode: "winner-stays",
				teamSize: 1,
				maxConsecutiveGames: null,
				seasonPlayerIds: seasonPlayers.map((p) => p.id),
			});

			const fullSession = await client.session.getById.query({ sessionId: session.id });
			const playerToRemove = fullSession.players[1];

			await client.session.removePlayer.mutate({
				sessionId: session.id,
				sessionPlayerId: playerToRemove.id,
			});

			const updated = await client.session.getById.query({ sessionId: session.id });
			const waitingPlayers = updated.players.filter((p) => p.status === "waiting");
			const positions = waitingPlayers.map((p) => p.queuePosition).sort((a, b) => a - b);
			// Verify contiguous positions starting from 0: [0, 1, 2, ...]
			for (let i = 0; i < positions.length; i++) {
				expect(positions[i]).toBe(i);
			}
		});
	});

	describe("cancelMatch", () => {
		it("cancels the current in-progress match", async () => {
			const { client, season, seasonPlayers } = await setupSeasonWithPlayers(4);

			const session = await client.session.create.mutate({
				seasonSlug: season.slug,
				rotationMode: "winner-stays",
				teamSize: 2,
				maxConsecutiveGames: null,
				seasonPlayerIds: seasonPlayers.map((p) => p.id),
			});

			await client.session.startNextMatch.mutate({
				sessionId: session.id,
				homeSeasonPlayerIds: [seasonPlayers[0].id, seasonPlayers[1].id],
				awaySeasonPlayerIds: [seasonPlayers[2].id, seasonPlayers[3].id],
			});

			const beforeCancel = await client.session.getById.query({ sessionId: session.id });
			expect(beforeCancel.matches.filter((m) => m.result === null)).toHaveLength(1);

			const result = await client.session.cancelMatch.mutate({ sessionId: session.id });
			expect(result.players).toBeDefined();

			const afterCancel = await client.session.getById.query({ sessionId: session.id });
			expect(afterCancel.matches.filter((m) => m.result === null)).toHaveLength(0);
		});

		it("restores players to waiting status after cancel", async () => {
			const { client, season, seasonPlayers } = await setupSeasonWithPlayers(4);

			const session = await client.session.create.mutate({
				seasonSlug: season.slug,
				rotationMode: "winner-stays",
				teamSize: 2,
				maxConsecutiveGames: null,
				seasonPlayerIds: seasonPlayers.map((p) => p.id),
			});

			await client.session.startNextMatch.mutate({
				sessionId: session.id,
				homeSeasonPlayerIds: [seasonPlayers[0].id, seasonPlayers[1].id],
				awaySeasonPlayerIds: [seasonPlayers[2].id, seasonPlayers[3].id],
			});

			await client.session.cancelMatch.mutate({ sessionId: session.id });

			const afterCancel = await client.session.getById.query({ sessionId: session.id });
			expect(afterCancel.players.every((p) => p.status === "waiting")).toBe(true);
		});
	});

	describe("deleteLastMatch", () => {
		it("deletes the last completed match and reverts player stats", async () => {
			const { client, season, seasonPlayers } = await setupSeasonWithPlayers(4);

			const session = await client.session.create.mutate({
				seasonSlug: season.slug,
				rotationMode: "winner-stays",
				teamSize: 2,
				maxConsecutiveGames: null,
				seasonPlayerIds: seasonPlayers.map((p) => p.id),
			});

			await client.session.startNextMatch.mutate({
				sessionId: session.id,
				homeSeasonPlayerIds: [seasonPlayers[0].id, seasonPlayers[1].id],
				awaySeasonPlayerIds: [seasonPlayers[2].id, seasonPlayers[3].id],
			});

			const withMatch = await client.session.getById.query({ sessionId: session.id });
			const match = withMatch.matches.find((m) => m.result === null)!;

			await client.session.recordResult.mutate({
				sessionId: session.id,
				sessionMatchId: match.id,
				homeScore: 3,
				awayScore: 1,
			});

			const afterResult = await client.session.getById.query({ sessionId: session.id });
			expect(afterResult.matches.filter((m) => m.result !== null)).toHaveLength(1);

			const deleteResult = await client.session.deleteLastMatch.mutate({
				sessionId: session.id,
			});
			expect(deleteResult.deletedMatch).toBeDefined();

			const afterDelete = await client.session.getById.query({ sessionId: session.id });
			expect(afterDelete.matches.filter((m) => m.result !== null)).toHaveLength(0);
			expect(afterDelete.players.every((p) => p.gamesPlayedThisSession === 0)).toBe(true);
		});

		it("decrements gamesPlayedThisSession for participants", async () => {
			const { client, season, seasonPlayers } = await setupSeasonWithPlayers(4);

			const session = await client.session.create.mutate({
				seasonSlug: season.slug,
				rotationMode: "winner-stays",
				teamSize: 2,
				maxConsecutiveGames: null,
				seasonPlayerIds: seasonPlayers.map((p) => p.id),
			});

			// Play two matches
			await client.session.startNextMatch.mutate({
				sessionId: session.id,
				homeSeasonPlayerIds: [seasonPlayers[0].id, seasonPlayers[1].id],
				awaySeasonPlayerIds: [seasonPlayers[2].id, seasonPlayers[3].id],
			});

			let s = await client.session.getById.query({ sessionId: session.id });
			let m = s.matches.find((m) => m.result === null)!;

			await client.session.recordResult.mutate({
				sessionId: session.id,
				sessionMatchId: m.id,
				homeScore: 2,
				awayScore: 0,
			});

			await client.session.startNextMatch.mutate({
				sessionId: session.id,
				homeSeasonPlayerIds: [seasonPlayers[0].id, seasonPlayers[1].id],
				awaySeasonPlayerIds: [seasonPlayers[2].id, seasonPlayers[3].id],
			});

			s = await client.session.getById.query({ sessionId: session.id });
			m = s.matches.find((m) => m.result === null)!;

			await client.session.recordResult.mutate({
				sessionId: session.id,
				sessionMatchId: m.id,
				homeScore: 1,
				awayScore: 3,
			});

			const beforeDelete = await client.session.getById.query({ sessionId: session.id });
			expect(beforeDelete.players.every((p) => p.gamesPlayedThisSession === 2)).toBe(true);

			await client.session.deleteLastMatch.mutate({ sessionId: session.id });

			const afterDelete = await client.session.getById.query({ sessionId: session.id });
			expect(afterDelete.players.every((p) => p.gamesPlayedThisSession === 1)).toBe(true);
		});
	});

	describe("listEnded", () => {
		it("returns empty array when no ended sessions", async () => {
			const { client, season } = await setupSeasonWithPlayers(4);
			const ended = await client.session.listEnded.query({ seasonSlug: season.slug });
			expect(ended).toEqual([]);
		});

		it("returns ended sessions with match and player counts", async () => {
			const { client, season, seasonPlayers } = await setupSeasonWithPlayers(4);

			const session = await client.session.create.mutate({
				seasonSlug: season.slug,
				rotationMode: "winner-stays",
				teamSize: 2,
				maxConsecutiveGames: null,
				seasonPlayerIds: seasonPlayers.map((p) => p.id),
			});

			await client.session.startNextMatch.mutate({
				sessionId: session.id,
				homeSeasonPlayerIds: [seasonPlayers[0].id, seasonPlayers[1].id],
				awaySeasonPlayerIds: [seasonPlayers[2].id, seasonPlayers[3].id],
			});

			const withMatch = await client.session.getById.query({ sessionId: session.id });
			const match = withMatch.matches.find((m) => m.result === null)!;

			await client.session.recordResult.mutate({
				sessionId: session.id,
				sessionMatchId: match.id,
				homeScore: 2,
				awayScore: 1,
			});

			await client.session.end.mutate({ sessionId: session.id });

			const ended = await client.session.listEnded.query({ seasonSlug: season.slug });
			expect(ended).toHaveLength(1);
			expect(ended[0].id).toBe(session.id);
			expect(ended[0].totalMatches).toBe(1);
			expect(ended[0].playerCount).toBe(4);
			expect(ended[0].endedAt).toBeDefined();
		});
	});

	describe("teamSize > 2", () => {
		it("creates and runs a 3v3 session", async () => {
			const { client, season, seasonPlayers } = await setupSeasonWithPlayers(8);

			const session = await client.session.create.mutate({
				seasonSlug: season.slug,
				rotationMode: "winner-stays",
				teamSize: 3,
				maxConsecutiveGames: null,
				seasonPlayerIds: seasonPlayers.map((p) => p.id),
			});

			await client.session.startNextMatch.mutate({
				sessionId: session.id,
				homeSeasonPlayerIds: [seasonPlayers[0].id, seasonPlayers[1].id, seasonPlayers[2].id],
				awaySeasonPlayerIds: [seasonPlayers[3].id, seasonPlayers[4].id, seasonPlayers[5].id],
			});

			const withMatch = await client.session.getById.query({ sessionId: session.id });
			expect(withMatch.players.filter((p) => p.status === "playing")).toHaveLength(6);
		});
	});

	describe("error paths", () => {
		it("rejects duplicate addPlayer", async () => {
			const { client, season, seasonPlayers } = await setupSeasonWithPlayers(4);

			const session = await client.session.create.mutate({
				seasonSlug: season.slug,
				rotationMode: "winner-stays",
				teamSize: 1,
				maxConsecutiveGames: null,
				seasonPlayerIds: seasonPlayers.slice(0, 3).map((p) => p.id),
			});

			await client.session.addPlayer.mutate({
				sessionId: session.id,
				seasonPlayerId: seasonPlayers[3].id,
			});

			await expect(
				client.session.addPlayer.mutate({
					sessionId: session.id,
					seasonPlayerId: seasonPlayers[3].id,
				})
			).rejects.toThrow();
		});

		it("rejects removing playing player", async () => {
			const { client, season, seasonPlayers } = await setupSeasonWithPlayers(4);

			const session = await client.session.create.mutate({
				seasonSlug: season.slug,
				rotationMode: "winner-stays",
				teamSize: 2,
				maxConsecutiveGames: null,
				seasonPlayerIds: seasonPlayers.map((p) => p.id),
			});

			await client.session.startNextMatch.mutate({
				sessionId: session.id,
				homeSeasonPlayerIds: [seasonPlayers[0].id, seasonPlayers[1].id],
				awaySeasonPlayerIds: [seasonPlayers[2].id, seasonPlayers[3].id],
			});

			const withMatch = await client.session.getById.query({ sessionId: session.id });
			const playingPlayer = withMatch.players.find((p) => p.status === "playing")!;

			await expect(
				client.session.removePlayer.mutate({
					sessionId: session.id,
					sessionPlayerId: playingPlayer.id,
				})
			).rejects.toThrow("currently in a match");
		});

		it("rejects deleteLastMatch with no completed match", async () => {
			const { client, season, seasonPlayers } = await setupSeasonWithPlayers(4);

			const session = await client.session.create.mutate({
				seasonSlug: season.slug,
				rotationMode: "winner-stays",
				teamSize: 1,
				maxConsecutiveGames: null,
				seasonPlayerIds: seasonPlayers.map((p) => p.id),
			});

			await expect(
				client.session.deleteLastMatch.mutate({ sessionId: session.id })
			).rejects.toThrow("No completed match");
		});

		it("rejects deleteLastMatch while match in progress", async () => {
			const { client, season, seasonPlayers } = await setupSeasonWithPlayers(4);

			const session = await client.session.create.mutate({
				seasonSlug: season.slug,
				rotationMode: "winner-stays",
				teamSize: 2,
				maxConsecutiveGames: null,
				seasonPlayerIds: seasonPlayers.map((p) => p.id),
			});

			await client.session.startNextMatch.mutate({
				sessionId: session.id,
				homeSeasonPlayerIds: [seasonPlayers[0].id, seasonPlayers[1].id],
				awaySeasonPlayerIds: [seasonPlayers[2].id, seasonPlayers[3].id],
			});

			await expect(
				client.session.deleteLastMatch.mutate({ sessionId: session.id })
			).rejects.toThrow();
		});
	});
});
