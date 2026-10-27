import { describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { getDb } from "../../src/db/index";
import { gameSession } from "../../src/db/schema/league-schema";
import { createAuthContext } from "../setup/auth-context-util";
import { createPlayers } from "../setup/season-context-util";
import { createTRPCTestClient } from "../trpc/trpc-test-client";

const MINUTE_MS = 60 * 1000;

async function setupLeagueWithPlayers(count = 4) {
	const ctx = await createAuthContext();
	const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

	await createPlayers(ctx, count);

	return { ctx, client };
}

async function createSeason(client: ReturnType<typeof createTRPCTestClient>, name: string) {
	const season = await client.season.create.mutate({
		name,
		initialScore: 1000,
		scoreType: "elo",
		kFactor: 32,
		startDate: new Date(),
	});
	const seasonPlayers = await client.seasonPlayer.getAll.query({ seasonSlug: season.slug });

	return { season, seasonPlayerIds: seasonPlayers.map((p) => p.id) };
}

function startSession(
	client: ReturnType<typeof createTRPCTestClient>,
	seasonSlug: string,
	seasonPlayerIds: string[]
) {
	return client.session.create.mutate({
		seasonSlug,
		rotationMode: "winner-stays" as const,
		teamSize: 2,
		maxConsecutiveGames: null,
		seasonPlayerIds,
	});
}

async function setAutoEndsAt(sessionId: string, date: Date | null) {
	const db = getDb(env.DB);
	await db.update(gameSession).set({ autoEndsAt: date }).where(eq(gameSession.id, sessionId));
}

async function readSession(sessionId: string) {
	const db = getDb(env.DB);
	const [session] = await db.select().from(gameSession).where(eq(gameSession.id, sessionId));
	return session;
}

describe("single active session per league", () => {
	it("rejects starting a session in another season while one is active", async () => {
		const { client } = await setupLeagueWithPlayers();
		const first = await createSeason(client, "First Season");
		const second = await createSeason(client, "Second Season");

		const firstSession = await startSession(client, first.season.slug, first.seasonPlayerIds);

		await expect(startSession(client, second.season.slug, second.seasonPlayerIds)).rejects.toThrow(
			'A session is already active in "First Season"'
		);

		expect((await readSession(firstSession.id))?.status).toBe("active");
		expect(
			(await client.session.getActive.query({ seasonSlug: second.season.slug })) ?? null
		).toBeNull();
	});

	it("rejects starting a second session in the same season", async () => {
		const { client } = await setupLeagueWithPlayers();
		const first = await createSeason(client, "First Season");

		await startSession(client, first.season.slug, first.seasonPlayerIds);

		await expect(startSession(client, first.season.slug, first.seasonPlayerIds)).rejects.toThrow(
			'A session is already active in "First Season"'
		);
	});

	it("ends an expired session from another season before starting", async () => {
		const { client } = await setupLeagueWithPlayers();
		const first = await createSeason(client, "First Season");
		const second = await createSeason(client, "Second Season");

		const expired = await startSession(client, first.season.slug, first.seasonPlayerIds);
		await setAutoEndsAt(expired.id, new Date(Date.now() - MINUTE_MS));

		const started = await startSession(client, second.season.slug, second.seasonPlayerIds);

		expect(started.id).not.toBe(expired.id);
		expect((await readSession(expired.id))?.status).toBe("ended");
		expect((await readSession(started.id))?.status).toBe("active");
	});
});
