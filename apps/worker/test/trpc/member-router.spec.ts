import { TRPCClientError } from "@trpc/client";
import { beforeEach, describe, expect, it } from "vitest";
import { type AuthContext, createAuthContext } from "../setup/auth-context-util";
import { createTRPCTestClient } from "./trpc-test-client";

describe("member router", () => {
	let ctx: AuthContext;

	beforeEach(async () => {
		ctx = await createAuthContext();
	});

	it("lists members", async () => {
		const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

		const result = await client.member.list.query({ limit: 10 });

		expect(result.members).toBeInstanceOf(Array);
		// The creator should be a member
		expect(result.members.length).toBeGreaterThan(0);
		expect(result.members[0].user.email).toBe(ctx.user.email);
	});

	describe("pagination", () => {
		it("respects limit parameter", async () => {
			const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

			const result = await client.member.list.query({ limit: 1 });

			// At least the creator is a member
			expect(result.members).toHaveLength(1);
			expect(result.totalCount).toBeGreaterThan(0);
		});

		it("returns totalCount correctly", async () => {
			const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

			const result = await client.member.list.query({ limit: 10 });

			// Should have at least the creator as a member
			expect(result.totalCount).toBeGreaterThanOrEqual(1);
			expect(result.members.length).toBe(result.totalCount);
		});

		it("returns null nextCursor when no pagination needed", async () => {
			const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

			const result = await client.member.list.query({ limit: 10 });

			// With only one member (the creator), no pagination is needed
			expect(result.nextCursor).toBeNull();
		});

		it("returns empty array when cursor is beyond last item", async () => {
			const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

			const page1 = await client.member.list.query({ limit: 10 });
			expect(page1.nextCursor).toBeNull();

			// Use a cursor that doesn't exist (beyond last item)
			const page2 = await client.member.list.query({
				limit: 10,
				cursor: "zzzzzzzzzzzzzzzzzzzzzzzzzzz",
			});

			expect(page2.members).toHaveLength(0);
			expect(page2.nextCursor).toBeNull();
		});
	});

	it("returns unauthorized without session", async () => {
		const client = createTRPCTestClient();

		await expect(client.member.list.query({ limit: 10 })).rejects.toThrow(TRPCClientError);
	});
});
