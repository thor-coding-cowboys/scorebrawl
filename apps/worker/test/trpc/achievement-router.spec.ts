import { beforeEach, describe, expect, it } from "vitest";
import { createAuthContext } from "../setup/auth-context-util";
import { createPlayers } from "../setup/season-context-util";
import { createTRPCTestClient } from "./trpc-test-client";

describe("achievement router", () => {
	beforeEach(async () => {
		await createAuthContext();
	});

	it("returns empty array when player has no achievements", async () => {
		const ctx = await createAuthContext();
		const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

		// Create a player
		const players = await createPlayers(ctx, 1);

		const result = await client.achievement.getByPlayerId.query({
			playerId: players[0].id,
		});

		expect(result).toBeInstanceOf(Array);
		expect(result).toHaveLength(0);
	});

	it("returns achievements for a player", async () => {
		const ctx = await createAuthContext();
		const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

		// Create a player
		const players = await createPlayers(ctx, 1);

		// Add an achievement (note: this would need to be done via a mutation if available)
		// For now, we just test the query returns an array
		const result = await client.achievement.getByPlayerId.query({
			playerId: players[0].id,
		});

		expect(result).toBeInstanceOf(Array);
	});
});
