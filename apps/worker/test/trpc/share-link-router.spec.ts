import { SELF } from "cloudflare:test";
import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { describe, expect, it, beforeEach } from "vitest";
import { getDb } from "../../src/db/index";
import { shareLink } from "../../src/db/schema/share-schema";
import { createAuthContext, type AuthContext } from "../setup/auth-context-util";
import { createPlayers } from "../setup/season-context-util";
import { createTRPCTestClient } from "./trpc-test-client";

const KEY_PATTERN = /\/shared\/leagues\/([^/]+)\/seasons\/([^/]+)\/standings\/([a-f0-9]{32})$/;

async function createSeasonWithPlayers(ctx: AuthContext, count = 3) {
	await createPlayers(ctx, count);
	const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });
	return client.season.create.mutate({
		name: "Share Season",
		initialScore: 1000,
		scoreType: "elo",
		kFactor: 32,
		startDate: new Date(),
	});
}

async function enableSharing(ctx: AuthContext) {
	const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });
	await client.shareSetting.update.mutate({ allowPublicShares: true });
}

function resolve(key: string) {
	return SELF.fetch(`http://example.com/api/share/links/${key}`);
}

describe("share links", () => {
	let ctx: AuthContext;
	let seasonSlug: string;
	let client: ReturnType<typeof createTRPCTestClient>;

	beforeEach(async () => {
		ctx = await createAuthContext();
		client = createTRPCTestClient({ sessionToken: ctx.sessionToken });
		const season = await createSeasonWithPlayers(ctx);
		seasonSlug = season.slug;
	});

	it("is disabled by default", async () => {
		const setting = await client.shareSetting.get.query();
		expect(setting.allowPublicShares).toBe(false);

		await expect(client.shareLink.create.mutate({ seasonSlug, expiresIn: "7d" })).rejects.toThrow(
			/disabled/i
		);
	});

	it("creates a link, lists metadata only, and resolves display data", async () => {
		await enableSharing(ctx);

		const created = await client.shareLink.create.mutate({ seasonSlug, expiresIn: "7d" });
		expect(created.url).toMatch(KEY_PATTERN);
		expect(created.expiresAt).toBeInstanceOf(Date);

		const key = created.url.split("/").pop() as string;

		const links = await client.shareLink.list.query({ seasonSlug });
		expect(links).toHaveLength(1);
		expect(links[0]).not.toHaveProperty("url");
		expect(links[0].viewCount).toBe(0);

		const response = await resolve(key);
		expect(response.status).toBe(200);

		const body = (await response.json()) as {
			league: { id: string; name: string };
			season: { name: string };
			standings: Array<Record<string, unknown>>;
			recentMatches: unknown[];
		};

		expect(body.league.id).toBe(ctx.league.id);
		expect(body.season.name).toBe("Share Season");
		expect(body.standings).toHaveLength(3);
		expect(body.standings[0].rank).toBe(1);
		expect(body.standings[0]).not.toHaveProperty("userId");
		expect(body.standings[0]).not.toHaveProperty("isGuest");
		expect(body.standings[0]).not.toHaveProperty("playerId");
		expect(body.recentMatches).toEqual([]);
	});

	it("stores only the token hash", async () => {
		await enableSharing(ctx);
		const created = await client.shareLink.create.mutate({ seasonSlug, expiresIn: "never" });
		const key = created.url.split("/").pop() as string;

		const db = getDb(env.DB);
		const [row] = await db
			.select({ tokenHash: shareLink.tokenHash, expiresAt: shareLink.expiresAt })
			.from(shareLink)
			.where(eq(shareLink.id, created.id));

		expect(row.tokenHash).not.toBe(key);
		expect(row.tokenHash).toMatch(/^[a-f0-9]{64}$/);
		expect(row.expiresAt).toBeNull();
	});

	it("returns 410 for an expired link and 404 for an unknown one", async () => {
		await enableSharing(ctx);
		const created = await client.shareLink.create.mutate({ seasonSlug, expiresIn: "1h" });
		const key = created.url.split("/").pop() as string;

		const db = getDb(env.DB);
		await db
			.update(shareLink)
			.set({ expiresAt: new Date(Date.now() - 60_000) })
			.where(eq(shareLink.id, created.id));

		const expired = await resolve(key);
		expect(expired.status).toBe(410);
		const expiredBody = (await expired.json()) as { error: { code: string } };
		expect(expiredBody.error.code).toBe("expired");

		const unknown = await resolve("0".repeat(32));
		expect(unknown.status).toBe(404);

		const malformed = await SELF.fetch("http://example.com/api/share/links/not-a-key");
		expect(malformed.status).toBe(404);
	});

	it("returns 410 after revoking and 403 while sharing is disabled", async () => {
		await enableSharing(ctx);
		const created = await client.shareLink.create.mutate({ seasonSlug, expiresIn: "7d" });
		const key = created.url.split("/").pop() as string;

		await client.shareLink.revoke.mutate({ seasonSlug, id: created.id });
		const revoked = await resolve(key);
		expect(revoked.status).toBe(410);
		const revokedBody = (await revoked.json()) as { error: { code: string } };
		expect(revokedBody.error.code).toBe("revoked");

		const second = await client.shareLink.create.mutate({ seasonSlug, expiresIn: "7d" });
		const secondKey = second.url.split("/").pop() as string;

		const disabled = await client.shareSetting.update.mutate({ allowPublicShares: false });
		expect(disabled.revokedCount).toBeGreaterThanOrEqual(1);

		const blocked = await resolve(secondKey);
		expect(blocked.status).toBe(403);
		const blockedBody = (await blocked.json()) as { error: { code: string } };
		expect(blockedBody.error.code).toBe("sharing_disabled");

		const db = getDb(env.DB);
		const [row] = await db
			.select({ revokedAt: shareLink.revokedAt })
			.from(shareLink)
			.where(eq(shareLink.id, second.id));
		expect(row.revokedAt).not.toBeNull();
	});

	it("requires authentication and a season", async () => {
		const anonymous = createTRPCTestClient();
		await expect(anonymous.shareLink.list.query({ seasonSlug })).rejects.toThrow();

		await enableSharing(ctx);
		await expect(
			client.shareLink.create.mutate({ seasonSlug: "missing-season", expiresIn: "7d" })
		).rejects.toThrow(/Season not found/i);
	});
});
