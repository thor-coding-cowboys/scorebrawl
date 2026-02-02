import { addDays, startOfDay } from "date-fns";
import { beforeEach, describe, expect, it } from "vitest";
import { createAuthContext } from "../setup/auth-context-util";
import { createPlayers } from "../setup/season-context-util";
import { createTRPCTestClient } from "./trpc-test-client";

describe("player router", () => {
	let sessionToken: string;

	beforeEach(async () => {
		const ctx = await createAuthContext();
		sessionToken = ctx.sessionToken;
	});

	it("lists all players in league", async () => {
		const client = createTRPCTestClient({ sessionToken });

		const result = await client.player.getAll.query();

		expect(result).toBeInstanceOf(Array);
	});

	it("creates players via auth context", async () => {
		const ctx = await createAuthContext();
		const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

		// Create players
		await createPlayers(ctx, 3);

		const result = await client.player.getAll.query();

		expect(result.length).toBeGreaterThanOrEqual(3);
	});

	it("gets player by id within season", async () => {
		const ctx = await createAuthContext();
		const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

		// Create players and season
		const players = await createPlayers(ctx, 2);
		const season = await client.season.create.mutate({
			name: "Test Season",
			initialScore: 1000,
			scoreType: "elo",
			kFactor: 32,
			startDate: addDays(startOfDay(new Date()), -1), // Yesterday to ensure season is active
		});

		const result = await client.player.getById.query({
			seasonSlug: season.slug,
			playerId: players[0].id,
		});

		expect(result).toBeDefined();
		expect(result.id).toBe(players[0].id);
	});
});
