import { env } from "cloudflare:test";
import { describe, expect, it, beforeEach } from "vitest";
import { getDb } from "../../src/db/index";
import { playerAchievement } from "../../src/db/schema/league-schema";
import { createAuthContext } from "../setup/auth-context-util";
import { createPlayers } from "../setup/season-context-util";
import { createTRPCTestClient } from "./trpc-test-client";

async function seedAchievement(playerId: string, type: "5_win_streak" | "10_win_streak") {
	const db = getDb(env.DB);
	const now = new Date();
	await db.insert(playerAchievement).values({
		id: crypto.randomUUID(),
		playerId,
		type,
		createdAt: now,
		updatedAt: now,
	});
	return now;
}

describe("achievement router", () => {
	let ctx: Awaited<ReturnType<typeof createAuthContext>>;
	let client: ReturnType<typeof createTRPCTestClient>;

	beforeEach(async () => {
		ctx = await createAuthContext();
		client = createTRPCTestClient({ sessionToken: ctx.sessionToken });
	});

	it("returns achievements with createdAt for a player", async () => {
		const [player] = await createPlayers(ctx, 2);
		const now = await seedAchievement(player.id, "5_win_streak");

		const result = await client.achievement.getByPlayerId.query({ playerId: player.id });

		expect(result).toHaveLength(1);
		expect(result[0].type).toBe("5_win_streak");
		expect(result[0].createdAt).toBeInstanceOf(Date);
		expect(result[0].createdAt.getTime()).toBe(Math.floor(now.getTime() / 1000) * 1000);
	});

	it("returns empty list for a player with no achievements", async () => {
		const [player] = await createPlayers(ctx, 1);

		const result = await client.achievement.getByPlayerId.query({ playerId: player.id });

		expect(result).toHaveLength(0);
	});

	it("returns league board with player info", async () => {
		const players = await createPlayers(ctx, 2);
		await seedAchievement(players[0].id, "5_win_streak");
		await seedAchievement(players[0].id, "10_win_streak");
		await seedAchievement(players[1].id, "5_win_streak");

		const result = await client.achievement.getLeagueBoard.query();

		expect(result).toHaveLength(3);
		expect(result.every((r) => r.playerId === players[0].id || r.playerId === players[1].id)).toBe(
			true
		);
		expect(result.every((r) => r.name && r.createdAt instanceof Date)).toBe(true);
	});

	it("scopes league board to the current league only", async () => {
		const [player] = await createPlayers(ctx, 1);
		await seedAchievement(player.id, "5_win_streak");

		const otherCtx = await createAuthContext();
		const otherClient = createTRPCTestClient({ sessionToken: otherCtx.sessionToken });

		const result = await otherClient.achievement.getLeagueBoard.query();

		expect(result).toHaveLength(0);
	});
});
