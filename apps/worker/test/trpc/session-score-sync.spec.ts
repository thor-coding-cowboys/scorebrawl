import { describe, expect, it } from "vitest";
import { createAuthContext } from "../setup/auth-context-util";
import { createPlayers } from "../setup/season-context-util";
import { createTRPCTestClient } from "./trpc-test-client";

async function setupSeasonWithSession(playerCount = 4) {
	const ctx = await createAuthContext();
	const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

	await createPlayers(ctx, playerCount);
	const season = await client.season.create.mutate({
		name: "Score Sync Test Season",
		initialScore: 1000,
		scoreType: "elo",
		kFactor: 32,
		startDate: new Date(),
	});

	const seasonPlayers = await client.seasonPlayer.getAll.query({ seasonSlug: season.slug });

	const session = await client.session.create.mutate({
		seasonSlug: season.slug,
		rotationMode: "winner-stays",
		teamSize: 1,
		maxConsecutiveGames: null,
		seasonPlayerIds: seasonPlayers.map((p) => p.id),
	});

	await client.session.startNextMatch.mutate({
		sessionId: session.id,
		homeSeasonPlayerIds: [seasonPlayers[0].id],
		awaySeasonPlayerIds: [seasonPlayers[1].id],
	});

	const sessionWithMatch = await client.session.getById.query({ sessionId: session.id });
	const currentMatch = sessionWithMatch.matches.find((m) => m.result === null);
	expect(currentMatch).toBeDefined();

	return { ctx, client, season, session, seasonPlayers, currentMatch: currentMatch! };
}

