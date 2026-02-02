import { TRPCClientError } from "@trpc/client";
import { beforeEach, describe, expect, it } from "vitest";
import { type AuthContext, createAuthContext } from "../setup/auth-context-util";
import { createTRPCTestClient } from "./trpc-test-client";

describe("team router", () => {
	let ctx: AuthContext;

	beforeEach(async () => {
		ctx = await createAuthContext();
	});

	it("creates a team", async () => {
		const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

		const result = await client.team.create.mutate({ name: "Engineering" });

		expect(result.team.name).toBe("Engineering");
	});

	it("lists teams", async () => {
		const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

		// Create a team first to ensure we have something to list
		await client.team.create.mutate({ name: "Engineering" });

		const result = await client.team.list.query({ limit: 10 });

		expect(result.teams).toBeInstanceOf(Array);
		expect(result.teams.length).toBeGreaterThan(0);
		expect(result.totalCount).toBeGreaterThan(0);
	});

	describe("pagination", () => {
		it("respects limit parameter", async () => {
			const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

			// Create 5 teams
			await Promise.all([
				client.team.create.mutate({ name: "Team 1" }),
				client.team.create.mutate({ name: "Team 2" }),
				client.team.create.mutate({ name: "Team 3" }),
				client.team.create.mutate({ name: "Team 4" }),
				client.team.create.mutate({ name: "Team 5" }),
			]);

			const result = await client.team.list.query({ limit: 3 });

			expect(result.teams).toHaveLength(3);
			expect(result.totalCount).toBeGreaterThanOrEqual(5);
		});

		it("returns nextCursor when there are more results", async () => {
			const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

			// Create 5 teams
			await Promise.all([
				client.team.create.mutate({ name: "Team 1" }),
				client.team.create.mutate({ name: "Team 2" }),
				client.team.create.mutate({ name: "Team 3" }),
				client.team.create.mutate({ name: "Team 4" }),
				client.team.create.mutate({ name: "Team 5" }),
			]);

			const result = await client.team.list.query({ limit: 3 });

			expect(result.nextCursor).not.toBeNull();
			expect(result.nextCursor).toBeTruthy();
		});

		it("returns null nextCursor when no more results", async () => {
			const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

			// Create 2 teams
			await Promise.all([
				client.team.create.mutate({ name: "Team 1" }),
				client.team.create.mutate({ name: "Team 2" }),
			]);

			const result = await client.team.list.query({ limit: 10 });

			expect(result.totalCount).toBeGreaterThanOrEqual(2);
			expect(result.teams.length).toBe(result.totalCount);
			expect(result.nextCursor).toBeNull();
		});

		it("paginates through multiple pages without duplicates", async () => {
			const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

			// Create 7 teams to ensure we have enough for multiple pages
			await Promise.all([
				client.team.create.mutate({ name: "Page Test 1" }),
				client.team.create.mutate({ name: "Page Test 2" }),
				client.team.create.mutate({ name: "Page Test 3" }),
				client.team.create.mutate({ name: "Page Test 4" }),
				client.team.create.mutate({ name: "Page Test 5" }),
				client.team.create.mutate({ name: "Page Test 6" }),
				client.team.create.mutate({ name: "Page Test 7" }),
			]);

			// First page
			const page1 = await client.team.list.query({ limit: 3 });
			expect(page1.teams).toHaveLength(3);
			expect(page1.nextCursor).not.toBeNull();
			const totalCount = page1.totalCount;

			// Second page
			const cursor1 = page1.nextCursor;
			if (!cursor1) throw new Error("Expected nextCursor");
			const page2 = await client.team.list.query({
				limit: 3,
				cursor: cursor1,
			});
			expect(page2.teams).toHaveLength(3);
			expect(page2.totalCount).toBe(totalCount);

			// Verify no overlap between pages
			const page1Ids = page1.teams.map((t) => t.id);
			const page2Ids = page2.teams.map((t) => t.id);
			const overlap = page1Ids.filter((id) => page2Ids.includes(id));
			expect(overlap).toHaveLength(0);
		});

		it("returns empty array when cursor is beyond last item", async () => {
			const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

			// Create 2 teams
			await Promise.all([
				client.team.create.mutate({ name: "Team 1" }),
				client.team.create.mutate({ name: "Team 2" }),
			]);

			const page1 = await client.team.list.query({ limit: 10 });
			expect(page1.nextCursor).toBeNull();

			// Use a cursor that doesn't exist (beyond last item)
			const page2 = await client.team.list.query({
				limit: 10,
				cursor: "zzzzzzzzzzzzzzzzzzzzzzzzzzz",
			});

			expect(page2.teams).toHaveLength(0);
			expect(page2.nextCursor).toBeNull();
		});
	});

	it("returns unauthorized without session", async () => {
		const client = createTRPCTestClient();

		await expect(client.team.list.query({ limit: 10 })).rejects.toThrow(TRPCClientError);
	});
});
