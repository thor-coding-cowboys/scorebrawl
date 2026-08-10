import { describe, expect, it } from "vitest";
import { createAuthContext } from "../setup/auth-context-util";
import { createPlayers } from "../setup/season-context-util";
import { createTRPCTestClient } from "./trpc-test-client";

describe("1-v-n-elo", () => {
	async function createOneVnSeason(ctx: Awaited<ReturnType<typeof createAuthContext>>) {
		const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });
		await createPlayers(ctx, 4);
		const season = await client.season.create.mutate({
			name: "1-v-N Season",
			initialScore: 1000,
			scoreType: "1-v-n-elo",
			kFactor: 32,
			startDate: new Date(),
		});
		const seasonPlayers = await client.seasonPlayer.getAll.query({
			seasonSlug: season.slug,
		});
		return { client, season, seasonPlayers };
	}

	it("creates a 1-v-n-elo season", async () => {
		const ctx = await createAuthContext();
		const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });
		await createPlayers(ctx, 2);
		const season = await client.season.create.mutate({
			name: "1-v-N Season",
			initialScore: 1000,
			scoreType: "1-v-n-elo",
			kFactor: 32,
			startDate: new Date(),
		});
		expect(season.scoreType).toBe("1-v-n-elo");
		expect(season.rounds).toBeNull();
	});

	it("rejects rounds for 1-v-n-elo seasons", async () => {
		const ctx = await createAuthContext();
		const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });
		await createPlayers(ctx, 2);
		await expect(
			client.season.create.mutate({
				name: "1-v-N Season",
				initialScore: 1000,
				scoreType: "1-v-n-elo",
				kFactor: 32,
				rounds: 2,
				startDate: new Date(),
			})
		).rejects.toThrow("1-v-n-elo seasons do not use rounds");
	});

	it("records a 1v1 game and updates ratings", async () => {
		const ctx = await createAuthContext();
		const { client, season, seasonPlayers } = await createOneVnSeason(ctx);
		const [p0, p1] = seasonPlayers;

		const match = await client.match.createOneVn.mutate({
			seasonSlug: season.slug,
			winnerId: p0.id,
			loserIds: [p1.id],
		});

		expect(match).toBeDefined();

		const standing = await client.seasonPlayer.getStanding.query({ seasonSlug: season.slug });
		const winner = standing.find((p) => p.id === p0.id);
		const loser = standing.find((p) => p.id === p1.id);
		expect(winner?.score).toBeGreaterThan(1000);
		expect(loser?.score).toBeLessThan(1000);
		expect(winner?.winCount).toBe(1);
		expect(loser?.lossCount).toBe(1);
	});

	it("records a 4-player game: winner up, all losers down", async () => {
		const ctx = await createAuthContext();
		const { client, season, seasonPlayers } = await createOneVnSeason(ctx);
		const [p0, p1, p2, p3] = seasonPlayers;

		await client.match.createOneVn.mutate({
			seasonSlug: season.slug,
			winnerId: p0.id,
			loserIds: [p1.id, p2.id, p3.id],
		});

		const standing = await client.seasonPlayer.getStanding.query({ seasonSlug: season.slug });
		const winner = standing.find((p) => p.id === p0.id);
		for (const loser of [p1, p2, p3]) {
			const row = standing.find((p) => p.id === loser.id);
			expect(row?.score).toBeLessThan(1000);
		}
		expect(winner?.score).toBeGreaterThan(1000);
		expect(standing[0]?.id).toBe(p0.id);
	});

	it("rejects winner also in losers", async () => {
		const ctx = await createAuthContext();
		const { client, season, seasonPlayers } = await createOneVnSeason(ctx);
		const [p0, p1] = seasonPlayers;

		await expect(
			client.match.createOneVn.mutate({
				seasonSlug: season.slug,
				winnerId: p0.id,
				loserIds: [p0.id, p1.id],
			})
		).rejects.toThrow("Winner cannot also be a loser");
	});

	it("rejects a player not in the season", async () => {
		const ctx = await createAuthContext();
		const { client, season, seasonPlayers } = await createOneVnSeason(ctx);
		const [p0, p1] = seasonPlayers;

		await expect(
			client.match.createOneVn.mutate({
				seasonSlug: season.slug,
				winnerId: p0.id,
				loserIds: [p1.id, "nonexistent-id"],
			})
		).rejects.toThrow("All players must be in this season");
	});

	it("lists a recorded 1-v-n match", async () => {
		const ctx = await createAuthContext();
		const { client, season, seasonPlayers } = await createOneVnSeason(ctx);
		const [p0, p1, p2] = seasonPlayers;

		await client.match.createOneVn.mutate({
			seasonSlug: season.slug,
			winnerId: p0.id,
			loserIds: [p1.id, p2.id],
		});

		const result = await client.match.getAll.query({
			seasonSlug: season.slug,
			limit: 10,
			offset: 0,
		});
		expect(result.matches).toHaveLength(1);
	});
});
