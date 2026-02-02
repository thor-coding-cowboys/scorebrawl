import { TRPCClientError } from "@trpc/client";
import { beforeEach, describe, expect, it } from "vitest";
import { createAuthContext } from "../setup/auth-context-util";
import { createPlayers } from "../setup/competition-context-util";
import { createTRPCTestClient } from "./trpc-test-client";

describe("competition router", () => {
	let sessionToken: string;

	beforeEach(async () => {
		const ctx = await createAuthContext();
		sessionToken = ctx.sessionToken;
	});

	it("lists all competitions for organization", async () => {
		const client = createTRPCTestClient({ sessionToken });

		const result = await client.competition.getAll.query();

		expect(result).toBeInstanceOf(Array);
	});

	it("creates a competition with players", async () => {
		const ctx = await createAuthContext();
		const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

		// Create players first
		await createPlayers(ctx, 3);

		const result = await client.competition.create.mutate({
			name: "Test Competition",
			initialScore: 1000,
			scoreType: "elo",
			kFactor: 32,
			startDate: new Date(),
		});

		expect(result).toBeDefined();
		expect(result.name).toBe("Test Competition");
		expect(result.slug).toBeDefined();
	});

	it("fails to create competition without enough players", async () => {
		const ctx = await createAuthContext();
		const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

		// Don't create any players

		await expect(
			client.competition.create.mutate({
				name: "Test Competition",
				initialScore: 1000,
				scoreType: "elo",
				kFactor: 32,
				startDate: new Date(),
			})
		).rejects.toThrow(TRPCClientError);
	});

	it("gets competition by slug", async () => {
		const ctx = await createAuthContext();
		const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

		// Create players and competition
		await createPlayers(ctx, 2);
		const competition = await client.competition.create.mutate({
			name: "Test Competition",
			initialScore: 1000,
			scoreType: "elo",
			kFactor: 32,
			startDate: new Date(),
		});

		const result = await client.competition.getBySlug.query({
			competitionSlug: competition.slug,
		});

		expect(result.id).toBe(competition.id);
		expect(result.name).toBe("Test Competition");
	});

	it("updates competition closed status", async () => {
		const ctx = await createAuthContext();
		const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

		// Create players and competition
		await createPlayers(ctx, 2);
		const competition = await client.competition.create.mutate({
			name: "Test Competition",
			initialScore: 1000,
			scoreType: "elo",
			kFactor: 32,
			startDate: new Date(),
		});

		const result = await client.competition.updateClosedStatus.mutate({
			competitionSlug: competition.slug,
			closed: true,
		});

		expect(result.closed).toBe(true);
	});

	it("returns unauthorized without session", async () => {
		const client = createTRPCTestClient();

		await expect(client.competition.getAll.query()).rejects.toThrow(TRPCClientError);
	});
});
