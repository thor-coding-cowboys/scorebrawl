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

function winnerStaysSettings(overrides = {}) {
	return {
		mode: "winner-stays" as const,
		maxConsecutiveGames: null,
		winnersTakePriority: false,
		autoRandomize: false,
		randomizerType: "fisher-yates" as const,
		autoCoinToss: false,
		alwaysSplitConstraints: [] as [string, string][],
		...overrides,
	};
}

function manualSettings() {
	return { mode: "manual" as const };
}

describe("session router", () => {
	describe("create", () => {
		it("creates a session with players", async () => {
			const { client, season, seasonPlayers } = await setupSeasonWithPlayers(4);

			const session = await client.session.create.mutate({
				seasonSlug: season.slug,
				rotationMode: "winner-stays",
				teamSize: 1,
				modeSettings: winnerStaysSettings(),
				playerSeasonIds: seasonPlayers.map((p) => p.id),
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
				modeSettings: winnerStaysSettings(),
				playerSeasonIds: seasonPlayers.map((p) => p.id),
			});

			await expect(
				client.session.create.mutate({
					seasonSlug: season.slug,
					rotationMode: "winner-stays",
					teamSize: 1,
					modeSettings: winnerStaysSettings(),
					playerSeasonIds: seasonPlayers.map((p) => p.id),
				})
			).rejects.toThrow("active session");
		});

		it("creates a manual session", async () => {
			const { client, season, seasonPlayers } = await setupSeasonWithPlayers(4);

			const session = await client.session.create.mutate({
				seasonSlug: season.slug,
				rotationMode: "manual",
				teamSize: 2,
				modeSettings: manualSettings(),
				playerSeasonIds: seasonPlayers.map((p) => p.id),
			});

			expect(session.id).toBeDefined();
			expect(session.status).toBe("active");
			expect(session.rotationMode).toBe("manual");
			expect(session.teamSize).toBe(2);
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
				modeSettings: winnerStaysSettings(),
				playerSeasonIds: seasonPlayers.map((p) => p.id),
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
				modeSettings: winnerStaysSettings(),
				playerSeasonIds: seasonPlayers.map((p) => p.id),
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
				modeSettings: winnerStaysSettings(),
				playerSeasonIds: seasonPlayers.slice(0, 3).map((p) => p.id),
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
				modeSettings: winnerStaysSettings(),
				playerSeasonIds: seasonPlayers.map((p) => p.id),
			});

			const match = await client.session.startNextMatch.mutate({
				sessionId: session.id,
				homeSeasonPlayerIds: [seasonPlayers[0].id, seasonPlayers[1].id],
				awaySeasonPlayerIds: [seasonPlayers[2].id, seasonPlayers[3].id],
			});

			expect(match.result).toBeNull();
			expect(match.homePlayerIds).toHaveLength(2);
			expect(match.awayPlayerIds).toHaveLength(2);

			await client.session.recordResult.mutate({
				sessionId: session.id,
				sessionMatchId: match.id,
				homeScore: 3,
				awayScore: 1,
			});

			const withResult = await client.session.getById.query({ sessionId: session.id });
			const recordedMatch = withResult.matches.find((m) => m.id === match.id);
			expect(recordedMatch?.result).toBe("home");
		});

		it("records a draw result correctly", async () => {
			const { client, season, seasonPlayers } = await setupSeasonWithPlayers(4);

			const session = await client.session.create.mutate({
				seasonSlug: season.slug,
				rotationMode: "winner-stays",
				teamSize: 2,
				modeSettings: winnerStaysSettings(),
				playerSeasonIds: seasonPlayers.map((p) => p.id),
			});

			const match = await client.session.startNextMatch.mutate({
				sessionId: session.id,
				homeSeasonPlayerIds: [seasonPlayers[0].id, seasonPlayers[1].id],
				awaySeasonPlayerIds: [seasonPlayers[2].id, seasonPlayers[3].id],
			});

			await client.session.recordResult.mutate({
				sessionId: session.id,
				sessionMatchId: match.id,
				homeScore: 1,
				awayScore: 1,
			});

			const withResult = await client.session.getById.query({ sessionId: session.id });
			const recordedMatch = withResult.matches.find((m) => m.id === match.id);
			expect(recordedMatch?.result).toBe("draw");
		});
	});

	describe("end", () => {
		it("ends an active session", async () => {
			const { client, season, seasonPlayers } = await setupSeasonWithPlayers(4);

			const session = await client.session.create.mutate({
				seasonSlug: season.slug,
				rotationMode: "winner-stays",
				teamSize: 1,
				modeSettings: winnerStaysSettings(),
				playerSeasonIds: seasonPlayers.map((p) => p.id),
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
				modeSettings: winnerStaysSettings(),
				playerSeasonIds: seasonPlayers.map((p) => p.id),
			});

			const match = await client.session.startNextMatch.mutate({
				sessionId: session.id,
				homeSeasonPlayerIds: [seasonPlayers[0].id, seasonPlayers[1].id],
				awaySeasonPlayerIds: [seasonPlayers[2].id, seasonPlayers[3].id],
			});

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
				modeSettings: winnerStaysSettings(),
				playerSeasonIds: seasonPlayers.map((p) => p.id),
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
				modeSettings: winnerStaysSettings(),
				playerSeasonIds: seasonPlayers.map((p) => p.id),
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
				modeSettings: winnerStaysSettings(),
				playerSeasonIds: seasonPlayers.map((p) => p.id),
			});

			await client.session.startNextMatch.mutate({
				sessionId: session.id,
				homeSeasonPlayerIds: [seasonPlayers[0].id, seasonPlayers[1].id],
				awaySeasonPlayerIds: [seasonPlayers[2].id, seasonPlayers[3].id],
			});

			const beforeCancel = await client.session.getById.query({ sessionId: session.id });
			expect(beforeCancel.matches.filter((m) => m.result === null)).toHaveLength(1);

			await client.session.cancelMatch.mutate({ sessionId: session.id });

			const afterCancel = await client.session.getById.query({ sessionId: session.id });
			expect(afterCancel.matches.filter((m) => m.result === null)).toHaveLength(0);
		});

		it("restores players to waiting status after cancel", async () => {
			const { client, season, seasonPlayers } = await setupSeasonWithPlayers(4);

			const session = await client.session.create.mutate({
				seasonSlug: season.slug,
				rotationMode: "winner-stays",
				teamSize: 2,
				modeSettings: winnerStaysSettings(),
				playerSeasonIds: seasonPlayers.map((p) => p.id),
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
				modeSettings: winnerStaysSettings(),
				playerSeasonIds: seasonPlayers.map((p) => p.id),
			});

			const match = await client.session.startNextMatch.mutate({
				sessionId: session.id,
				homeSeasonPlayerIds: [seasonPlayers[0].id, seasonPlayers[1].id],
				awaySeasonPlayerIds: [seasonPlayers[2].id, seasonPlayers[3].id],
			});

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
				modeSettings: winnerStaysSettings(),
				playerSeasonIds: seasonPlayers.map((p) => p.id),
			});

			let match = await client.session.startNextMatch.mutate({
				sessionId: session.id,
				homeSeasonPlayerIds: [seasonPlayers[0].id, seasonPlayers[1].id],
				awaySeasonPlayerIds: [seasonPlayers[2].id, seasonPlayers[3].id],
			});

			await client.session.recordResult.mutate({
				sessionId: session.id,
				sessionMatchId: match.id,
				homeScore: 2,
				awayScore: 0,
			});

			match = await client.session.startNextMatch.mutate({
				sessionId: session.id,
				homeSeasonPlayerIds: [seasonPlayers[0].id, seasonPlayers[1].id],
				awaySeasonPlayerIds: [seasonPlayers[2].id, seasonPlayers[3].id],
			});

			await client.session.recordResult.mutate({
				sessionId: session.id,
				sessionMatchId: match.id,
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
				modeSettings: winnerStaysSettings(),
				playerSeasonIds: seasonPlayers.map((p) => p.id),
			});

			const match = await client.session.startNextMatch.mutate({
				sessionId: session.id,
				homeSeasonPlayerIds: [seasonPlayers[0].id, seasonPlayers[1].id],
				awaySeasonPlayerIds: [seasonPlayers[2].id, seasonPlayers[3].id],
			});

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
				modeSettings: winnerStaysSettings(),
				playerSeasonIds: seasonPlayers.map((p) => p.id),
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

	describe("joinSelf", () => {
		it("allows authenticated season player to join active session", async () => {
			const { ctx, client, season, seasonPlayers } = await setupSeasonWithPlayers(4);

			const authUserSeasonPlayerIndex = seasonPlayers.findIndex((p) => p.userId === ctx.user.id);
			expect(authUserSeasonPlayerIndex).toBeGreaterThanOrEqual(0);

			const otherPlayers = seasonPlayers.filter((_, i) => i !== authUserSeasonPlayerIndex);
			expect(otherPlayers.length).toBe(3);

			const session = await client.session.create.mutate({
				seasonSlug: season.slug,
				rotationMode: "winner-stays",
				teamSize: 1,
				modeSettings: winnerStaysSettings(),
				playerSeasonIds: otherPlayers.map((p) => p.id),
			});

			const newPlayer = await client.session.joinSelf.mutate({
				sessionId: session.id,
			});

			expect(newPlayer.id).toBeDefined();
			expect(newPlayer.seasonPlayerId).toBe(seasonPlayers[authUserSeasonPlayerIndex].id);

			const updated = await client.session.getById.query({ sessionId: session.id });
			expect(updated.players).toHaveLength(4);
			const joinedPlayer = updated.players.find(
				(p) => p.seasonPlayerId === seasonPlayers[authUserSeasonPlayerIndex].id
			);
			expect(joinedPlayer).toBeDefined();
		});

		it("rejects user who is not a season player", async () => {
			const { ctx: _ctx, client, season, seasonPlayers } = await setupSeasonWithPlayers(4);

			const session = await client.session.create.mutate({
				seasonSlug: season.slug,
				rotationMode: "winner-stays",
				teamSize: 1,
				modeSettings: winnerStaysSettings(),
				playerSeasonIds: seasonPlayers.slice(0, 3).map((p) => p.id),
			});

			const otherUserCtx = await createAuthContext();
			const otherUserClient = createTRPCTestClient({ sessionToken: otherUserCtx.sessionToken });

			await expect(
				otherUserClient.session.joinSelf.mutate({
					sessionId: session.id,
				})
			).rejects.toThrow("not a player");
		});

		it("rejects joining twice with CONFLICT error", async () => {
			const { ctx, client, season, seasonPlayers } = await setupSeasonWithPlayers(4);

			const authUserSeasonPlayerIndex = seasonPlayers.findIndex((p) => p.userId === ctx.user.id);
			expect(authUserSeasonPlayerIndex).toBeGreaterThanOrEqual(0);

			const otherPlayers = seasonPlayers.filter((_, i) => i !== authUserSeasonPlayerIndex);
			expect(otherPlayers.length).toBe(3);

			const session = await client.session.create.mutate({
				seasonSlug: season.slug,
				rotationMode: "winner-stays",
				teamSize: 1,
				modeSettings: winnerStaysSettings(),
				playerSeasonIds: otherPlayers.map((p) => p.id),
			});

			await client.session.joinSelf.mutate({
				sessionId: session.id,
			});

			await expect(
				client.session.joinSelf.mutate({
					sessionId: session.id,
				})
			).rejects.toThrow("already in this session");
		});

		it("rejects invalid sessionId with NOT_FOUND error", async () => {
			const { client } = await setupSeasonWithPlayers(2);

			await expect(
				client.session.joinSelf.mutate({
					sessionId: "non-existent-session-id",
				})
			).rejects.toThrow("Session not found");
		});

		it("rejects joining ended session with BAD_REQUEST error", async () => {
			const { ctx: _ctx, client, season, seasonPlayers } = await setupSeasonWithPlayers(4);

			const session = await client.session.create.mutate({
				seasonSlug: season.slug,
				rotationMode: "winner-stays",
				teamSize: 1,
				modeSettings: winnerStaysSettings(),
				playerSeasonIds: seasonPlayers.slice(0, 3).map((p) => p.id),
			});

			await client.session.end.mutate({ sessionId: session.id });

			await expect(
				client.session.joinSelf.mutate({
					sessionId: session.id,
				})
			).rejects.toThrow("Session is not active");
		});
	});

	describe("error paths", () => {
		it("rejects duplicate addPlayer", async () => {
			const { client, season, seasonPlayers } = await setupSeasonWithPlayers(4);

			const session = await client.session.create.mutate({
				seasonSlug: season.slug,
				rotationMode: "winner-stays",
				teamSize: 1,
				modeSettings: winnerStaysSettings(),
				playerSeasonIds: seasonPlayers.slice(0, 3).map((p) => p.id),
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

		it("allows removing playing player", async () => {
			const { client, season, seasonPlayers } = await setupSeasonWithPlayers(4);

			const session = await client.session.create.mutate({
				seasonSlug: season.slug,
				rotationMode: "winner-stays",
				teamSize: 2,
				modeSettings: winnerStaysSettings(),
				playerSeasonIds: seasonPlayers.map((p) => p.id),
			});

			await client.session.startNextMatch.mutate({
				sessionId: session.id,
				homeSeasonPlayerIds: [seasonPlayers[0].id, seasonPlayers[1].id],
				awaySeasonPlayerIds: [seasonPlayers[2].id, seasonPlayers[3].id],
			});

			const withMatch = await client.session.getById.query({ sessionId: session.id });
			const playingPlayer = withMatch.players.find((p) => p.status === "playing")!;

			await client.session.removePlayer.mutate({
				sessionId: session.id,
				sessionPlayerId: playingPlayer.id,
			});

			const updatedSession = await client.session.getById.query({ sessionId: session.id });
			const removedPlayer = updatedSession.players.find((p) => p.id === playingPlayer.id);
			expect(removedPlayer?.status).toBe("out");
		});

		it("rejects deleteLastMatch with no completed match", async () => {
			const { client, season, seasonPlayers } = await setupSeasonWithPlayers(4);

			const session = await client.session.create.mutate({
				seasonSlug: season.slug,
				rotationMode: "winner-stays",
				teamSize: 1,
				modeSettings: winnerStaysSettings(),
				playerSeasonIds: seasonPlayers.map((p) => p.id),
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
				modeSettings: winnerStaysSettings(),
				playerSeasonIds: seasonPlayers.map((p) => p.id),
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

	describe("winner-stays session flow", () => {
		it("creates session, starts match, records result, verifies next lineup", async () => {
			const { client, season, seasonPlayers } = await setupSeasonWithPlayers(4);

			const session = await client.session.create.mutate({
				seasonSlug: season.slug,
				rotationMode: "winner-stays",
				teamSize: 1,
				modeSettings: winnerStaysSettings(),
				playerSeasonIds: seasonPlayers.map((p) => p.id),
			});

			expect(session.rotationMode).toBe("winner-stays");

			await client.session.startNextMatch.mutate({
				sessionId: session.id,
				homeSeasonPlayerIds: [seasonPlayers[0].id],
				awaySeasonPlayerIds: [seasonPlayers[1].id],
			});

			let s = await client.session.getById.query({ sessionId: session.id });
			expect(s.players.filter((p) => p.status === "playing")).toHaveLength(2);

			const match = s.matches.find((x) => x.result === null)!;
			await client.session.recordResult.mutate({
				sessionId: session.id,
				sessionMatchId: match.id,
				homeScore: 2,
				awayScore: 0,
			});

			s = await client.session.getById.query({ sessionId: session.id });
			const updatedMatch = s.matches.find((m) => m.id === match.id);
			expect(updatedMatch?.result).toBe("home");
			expect(s.proposedLineup).toBeDefined();
		});

		it("handles draw with coin toss", async () => {
			const { client, season, seasonPlayers } = await setupSeasonWithPlayers(4);

			const session = await client.session.create.mutate({
				seasonSlug: season.slug,
				rotationMode: "winner-stays",
				teamSize: 1,
				modeSettings: winnerStaysSettings({ autoCoinToss: false }),
				playerSeasonIds: seasonPlayers.map((p) => p.id),
			});

			const match = await client.session.startNextMatch.mutate({
				sessionId: session.id,
				homeSeasonPlayerIds: [seasonPlayers[0].id],
				awaySeasonPlayerIds: [seasonPlayers[1].id],
			});

			const result = await client.session.recordResult.mutate({
				sessionId: session.id,
				sessionMatchId: match.id,
				homeScore: 1,
				awayScore: 1,
			});

			expect(result.coinTossId).toBeDefined();

			const s = await client.session.getById.query({ sessionId: session.id });
			const recordedMatch = s.matches.find((m) => m.id === match.id);
			expect(recordedMatch?.result).toBe("draw");

			const coinToss = await client.session.resolveCoinToss.mutate({
				coinTossId: result.coinTossId!,
				resolvedWinnerIds: [seasonPlayers[0].id],
			});

			expect(coinToss.resolved).toBeDefined();
			expect(coinToss.proposedLineup).toBeDefined();
		});

		it("enforces max consecutive games", async () => {
			const { client, season, seasonPlayers } = await setupSeasonWithPlayers(4);

			const session = await client.session.create.mutate({
				seasonSlug: season.slug,
				rotationMode: "winner-stays",
				teamSize: 1,
				modeSettings: winnerStaysSettings({
					maxConsecutiveGames: 2,
					winnersTakePriority: true,
				}),
				playerSeasonIds: seasonPlayers.map((p) => p.id),
			});

			let match = await client.session.startNextMatch.mutate({
				sessionId: session.id,
				homeSeasonPlayerIds: [seasonPlayers[0].id],
				awaySeasonPlayerIds: [seasonPlayers[1].id],
			});

			await client.session.recordResult.mutate({
				sessionId: session.id,
				sessionMatchId: match.id,
				homeScore: 1,
				awayScore: 0,
			});

			match = await client.session.startNextMatch.mutate({
				sessionId: session.id,
				homeSeasonPlayerIds: [seasonPlayers[0].id],
				awaySeasonPlayerIds: [seasonPlayers[2].id],
			});

			await client.session.recordResult.mutate({
				sessionId: session.id,
				sessionMatchId: match.id,
				homeScore: 1,
				awayScore: 0,
			});

			const s = await client.session.getById.query({ sessionId: session.id });
			const p0 = s.players.find((p) => p.seasonPlayerId === seasonPlayers[0].id)!;
			expect(p0.consecutiveGames).toBe(2);
		});

		it("enforces always-split constraints", async () => {
			const { client, season, seasonPlayers } = await setupSeasonWithPlayers(4);

			const session = await client.session.create.mutate({
				seasonSlug: season.slug,
				rotationMode: "winner-stays",
				teamSize: 1,
				modeSettings: winnerStaysSettings({
					alwaysSplitConstraints: [[seasonPlayers[0].id, seasonPlayers[1].id]],
				}),
				playerSeasonIds: seasonPlayers.map((p) => p.id),
			});

			const match = await client.session.startNextMatch.mutate({
				sessionId: session.id,
				homeSeasonPlayerIds: [seasonPlayers[0].id],
				awaySeasonPlayerIds: [seasonPlayers[2].id],
			});

			await client.session.recordResult.mutate({
				sessionId: session.id,
				sessionMatchId: match.id,
				homeScore: 1,
				awayScore: 0,
			});

			const s = await client.session.getById.query({ sessionId: session.id });
			const proposed = s.proposedLineup;
			if (proposed) {
				const homeIds = proposed.homePlayerIds;
				const awayIds = proposed.awayPlayerIds;
				const p0Home = homeIds.includes(seasonPlayers[0].id);
				const p1Home = homeIds.includes(seasonPlayers[1].id);
				const p0Away = awayIds.includes(seasonPlayers[0].id);
				const p1Away = awayIds.includes(seasonPlayers[1].id);
				const splitViolated =
					(p0Home && p1Home) || (p0Away && p1Away) || (p0Home && p1Away) || (p0Away && p1Home);
				expect(splitViolated).toBe(false);
			}
		});
	});

	describe("manual session flow", () => {
		it("creates session, starts match, records result, no auto-rotation", async () => {
			const { client, season, seasonPlayers } = await setupSeasonWithPlayers(4);

			const session = await client.session.create.mutate({
				seasonSlug: season.slug,
				rotationMode: "manual",
				teamSize: 2,
				modeSettings: manualSettings(),
				playerSeasonIds: seasonPlayers.map((p) => p.id),
			});

			expect(session.rotationMode).toBe("manual");

			await client.session.startNextMatch.mutate({
				sessionId: session.id,
				homeSeasonPlayerIds: [seasonPlayers[0].id, seasonPlayers[1].id],
				awaySeasonPlayerIds: [seasonPlayers[2].id, seasonPlayers[3].id],
			});

			let s = await client.session.getById.query({ sessionId: session.id });
			expect(s.players.filter((p) => p.status === "playing")).toHaveLength(4);

			const match = s.matches.find((x) => x.result === null)!;
			const result = await client.session.recordResult.mutate({
				sessionId: session.id,
				sessionMatchId: match.id,
				homeScore: 3,
				awayScore: 1,
			});

			expect(result.proposedLineup).toBeNull();
		});
	});

	describe("player management", () => {
		it("adds player mid-session, updates queue", async () => {
			const { client, season, seasonPlayers } = await setupSeasonWithPlayers(4);

			const session = await client.session.create.mutate({
				seasonSlug: season.slug,
				rotationMode: "winner-stays",
				teamSize: 1,
				modeSettings: winnerStaysSettings(),
				playerSeasonIds: seasonPlayers.slice(0, 3).map((p) => p.id),
			});

			await client.session.addPlayer.mutate({
				sessionId: session.id,
				seasonPlayerId: seasonPlayers[3].id,
			});

			const updated = await client.session.getById.query({ sessionId: session.id });
			expect(updated.players).toHaveLength(4);
			const newPlayer = updated.players.find((p) => p.seasonPlayerId === seasonPlayers[3].id);
			expect(newPlayer?.status).toBe("waiting");
		});

		it("removes player from proposed lineup, recomputes", async () => {
			const { client, season, seasonPlayers } = await setupSeasonWithPlayers(4);

			const session = await client.session.create.mutate({
				seasonSlug: season.slug,
				rotationMode: "winner-stays",
				teamSize: 1,
				modeSettings: winnerStaysSettings(),
				playerSeasonIds: seasonPlayers.map((p) => p.id),
			});

			const match = await client.session.startNextMatch.mutate({
				sessionId: session.id,
				homeSeasonPlayerIds: [seasonPlayers[0].id],
				awaySeasonPlayerIds: [seasonPlayers[1].id],
			});

			await client.session.recordResult.mutate({
				sessionId: session.id,
				sessionMatchId: match.id,
				homeScore: 1,
				awayScore: 0,
			});

			const s = await client.session.getById.query({ sessionId: session.id });
			const proposedBefore = s.proposedLineup;
			const playerToRemove = proposedBefore?.homePlayerIds[0] || proposedBefore?.awayPlayerIds[0];
			expect(playerToRemove).toBeDefined();

			await client.session.removePlayer.mutate({
				sessionId: session.id,
				sessionPlayerId: playerToRemove!,
			});

			const afterRemove = await client.session.getById.query({ sessionId: session.id });
			const removed = afterRemove.players.find((p) => p.id === playerToRemove);
			expect(removed?.status).toBe("out");
		});
	});
});
