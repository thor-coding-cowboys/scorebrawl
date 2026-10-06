import { TRPCClientError } from "@trpc/client";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { getDb } from "../../src/db";
import { user } from "../../src/db/schema/auth-schema";
import { createAuthContext, type AuthContext } from "../setup/auth-context-util";
import { createTRPCTestClient } from "./trpc-test-client";

async function promoteToAdmin(userId: string) {
	const db = getDb(env.DB);
	await db.update(user).set({ role: "admin" }).where(eq(user.id, userId));
}

describe("admin router", () => {
	let ctx: AuthContext;
	let adminToken: string;

	beforeEach(async () => {
		ctx = await createAuthContext();
		await promoteToAdmin(ctx.user.id);
		adminToken = ctx.sessionToken;
	});

	describe("oauthClients.update", () => {
		it("updates name, redirect uris, scopes, skip consent and disabled", async () => {
			const client = createTRPCTestClient({ sessionToken: adminToken });

			const created = await client.admin.oauthClients.create.mutate({
				name: "Before",
				redirectUris: ["https://app.example.com/callback"],
				scopes: ["openid", "email"],
				publicClient: true,
				requirePkce: true,
				skipConsent: false,
			});

			const result = await client.admin.oauthClients.update.mutate({
				clientId: created.client_id,
				name: "After",
				redirectUris: ["https://app.example.com/new-callback"],
				scopes: ["openid", "profile", "email"],
				skipConsent: true,
				disabled: true,
			});

			expect(result.updated).toBe(true);

			const clients = await client.admin.oauthClients.list.query();
			const updated = clients.find((c) => c.clientId === created.client_id);

			expect(updated?.name).toBe("After");
			expect(updated?.redirectUris).toEqual(["https://app.example.com/new-callback"]);
			expect(updated?.scopes).toEqual(["openid", "profile", "email"]);
			expect(updated?.skipConsent).toBe(true);
			expect(updated?.disabled).toBe(true);
		});

		it("returns updated false for an unknown client id", async () => {
			const client = createTRPCTestClient({ sessionToken: adminToken });

			const result = await client.admin.oauthClients.update.mutate({
				clientId: "does-not-exist",
				name: "Ghost",
				redirectUris: ["https://app.example.com/callback"],
				scopes: ["openid"],
				skipConsent: false,
				disabled: false,
			});

			expect(result.updated).toBe(false);
		});

		it("rejects an empty scope list", async () => {
			const client = createTRPCTestClient({ sessionToken: adminToken });

			await expect(
				client.admin.oauthClients.update.mutate({
					clientId: "some-client",
					name: "No scopes",
					redirectUris: ["https://app.example.com/callback"],
					scopes: [],
					skipConsent: false,
					disabled: false,
				})
			).rejects.toThrow(TRPCClientError);
		});

		it("rejects non-admin users", async () => {
			const nonAdmin = await createAuthContext();
			const client = createTRPCTestClient({ sessionToken: nonAdmin.sessionToken });

			await expect(
				client.admin.oauthClients.update.mutate({
					clientId: "some-client",
					name: "Nope",
					redirectUris: ["https://app.example.com/callback"],
					scopes: ["openid"],
					skipConsent: false,
					disabled: false,
				})
			).rejects.toThrow(TRPCClientError);
		});
	});
});
