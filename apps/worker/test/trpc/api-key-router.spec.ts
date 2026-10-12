import { env } from "cloudflare:test";
import { randUuid } from "@ngneat/falso";
import { TRPCClientError } from "@trpc/client";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "../../src/db/index";
import { member, session } from "../../src/db/schema/auth-schema";
import { type AuthContext, createAuthContext, createUser } from "../setup/auth-context-util";
import { createTRPCTestClient } from "./trpc-test-client";

type TestClient = ReturnType<typeof createTRPCTestClient>;

async function addMemberToLeague(ctx: AuthContext, role: string) {
	const db = getDb(env.DB);
	const memberUser = await createUser();
	await db.insert(member).values({
		id: randUuid(),
		organizationId: ctx.league.id,
		userId: memberUser.user.id,
		role,
		createdAt: new Date(),
	});
	await db
		.update(session)
		.set({ activeOrganizationId: ctx.league.id, updatedAt: new Date() })
		.where(eq(session.userId, memberUser.user.id));
	return memberUser;
}

async function errorCode(fn: () => Promise<unknown>): Promise<string | undefined> {
	try {
		await fn();
	} catch (err) {
		if (err instanceof TRPCClientError) return err.data?.code;
		throw err;
	}
	return undefined;
}

describe("api key router", () => {
	let ctx: AuthContext;

	beforeEach(async () => {
		ctx = await createAuthContext();
	});

	it("creates an api key and returns the plaintext key once", async () => {
		const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

		const created = await client.apiKey.create.mutate({
			name: "CI key",
			scopes: ["session:start"],
			expiry: "30d",
		});

		expect(created.key).toMatch(/^sbk_/);
		expect(created.start.length).toBeGreaterThan(0);
		expect(created.name).toBe("CI key");
	});

	it("lists keys without exposing the secret key", async () => {
		const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

		const created = await client.apiKey.create.mutate({
			name: "Listed key",
			scopes: ["match:start", "match:log"],
			expiry: "never",
		});

		const keys = await client.apiKey.list.query();
		const item = keys.find((key) => key.id === created.id);

		expect(item).toBeDefined();
		expect(item).not.toHaveProperty("key");
		expect(item?.start).toBe(created.start);
		expect(item?.expiresAt).toBeNull();
		expect(item?.scopes).toEqual(expect.arrayContaining(["match:start", "match:log"]));
	});

	it("deletes a key and rejects deleting an unknown id", async () => {
		const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

		const created = await client.apiKey.create.mutate({
			name: "Delete me",
			scopes: ["session:stop"],
			expiry: "90d",
		});

		const result = await client.apiKey.delete.mutate({ id: created.id });
		expect(result.success).toBe(true);

		const keys = await client.apiKey.list.query();
		expect(keys.some((key) => key.id === created.id)).toBe(false);

		const code = await errorCode(() => client.apiKey.delete.mutate({ id: "unknown-id" }));
		expect(code).toBe("NOT_FOUND");
	});

	it("regenerates a key with a different secret", async () => {
		const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

		const created = await client.apiKey.create.mutate({
			name: "Original",
			scopes: ["session:start"],
			expiry: "30d",
		});

		const regenerated = await client.apiKey.regenerate.mutate({
			id: created.id,
			name: "Rotated",
			scopes: ["session:start", "match:lineup"],
			expiry: "1y",
		});

		expect(regenerated.key).toMatch(/^sbk_/);
		expect(regenerated.key).not.toBe(created.key);
		expect(regenerated.id).not.toBe(created.id);

		const keys = await client.apiKey.list.query();
		expect(keys.some((key) => key.id === created.id)).toBe(false);
		expect(keys.some((key) => key.id === regenerated.id)).toBe(true);
	});

	const nonOwnerCalls: { label: string; call: (client: TestClient) => Promise<unknown> }[] = [
		{
			label: "create",
			call: (client) =>
				client.apiKey.create.mutate({ name: "Nope", scopes: ["session:start"], expiry: "30d" }),
		},
		{ label: "list", call: (client) => client.apiKey.list.query() },
		{ label: "delete", call: (client) => client.apiKey.delete.mutate({ id: "unknown-id" }) },
		{
			label: "regenerate",
			call: (client) =>
				client.apiKey.regenerate.mutate({
					id: "unknown-id",
					name: "Nope",
					scopes: ["session:start"],
					expiry: "30d",
				}),
		},
	];

	it.each(nonOwnerCalls)("forbids non-owner members from $label", async ({ call }) => {
		const memberUser = await addMemberToLeague(ctx, "member");
		const client = createTRPCTestClient({ sessionToken: memberUser.sessionToken });

		const code = await errorCode(() => call(client));
		expect(code).toBe("FORBIDDEN");
	});

	it("isolates keys between leagues", async () => {
		const clientA = createTRPCTestClient({ sessionToken: ctx.sessionToken });
		const created = await clientA.apiKey.create.mutate({
			name: "League A key",
			scopes: ["session:start"],
			expiry: "never",
		});

		const otherCtx = await createAuthContext();
		const clientB = createTRPCTestClient({ sessionToken: otherCtx.sessionToken });

		const listB = await clientB.apiKey.list.query();
		expect(listB.some((key) => key.id === created.id)).toBe(false);

		const code = await errorCode(() => clientB.apiKey.delete.mutate({ id: created.id }));
		expect(code).toBe("NOT_FOUND");

		const listA = await clientA.apiKey.list.query();
		expect(listA.some((key) => key.id === created.id)).toBe(true);
	});
});
