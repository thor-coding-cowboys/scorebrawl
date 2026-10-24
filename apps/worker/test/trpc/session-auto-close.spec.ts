import { describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { SESSION_AUTO_CLOSE_TTL_MS } from "@coding-cowboys/scorebrawl-core/session";
import { getDb } from "../../src/db/index";
import { gameSession } from "../../src/db/schema/league-schema";
import { createAuthContext } from "../setup/auth-context-util";
import { createPlayers } from "../setup/season-context-util";
import { createTRPCTestClient } from "../trpc/trpc-test-client";

const MINUTE_MS = 60 * 1000;

async function setupSeasonWithPlayers(count = 4) {
	const ctx = await createAuthContext();
	const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

	await createPlayers(ctx, count);
	const season = await client.season.create.mutate({
		name: "Auto Close Season",
		initialScore: 1000,
		scoreType: "elo",
		kFactor: 32,
		startDate: new Date(),
	});
	const seasonPlayers = await client.seasonPlayer.getAll.query({ seasonSlug: season.slug });

	return { ctx, client, season, seasonPlayers };
}

function createSession(
	client: ReturnType<typeof createTRPCTestClient>,
	seasonSlug: string,
	seasonPlayerIds: string[],
	teamSize = 2
) {
	return client.session.create.mutate({
		seasonSlug,
		rotationMode: "winner-stays" as const,
		teamSize,
		maxConsecutiveGames: null,
		seasonPlayerIds,
	});
}

function expectCloseToHour(date: Date | null, reference = Date.now()) {
	expect(date).toBeInstanceOf(Date);
	const remaining = date!.getTime() - reference;
	expect(remaining).toBeGreaterThan(SESSION_AUTO_CLOSE_TTL_MS - 2 * MINUTE_MS);
	expect(remaining).toBeLessThanOrEqual(SESSION_AUTO_CLOSE_TTL_MS + MINUTE_MS);
}

async function setAutoEndsAt(sessionId: string, date: Date | null) {
	const db = getDb(env.DB);
	await db.update(gameSession).set({ autoEndsAt: date }).where(eq(gameSession.id, sessionId));
}

describe("session auto close", () => {
	it("sets a 1 hour deadline when the session starts", async () => {
		const { client, season, seasonPlayers } = await setupSeasonWithPlayers();

		const before = Date.now();
		const session = await createSession(
			client,
			season.slug,
			seasonPlayers.map((p) => p.id)
		);

		expectCloseToHour(session.autoEndsAt, before);
	});

	it("extends the deadline by 1 hour when a game is registered", async () => {
		const { client, season, seasonPlayers } = await setupSeasonWithPlayers();

		const session = await createSession(
			client,
			season.slug,
			seasonPlayers.map((p) => p.id)
		);
		await setAutoEndsAt(session.id, new Date(Date.now() + 5 * MINUTE_MS));

		await client.session.startNextMatch.mutate({
			sessionId: session.id,
			homeSeasonPlayerIds: [seasonPlayers[0].id, seasonPlayers[1].id],
			awaySeasonPlayerIds: [seasonPlayers[2].id, seasonPlayers[3].id],
		});

		const withMatch = await client.session.getById.query({ sessionId: session.id });
		const match = withMatch.matches.find((m) => m.result === null);
		expect(match).toBeDefined();

		const before = Date.now();
		await client.session.recordResult.mutate({
			sessionId: session.id,
			sessionMatchId: match!.id,
			homeScore: 3,
			awayScore: 1,
		});

		const ended = await client.session.getById.query({ sessionId: session.id });
		expectCloseToHour(ended.autoEndsAt, before);
	});

	it("extends the deadline by 1 hour from the extend mutation", async () => {
		const { client, season, seasonPlayers } = await setupSeasonWithPlayers();

		const session = await createSession(
			client,
			season.slug,
			seasonPlayers.map((p) => p.id)
		);
		await setAutoEndsAt(session.id, new Date(Date.now() + 5 * MINUTE_MS));

		const before = Date.now();
		const extended = await client.session.extend.mutate({ sessionId: session.id });

		expectCloseToHour(extended.autoEndsAt, before);

		const active = await client.session.getActive.query({ seasonSlug: season.slug });
		expect(active?.id).toBe(session.id);
		expectCloseToHour(active!.autoEndsAt, before);
	});

	it("lazily ends an expired session on getActive", async () => {
		const { client, season, seasonPlayers } = await setupSeasonWithPlayers();

		const session = await createSession(
			client,
			season.slug,
			seasonPlayers.map((p) => p.id)
		);
		await setAutoEndsAt(session.id, new Date(Date.now() - MINUTE_MS));

		const active = await client.session.getActive.query({ seasonSlug: season.slug });
		expect(active).toBeNull();

		const ended = await client.session.getById.query({ sessionId: session.id });
		expect(ended.status).toBe("ended");
		expect(ended.endedAt).toBeInstanceOf(Date);
	});

	it("does not end a session that is not expired", async () => {
		const { client, season, seasonPlayers } = await setupSeasonWithPlayers();

		const session = await createSession(
			client,
			season.slug,
			seasonPlayers.map((p) => p.id)
		);
		await setAutoEndsAt(session.id, new Date(Date.now() + MINUTE_MS));

		const active = await client.session.getActive.query({ seasonSlug: season.slug });
		expect(active?.id).toBe(session.id);
	});

	it("leaves sessions without a deadline untouched", async () => {
		const { client, season, seasonPlayers } = await setupSeasonWithPlayers();

		const session = await createSession(
			client,
			season.slug,
			seasonPlayers.map((p) => p.id)
		);
		await setAutoEndsAt(session.id, null);

		const active = await client.session.getActive.query({ seasonSlug: season.slug });
		expect(active?.id).toBe(session.id);
	});

	it("rejects extending an ended session", async () => {
		const { client, season, seasonPlayers } = await setupSeasonWithPlayers();

		const session = await createSession(
			client,
			season.slug,
			seasonPlayers.map((p) => p.id)
		);
		await client.session.end.mutate({ sessionId: session.id });

		await expect(client.session.extend.mutate({ sessionId: session.id })).rejects.toThrow(
			"Active session not found"
		);
	});
});
