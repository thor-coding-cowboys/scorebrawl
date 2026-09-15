import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "../../src/db/index";
import { pushToken } from "../../src/db/schema/user-preferences-schema";
import { type AuthContext, createAuthContext, createUser } from "../setup/auth-context-util";
import { createTRPCTestClient } from "./trpc-test-client";

describe("notification router", () => {
	let ctx: AuthContext;

	beforeEach(async () => {
		ctx = await createAuthContext();
	});

	describe("registerToken", () => {
		it("registers a token owned by the current user", async () => {
			const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });
			const result = await client.notification.registerToken.mutate({
				token: "ExponentPushToken[one]",
				platform: "ios",
			});
			expect(result.success).toBe(true);

			const db = getDb(env.DB);
			const rows = await db
				.select()
				.from(pushToken)
				.where(eq(pushToken.token, "ExponentPushToken[one]"));
			expect(rows).toHaveLength(1);
			expect(rows[0].userId).toBe(ctx.user.id);
		});

		it("upserts an existing token instead of duplicating", async () => {
			const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });
			await client.notification.registerToken.mutate({
				token: "ExponentPushToken[dup]",
				platform: "ios",
			});
			await client.notification.registerToken.mutate({
				token: "ExponentPushToken[dup]",
				platform: "ios",
				deviceName: "iPhone",
			});

			const db = getDb(env.DB);
			const rows = await db
				.select()
				.from(pushToken)
				.where(eq(pushToken.token, "ExponentPushToken[dup]"));
			expect(rows).toHaveLength(1);
			expect(rows[0].deviceName).toBe("iPhone");
		});
	});

	describe("unregisterToken", () => {
		it("removes the current user's token", async () => {
			const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });
			await client.notification.registerToken.mutate({
				token: "ExponentPushToken[remove]",
				platform: "ios",
			});
			const result = await client.notification.unregisterToken.mutate({
				token: "ExponentPushToken[remove]",
			});
			expect(result.success).toBe(true);

			const db = getDb(env.DB);
			const rows = await db
				.select()
				.from(pushToken)
				.where(eq(pushToken.token, "ExponentPushToken[remove]"));
			expect(rows).toHaveLength(0);
		});

		it("does not remove another user's token", async () => {
			const other = await createUser();
			const otherClient = createTRPCTestClient({ sessionToken: other.sessionToken });
			await otherClient.notification.registerToken.mutate({
				token: "ExponentPushToken[other]",
				platform: "ios",
			});

			const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });
			await client.notification.unregisterToken.mutate({
				token: "ExponentPushToken[other]",
			});

			const db = getDb(env.DB);
			const rows = await db
				.select()
				.from(pushToken)
				.where(eq(pushToken.token, "ExponentPushToken[other]"));
			expect(rows).toHaveLength(1);
		});
	});

	describe("getSettings", () => {
		it("returns all-enabled settings by default", async () => {
			const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });
			const settings = await client.notification.getSettings.query();
			expect(settings).toEqual({
				pushEnabled: true,
				notifySessionStarted: true,
				notifyMatchRecorded: true,
				notifyAchievementUnlocked: true,
				notifyStreakReached: true,
			});
		});
	});

	describe("updateSettings", () => {
		it("persists a partial update", async () => {
			const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });
			await client.notification.updateSettings.mutate({ notifySessionStarted: false });
			const settings = await client.notification.getSettings.query();
			expect(settings.notifySessionStarted).toBe(false);
			expect(settings.notifyMatchRecorded).toBe(true);
		});
	});
});
