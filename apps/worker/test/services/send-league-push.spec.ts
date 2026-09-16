import { env } from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getDb } from "../../src/db/index";
import { member } from "../../src/db/schema/auth-schema";
import { pushToken, userPreference } from "../../src/db/schema/user-preferences-schema";
import { sendLeaguePush } from "../../src/services/push-notification";
import { createAuthContext, createUser } from "../setup/auth-context-util";

describe("sendLeaguePush", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	async function setupLeagueWithSecondMember() {
		const db = getDb(env.DB);
		const ctx = await createAuthContext();
		const other = await createUser();

		await db.insert(member).values({
			id: crypto.randomUUID(),
			organizationId: ctx.league.id,
			userId: other.user.id,
			role: "member",
			createdAt: new Date(),
		});

		await db.insert(pushToken).values([
			{
				id: crypto.randomUUID(),
				userId: ctx.user.id,
				token: "token-owner",
				platform: "ios",
				createdAt: new Date(),
				updatedAt: new Date(),
			},
			{
				id: crypto.randomUUID(),
				userId: other.user.id,
				token: "token-other",
				platform: "ios",
				createdAt: new Date(),
				updatedAt: new Date(),
			},
		]);

		const fetchMock = vi.fn(
			async () => new Response(JSON.stringify({ data: [] }), { status: 200 })
		);
		vi.stubGlobal("fetch", fetchMock);

		return { db, ctx, other, fetchMock };
	}

	function sentMessages(fetchMock: ReturnType<typeof vi.fn>) {
		const calls = fetchMock.mock.calls as Array<[string, RequestInit]>;
		return calls.flatMap(
			([, init]) => JSON.parse(init.body as string) as Array<{ to: string; data: { type: string } }>
		);
	}

	it("excludes the actor but delivers to other members", async () => {
		const { db, ctx, fetchMock } = await setupLeagueWithSecondMember();

		await sendLeaguePush({
			db,
			organizationId: ctx.league.id,
			events: [
				{
					title: "Match recorded",
					body: "Ada 1-0 Bob",
					payload: {
						type: "match:recorded",
						leagueSlug: "league",
						seasonSlug: "season",
						matchId: "match",
					},
					excludeUserId: ctx.user.id,
				},
			],
		});

		expect(fetchMock).toHaveBeenCalledTimes(1);
		const messages = sentMessages(fetchMock);
		expect(messages).toHaveLength(1);
		expect(messages[0].to).toBe("token-other");
	});

	it("skips members whose master toggle is off", async () => {
		const { db, ctx, other, fetchMock } = await setupLeagueWithSecondMember();
		await db.insert(userPreference).values({
			userId: other.user.id,
			pushEnabled: false,
			createdAt: new Date(),
			updatedAt: new Date(),
		});

		await sendLeaguePush({
			db,
			organizationId: ctx.league.id,
			events: [
				{
					title: "Match recorded",
					body: "Ada 1-0 Bob",
					payload: {
						type: "match:recorded",
						leagueSlug: "league",
						seasonSlug: "season",
						matchId: "match",
					},
				},
			],
		});

		const messages = sentMessages(fetchMock);
		expect(messages).toHaveLength(1);
		expect(messages[0].to).toBe("token-owner");
	});

	it("skips members whose per-event toggle is off", async () => {
		const { db, ctx, other, fetchMock } = await setupLeagueWithSecondMember();
		await db.insert(userPreference).values({
			userId: other.user.id,
			notifyMatchRecorded: false,
			createdAt: new Date(),
			updatedAt: new Date(),
		});

		await sendLeaguePush({
			db,
			organizationId: ctx.league.id,
			events: [
				{
					title: "Match recorded",
					body: "Ada 1-0 Bob",
					payload: {
						type: "match:recorded",
						leagueSlug: "league",
						seasonSlug: "season",
						matchId: "match",
					},
				},
			],
		});

		const messages = sentMessages(fetchMock);
		expect(messages).toHaveLength(1);
		expect(messages[0].to).toBe("token-owner");
	});

	it("excludes the actor only from events carrying excludeUserId", async () => {
		const { db, ctx, fetchMock } = await setupLeagueWithSecondMember();

		await sendLeaguePush({
			db,
			organizationId: ctx.league.id,
			events: [
				{
					title: "Match recorded",
					body: "Ada 1-0 Bob",
					payload: {
						type: "match:recorded",
						leagueSlug: "league",
						seasonSlug: "season",
						matchId: "match",
					},
					excludeUserId: ctx.user.id,
				},
				{
					title: "Session started",
					body: "Ada started a session",
					payload: {
						type: "session:start",
						leagueSlug: "league",
						seasonSlug: "season",
						sessionId: "session",
					},
				},
			],
		});

		expect(fetchMock).toHaveBeenCalledTimes(1);
		const messages = sentMessages(fetchMock);
		const ownerMessages = messages.filter((message) => message.to === "token-owner");
		const otherMessages = messages.filter((message) => message.to === "token-other");
		expect(ownerMessages.map((message) => message.data.type)).toEqual(["session:start"]);
		expect(otherMessages.map((message) => message.data.type)).toEqual([
			"match:recorded",
			"session:start",
		]);
	});
});
