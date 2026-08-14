import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { getDb } from "../../src/db/index";
import * as seasonPlayerRepository from "../../src/repositories/season-player-repository";
import { buildMatchInsertData } from "../../src/services/match-events";
import { createAuthContext } from "../setup/auth-context-util";
import { createPlayers } from "../setup/season-context-util";
import { createTRPCTestClient } from "../trpc/trpc-test-client";

describe("buildMatchInsertData", () => {
	it("includes scoreType and player names for a 1v1 match", async () => {
		const ctx = await createAuthContext();
		const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });
		await createPlayers(ctx, 2);
		const season = await client.season.create.mutate({
			name: "Enrich Test Season",
			initialScore: 1000,
			scoreType: "elo",
			kFactor: 32,
			startDate: new Date(),
		});
		const seasonPlayers = await client.seasonPlayer.getAll.query({ seasonSlug: season.slug });
		const match = await client.match.create.mutate({
			seasonSlug: season.slug,
			homeScore: 2,
			awayScore: 1,
			homeTeamPlayerIds: [seasonPlayers[0].id],
			awayTeamPlayerIds: [seasonPlayers[1].id],
		});

		const db = getDb(env.DB);
		const standings = await seasonPlayerRepository.getStanding({ db, seasonId: season.id });
		const data = await buildMatchInsertData(db, {
			match,
			scoreType: "elo",
			standings,
		});

		expect(data.scoreType).toBe("elo");
		expect(data.players).toHaveLength(2);
		expect(data.players.every((p) => p.name.length > 0)).toBe(true);
		expect(data.match.id).toBe(match.id);
		expect(data.standings.length).toBe(2);
	});

	it("includes team names for a 2v2 match", async () => {
		const ctx = await createAuthContext();
		const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });
		await createPlayers(ctx, 4);
		const season = await client.season.create.mutate({
			name: "Enrich 2v2 Season",
			initialScore: 1000,
			scoreType: "elo",
			kFactor: 32,
			startDate: new Date(),
		});
		const seasonPlayers = await client.seasonPlayer.getAll.query({ seasonSlug: season.slug });
		const match = await client.match.create.mutate({
			seasonSlug: season.slug,
			homeScore: 3,
			awayScore: 2,
			homeTeamPlayerIds: [seasonPlayers[0].id, seasonPlayers[1].id],
			awayTeamPlayerIds: [seasonPlayers[2].id, seasonPlayers[3].id],
		});

		const db = getDb(env.DB);
		const standings = await seasonPlayerRepository.getStanding({ db, seasonId: season.id });
		const data = await buildMatchInsertData(db, {
			match,
			scoreType: "elo",
			standings,
		});

		const home = data.players.filter((p) => p.homeTeam);
		const away = data.players.filter((p) => !p.homeTeam);
		expect(home).toHaveLength(2);
		expect(away).toHaveLength(2);
		expect(home.every((p) => p.teamName !== null)).toBe(true);
		expect(away.every((p) => p.teamName !== null)).toBe(true);
	});
});
