import { TRPCClientError } from "@trpc/client";
import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "../../src/db/index";
import { playerAchievement } from "../../src/db/schema/league-schema";
import { createAuthContext } from "../setup/auth-context-util";
import { createPlayers } from "../setup/season-context-util";
import { createTRPCTestClient } from "./trpc-test-client";

async function getAchievementTypes(playerId: string): Promise<string[]> {
	const db = getDb(env.DB);
	const rows = await db
		.select({ type: playerAchievement.type })
		.from(playerAchievement)
		.where(eq(playerAchievement.playerId, playerId));
	return rows.map((r) => r.type);
}

describe("season router", () => {
	let sessionToken: string;

	beforeEach(async () => {
		const ctx = await createAuthContext();
		sessionToken = ctx.sessionToken;
	});

	it("lists all seasons for league", async () => {
		const client = createTRPCTestClient({ sessionToken });

		const result = await client.season.getAll.query();

		expect(result).toBeInstanceOf(Array);
	});

	it("creates a season with players", async () => {
		const ctx = await createAuthContext();
		const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

		// Create players first
		await createPlayers(ctx, 3);

		const result = await client.season.create.mutate({
			name: "Test Season",
			initialScore: 1000,
			scoreType: "elo",
			kFactor: 32,
			startDate: new Date(),
		});

		expect(result).toBeDefined();
		expect(result.name).toBe("Test Season");
		expect(result.slug).toBeDefined();
	});

	it("fails to create season without enough players", async () => {
		const ctx = await createAuthContext();
		const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

		// Don't create any players

		await expect(
			client.season.create.mutate({
				name: "Test Season",
				initialScore: 1000,
				scoreType: "elo",
				kFactor: 32,
				startDate: new Date(),
			})
		).rejects.toThrow(TRPCClientError);
	});

	it("gets season by slug", async () => {
		const ctx = await createAuthContext();
		const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

		// Create players and season
		await createPlayers(ctx, 2);
		const season = await client.season.create.mutate({
			name: "Test Season",
			initialScore: 1000,
			scoreType: "elo",
			kFactor: 32,
			startDate: new Date(),
		});

		const result = await client.season.getBySlug.query({
			seasonSlug: season.slug,
		});

		expect(result.id).toBe(season.id);
		expect(result.name).toBe("Test Season");
	});

	it("updates season closed status", async () => {
		const ctx = await createAuthContext();
		const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

		// Create players and season
		await createPlayers(ctx, 2);
		const season = await client.season.create.mutate({
			name: "Test Season",
			initialScore: 1000,
			scoreType: "elo",
			kFactor: 32,
			startDate: new Date(),
		});

		const result = await client.season.updateClosedStatus.mutate({
			seasonSlug: season.slug,
			closed: true,
		});

		expect(result.closed).toBe(true);
	});

	it("checks slug availability within league scope", async () => {
		const ctx = await createAuthContext();
		const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

		// Create players first
		await createPlayers(ctx, 3);

		// Create a season with a specific slug
		await client.season.create.mutate({
			name: "Test Season",
			slug: "test-season",
			initialScore: 1000,
			scoreType: "elo",
			kFactor: 32,
			startDate: new Date(),
		});

		// Check that the slug is now taken within this league
		const slugTaken = await client.season.checkSlugAvailability.query({
			slug: "test-season",
		});
		expect(slugTaken.available).toBe(false);

		// Check that a different slug is available
		const differentSlug = await client.season.checkSlugAvailability.query({
			slug: "different-season",
		});
		expect(differentSlug.available).toBe(true);
	});

	it("returns unauthorized without session", async () => {
		const client = createTRPCTestClient();

		await expect(client.season.getAll.query()).rejects.toThrow(TRPCClientError);
	});
});

describe("season router — season_winner", () => {
	let ctx: Awaited<ReturnType<typeof createAuthContext>>;
	let client: ReturnType<typeof createTRPCTestClient>;

	beforeEach(async () => {
		ctx = await createAuthContext();
		client = createTRPCTestClient({ sessionToken: ctx.sessionToken });
	});

	it("grants season_winner to the top-scoring player when season is closed", async () => {
		await createPlayers(ctx, 2);
		const season = await client.season.create.mutate({
			name: "Winner Season",
			initialScore: 1000,
			scoreType: "elo",
			kFactor: 32,
			startDate: new Date(),
		});

		const standings = await client.seasonPlayer.getStanding.query({ seasonSlug: season.slug });
		const winner = standings[0];
		const loser = standings[1];

		// Winner gains elo, loser loses it
		await client.match.create.mutate({
			seasonSlug: season.slug,
			homeScore: 3,
			awayScore: 0,
			homeTeamPlayerIds: [winner.id],
			awayTeamPlayerIds: [loser.id],
		});

		await client.season.updateClosedStatus.mutate({ seasonSlug: season.slug, closed: true });

		const winnerTypes = await getAchievementTypes(winner.playerId);
		const loserTypes = await getAchievementTypes(loser.playerId);
		expect(winnerTypes).toContain("season_winner");
		expect(loserTypes).not.toContain("season_winner");
	});

	it("is idempotent when closing an already-closed season", async () => {
		await createPlayers(ctx, 2);
		const season = await client.season.create.mutate({
			name: "Winner Season",
			initialScore: 1000,
			scoreType: "elo",
			kFactor: 32,
			startDate: new Date(),
		});

		const standings = await client.seasonPlayer.getStanding.query({ seasonSlug: season.slug });
		await client.match.create.mutate({
			seasonSlug: season.slug,
			homeScore: 2,
			awayScore: 0,
			homeTeamPlayerIds: [standings[0].id],
			awayTeamPlayerIds: [standings[1].id],
		});

		await client.season.updateClosedStatus.mutate({ seasonSlug: season.slug, closed: true });
		await client.season.updateClosedStatus.mutate({ seasonSlug: season.slug, closed: true });

		const types = await getAchievementTypes(standings[0].playerId);
		expect(types.filter((t) => t === "season_winner")).toHaveLength(1);
	});

	it("does not revoke season_winner when season is reopened", async () => {
		await createPlayers(ctx, 2);
		const season = await client.season.create.mutate({
			name: "Winner Season",
			initialScore: 1000,
			scoreType: "elo",
			kFactor: 32,
			startDate: new Date(),
		});

		const standings = await client.seasonPlayer.getStanding.query({ seasonSlug: season.slug });
		await client.match.create.mutate({
			seasonSlug: season.slug,
			homeScore: 2,
			awayScore: 0,
			homeTeamPlayerIds: [standings[0].id],
			awayTeamPlayerIds: [standings[1].id],
		});

		await client.season.updateClosedStatus.mutate({ seasonSlug: season.slug, closed: true });
		const closedTypes = await getAchievementTypes(standings[0].playerId);
		expect(closedTypes).toContain("season_winner");

		// Reopening must not revoke the already-earned achievement
		await client.season.updateClosedStatus.mutate({ seasonSlug: season.slug, closed: false });
		const reopenedTypes = await getAchievementTypes(standings[0].playerId);
		expect(reopenedTypes).toContain("season_winner");
	});
});