describe("session score sync", () => {
	describe("updateMatchScore", () => {
		it("updates score successfully and persists to database", async () => {
			const { client, session, currentMatch } = await setupSeasonWithSession();

			const updated = await client.session.updateMatchScore.mutate({
				sessionId: session.id,
				sessionMatchId: currentMatch.id,
				homeScore: 5,
				awayScore: 3,
			});

			expect(updated.homeSessionScore).toBe(5);
			expect(updated.awaySessionScore).toBe(3);

			const refreshed = await client.session.getById.query({ sessionId: session.id });
			const match = refreshed.matches.find((m) => m.id === currentMatch.id);
			expect(match?.homeSessionScore).toBe(5);
			expect(match?.awaySessionScore).toBe(3);
		});

		it("returns correct score values after update", async () => {
			const { client, session, currentMatch } = await setupSeasonWithSession();

			const updated = await client.session.updateMatchScore.mutate({
				sessionId: session.id,
				sessionMatchId: currentMatch.id,
				homeScore: 10,
				awayScore: 7,
			});

			expect(updated).toMatchObject({
				id: currentMatch.id,
				homeSessionScore: 10,
				awaySessionScore: 7,
			});
		});

		it("rejects invalid session id", async () => {
			const { client, currentMatch } = await setupSeasonWithSession();

			await expect(
				client.session.updateMatchScore.mutate({
					sessionId: "invalid-session-id",
					sessionMatchId: currentMatch.id,
					homeScore: 5,
					awayScore: 3,
				})
			).rejects.toThrow();
		});

		it("rejects negative scores", async () => {
			const { client, session, currentMatch } = await setupSeasonWithSession();

			await expect(
				client.session.updateMatchScore.mutate({
					sessionId: session.id,
					sessionMatchId: currentMatch.id,
					homeScore: -1,
					awayScore: 3,
				})
			).rejects.toThrow();
		});

		it("rejects non-integer scores", async () => {
			const { client, session, currentMatch } = await setupSeasonWithSession();

			await expect(
				client.session.updateMatchScore.mutate({
					sessionId: session.id,
					sessionMatchId: currentMatch.id,
					homeScore: 3.5,
					awayScore: 2,
				})
			).rejects.toThrow();
		});

		it("allows multiple score updates", async () => {
			const { client, session, currentMatch } = await setupSeasonWithSession();

			await client.session.updateMatchScore.mutate({
				sessionId: session.id,
				sessionMatchId: currentMatch.id,
				homeScore: 1,
				awayScore: 0,
			});

			await client.session.updateMatchScore.mutate({
				sessionId: session.id,
				sessionMatchId: currentMatch.id,
				homeScore: 2,
				awayScore: 1,
			});

			const updated = await client.session.updateMatchScore.mutate({
				sessionId: session.id,
				sessionMatchId: currentMatch.id,
				homeScore: 5,
				awayScore: 3,
			});

			expect(updated.homeSessionScore).toBe(5);
			expect(updated.awaySessionScore).toBe(3);
		});
	});

	describe("score reset on match end", () => {
		it("resets scores when match is cancelled", async () => {
			const { client, session, currentMatch } = await setupSeasonWithSession();

			await client.session.updateMatchScore.mutate({
				sessionId: session.id,
				sessionMatchId: currentMatch.id,
				homeScore: 7,
				awayScore: 4,
			});

			await client.session.cancelMatch.mutate({ sessionId: session.id });

			const refreshed = await client.session.getById.query({ sessionId: session.id });
			const cancelledMatch = refreshed.matches.find((m) => m.id === currentMatch.id);
			expect(cancelledMatch).toBeUndefined();
		});

		it("records result when match is completed", async () => {
			const { client, session, currentMatch } = await setupSeasonWithSession();

			await client.session.updateMatchScore.mutate({
				sessionId: session.id,
				sessionMatchId: currentMatch.id,
				homeScore: 5,
				awayScore: 2,
			});

			await client.session.recordResult.mutate({
				sessionId: session.id,
				sessionMatchId: currentMatch.id,
				homeScore: 5,
				awayScore: 2,
			});

			const refreshed = await client.session.getById.query({ sessionId: session.id });
			const recordedMatch = refreshed.matches.find((m) => m.id === currentMatch.id);
			expect(recordedMatch?.result).toBe("home");
		});
	});

	describe("initial scores", () => {
		it("initializes with zero scores", async () => {
			const { client, session, currentMatch } = await setupSeasonWithSession();

			const refreshed = await client.session.getById.query({ sessionId: session.id });
			const match = refreshed.matches.find((m) => m.id === currentMatch.id);
			expect(match?.homeSessionScore).toBe(0);
			expect(match?.awaySessionScore).toBe(0);
		});
	});

	describe("updateTeamSelection", () => {
		it("saves selected player ids and persists to database", async () => {
			const { client, session, seasonPlayers, currentMatch } = await setupSeasonWithSession();

			const updated = await client.session.updateTeamSelection.mutate({
				sessionId: session.id,
				sessionMatchId: currentMatch.id,
				selectedHomePlayerIds: [seasonPlayers[0].id],
				selectedAwayPlayerIds: [seasonPlayers[1].id],
			});

			expect(updated).toMatchObject({
				id: currentMatch.id,
			});

			const refreshed = await client.session.getById.query({ sessionId: session.id });
			const match = refreshed.matches.find((m) => m.id === currentMatch.id);
			expect(match?.selectedHomePlayerIds).toEqual([seasonPlayers[0].id]);
			expect(match?.selectedAwayPlayerIds).toEqual([seasonPlayers[1].id]);
		});

		it("rejects update for a match from a different session", async () => {
			const { client, seasonPlayers, currentMatch } = await setupSeasonWithSession();

			await expect(
				client.session.updateTeamSelection.mutate({
					sessionId: "wrong-session-id",
					sessionMatchId: currentMatch.id,
					selectedHomePlayerIds: [seasonPlayers[0].id],
					selectedAwayPlayerIds: [seasonPlayers[1].id],
				})
			).rejects.toThrow();
		});
	});

	describe("updateProposedLineup", () => {
		it("saves proposed lineup and persists to database", async () => {
			const { client, session, seasonPlayers } = await setupSeasonWithSession();

			const lineup = {
				homePlayerIds: [seasonPlayers[0].id],
				awayPlayerIds: [seasonPlayers[1].id],
				rotatedOut: [],
				coinTossNeeded: null,
				selectedHomePlayerIds: [seasonPlayers[0].id],
				selectedAwayPlayerIds: [seasonPlayers[1].id],
			};

			await client.session.updateProposedLineup.mutate({
				sessionId: session.id,
				proposedLineup: lineup,
			});

			const refreshed = await client.session.getById.query({ sessionId: session.id });
			expect(refreshed.proposedLineup).toMatchObject({
				homePlayerIds: [seasonPlayers[0].id],
				awayPlayerIds: [seasonPlayers[1].id],
				rotatedOut: [],
				coinTossNeeded: null,
			});
		});

		it("rejects update for a session from a different org", async () => {
			const { session } = await setupSeasonWithSession();

			const otherCtx = await createAuthContext();
			const otherClient = createTRPCTestClient({ sessionToken: otherCtx.sessionToken });

			await expect(
				otherClient.session.updateProposedLineup.mutate({
					sessionId: session.id,
					proposedLineup: {
						homePlayerIds: [],
						awayPlayerIds: [],
						rotatedOut: [],
						coinTossNeeded: null,
						selectedHomePlayerIds: [],
						selectedAwayPlayerIds: [],
					},
				})
			).rejects.toThrow();
		});
	});
});
