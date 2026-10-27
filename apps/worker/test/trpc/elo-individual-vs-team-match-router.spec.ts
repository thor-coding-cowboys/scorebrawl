import { describe, expect, it } from "vitest";
import { createAuthContext } from "../setup/auth-context-util";
import { createPlayers } from "../setup/season-context-util";
import { createTRPCTestClient } from "./trpc-test-client";

describe("elo-individual-vs-team", () => {
	async function createIndividualVsTeamSeason(playerCount = 4) {
		const ctx = await createAuthContext();
		const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });
		await createPlayers(ctx, playerCount);
		const season = await client.season.create.mutate({
			name: "Individual vs Team",
			initialScore: 1000,
			scoreType: "elo-individual-vs-team",
			kFactor: 32,
			startDate: new Date(),
		});
		const seasonPlayers = await client.seasonPlayer.getAll.query({
			seasonSlug: season.slug,
		});
		return { client, season, seasonPlayers };
	}

	it("creates an elo-individual-vs-team season with elo settings", async () => {
		const { season, seasonPlayers } = await createIndividualVsTeamSeason(2);

		expect(season.scoreType).toBe("elo-individual-vs-team");
		expect(season.initialScore).toBe(1000);
		expect(season.kFactor).toBe(32);
		expect(season.rounds).toBeNull();
		expect(seasonPlayers.every((p) => p.score === 1000)).toBe(true);
	});

	it("records a 1v2 match and weights the team by rating", async () => {
		const { client, season, seasonPlayers } = await createIndividualVsTeamSeason(3);
		const [solo, t1, t2] = seasonPlayers;

		await client.match.create.mutate({
			seasonSlug: season.slug,
			homeScore: 1,
			awayScore: 0,
			homeTeamPlayerIds: [solo.id],
			awayTeamPlayerIds: [t1.id, t2.id],
		});

		const standing = await client.seasonPlayer.getStanding.query({ seasonSlug: season.slug });
		const byId = new Map(standing.map((p) => [p.id, p]));
		expect(byId.get(solo.id)?.score).toBe(1016);
		expect(byId.get(solo.id)?.winCount).toBe(1);
		expect(byId.get(t1.id)?.score).toBe(984);
		expect(byId.get(t2.id)?.score).toBe(984);
		expect(byId.get(t1.id)?.lossCount).toBe(1);
		expect(standing[0]?.id).toBe(solo.id);
	});

	it("records 1v3 and 2v2 matches", async () => {
		const { client, season, seasonPlayers } = await createIndividualVsTeamSeason(4);
		const [p0, p1, p2, p3] = seasonPlayers;

		await client.match.create.mutate({
			seasonSlug: season.slug,
			homeScore: 0,
			awayScore: 1,
			homeTeamPlayerIds: [p0.id],
			awayTeamPlayerIds: [p1.id, p2.id, p3.id],
		});
		await client.match.create.mutate({
			seasonSlug: season.slug,
			homeScore: 2,
			awayScore: 1,
			homeTeamPlayerIds: [p0.id, p1.id],
			awayTeamPlayerIds: [p2.id, p3.id],
		});

		const { total } = await client.match.getAll.query({ seasonSlug: season.slug });
		expect(total).toBe(2);

		const standing = await client.seasonPlayer.getStanding.query({ seasonSlug: season.slug });
		expect(standing.every((p) => p.matchCount >= 1)).toBe(true);
		expect(standing.find((p) => p.id === p0.id)?.matchCount).toBe(2);
	});

	it("keeps a 2-player side apart from a 3-player team that contains it", async () => {
		const { client, season, seasonPlayers } = await createIndividualVsTeamSeason(5);
		const [a, b, c, d, e] = seasonPlayers;

		await client.match.create.mutate({
			seasonSlug: season.slug,
			homeScore: 1,
			awayScore: 0,
			homeTeamPlayerIds: [a.id, b.id],
			awayTeamPlayerIds: [c.id, d.id, e.id],
		});
		await client.match.create.mutate({
			seasonSlug: season.slug,
			homeScore: 1,
			awayScore: 0,
			homeTeamPlayerIds: [c.id, d.id],
			awayTeamPlayerIds: [a.id, b.id],
		});

		const teams = await client.seasonTeam.getStanding.query({ seasonSlug: season.slug });
		expect(teams).toHaveLength(3);
		expect(teams.map((t) => t.matchCount).sort()).toEqual([1, 1, 2]);
	});

	it("rejects a player on both sides", async () => {
		const { client, season, seasonPlayers } = await createIndividualVsTeamSeason(3);
		const [p0, p1] = seasonPlayers;

		await expect(
			client.match.create.mutate({
				seasonSlug: season.slug,
				homeScore: 1,
				awayScore: 0,
				homeTeamPlayerIds: [p0.id],
				awayTeamPlayerIds: [p0.id, p1.id],
			})
		).rejects.toThrow("Duplicate players in match");
	});

	it("rejects an empty side", async () => {
		const { client, season, seasonPlayers } = await createIndividualVsTeamSeason(2);

		await expect(
			client.match.create.mutate({
				seasonSlug: season.slug,
				homeScore: 1,
				awayScore: 0,
				homeTeamPlayerIds: [],
				awayTeamPlayerIds: seasonPlayers.map((p) => p.id),
			})
		).rejects.toThrow("Each team must have at least one player");
	});
});
