import { TRPCClientError } from "@trpc/client";
import { beforeEach, describe, expect, it } from "vitest";
import { createAuthContext } from "../setup/auth-context-util";
import { createPlayers } from "../setup/season-context-util";
import { createTRPCTestClient } from "./trpc-test-client";

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

	it("returns unauthorized without session", async () => {
		const client = createTRPCTestClient();

		await expect(client.season.getAll.query()).rejects.toThrow(TRPCClientError);
	});
});
