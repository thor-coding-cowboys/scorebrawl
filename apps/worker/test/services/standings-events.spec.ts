import { env as realEnv } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { SeasonRealtimeEvent } from "@coding-cowboys/scorebrawl-core/realtime";

import { getDb } from "../../src/db";
import * as matchRepository from "../../src/repositories/match-repository";
import { finalizeMatchCreation } from "../../src/services/match-creation";
import { removeMatch } from "../../src/services/match-removal";
import {
	deleteLastMatch,
	logMatch,
	updateLiveScore,
} from "../../src/services/session/session-actions";
import { createAuthContext } from "../setup/auth-context-util";
import { createPlayers } from "../setup/season-context-util";
import { createTRPCTestClient } from "../trpc/trpc-test-client";

const TEST_TIMEOUT = 30000;

function createBroadcastRecorder() {
	const events: SeasonRealtimeEvent[] = [];
	const pending: Promise<unknown>[] = [];

	const seasonSse = {
		idFromName: (name: string) => name,
		get: () => ({
			fetch: async (request: Request) => {
				events.push((await request.json()) as SeasonRealtimeEvent);
				return new Response("OK");
			},
		}),
	};

	const env = new Proxy(realEnv, {
		get(target, property, receiver) {
			if (property === "SEASON_SSE") return seasonSse;
			return Reflect.get(target, property, receiver);
		},
	}) as Env;

	return {
		env,
		events,
		waitUntil: (promise: Promise<unknown>) => {
			pending.push(promise);
		},
		settle: async () => {
			await Promise.allSettled(pending);
			pending.length = 0;
		},
	};
}

async function setupSeason(name: string) {
	const ctx = await createAuthContext();
	const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });
	await createPlayers(ctx, 4);
	const season = await client.season.create.mutate({
		name,
		initialScore: 1000,
		scoreType: "elo",
		kFactor: 32,
		startDate: new Date(),
	});
	const seasonPlayers = await client.seasonPlayer.getAll.query({ seasonSlug: season.slug });
	return { ctx, client, season, seasonPlayers };
}

async function setupInProgressSession(
	client: ReturnType<typeof createTRPCTestClient>,
	slug: string
) {
	const seasonPlayers = await client.seasonPlayer.getAll.query({ seasonSlug: slug });
	const created = await client.session.create.mutate({
		seasonSlug: slug,
		rotationMode: "winner-stays",
		teamSize: 1,
		maxConsecutiveGames: null,
		seasonPlayerIds: seasonPlayers.map((player) => player.id),
	});
	const full = await client.session.getById.query({ sessionId: created.id });
	const lineup = full.proposedLineup;
	if (!lineup) throw new Error("Expected a proposed lineup");

	const toSeasonPlayerIds = (sessionPlayerIds: string[]) =>
		sessionPlayerIds.map((id) => full.players.find((player) => player.id === id)!.seasonPlayerId);

	await client.session.startNextMatch.mutate({
		sessionId: created.id,
		homeSeasonPlayerIds: toSeasonPlayerIds(lineup.homePlayerIds),
		awaySeasonPlayerIds: toSeasonPlayerIds(lineup.awayPlayerIds),
	});

	const withMatch = await client.session.getById.query({ sessionId: created.id });
	const match = withMatch.matches.find((candidate) => candidate.result === null);
	if (!match) throw new Error("Expected an in-progress session match");

	return { sessionId: created.id, sessionMatchId: match.id };
}

describe("standings:update broadcasts", () => {
	it(
		"emits once after a match is created and drops the standings snapshot",
		async () => {
			const { ctx, season, seasonPlayers } = await setupSeason("SSE Create Season");
			const recorder = createBroadcastRecorder();
			const db = getDb(realEnv.DB);
			const match = await matchRepository.create({
				db,
				input: {
					seasonId: season.id,
					homeScore: 2,
					awayScore: 1,
					homeTeamPlayerIds: [seasonPlayers[0].id],
					awayTeamPlayerIds: [seasonPlayers[1].id],
					userId: ctx.user.id,
				},
			});

			await finalizeMatchCreation({
				ctx: {
					db,
					env: recorder.env,
					waitUntil: recorder.waitUntil,
					organization: { id: ctx.league.id, slug: ctx.league.slug },
					user: { id: ctx.user.id, name: ctx.user.name },
				},
				seasonSlug: season.slug,
				createdMatch: match,
				seasonPlayerIds: [seasonPlayers[0].id, seasonPlayers[1].id],
				scoreType: "elo",
			});
			await recorder.settle();

			const insert = recorder.events.find((event) => event.type === "match:insert");
			expect(insert).toBeDefined();
			expect(insert && "standings" in insert.data).toBe(false);

			const standings = recorder.events.filter((event) => event.type === "standings:update");
			expect(standings).toHaveLength(1);
			expect(standings[0]?.data).toMatchObject({
				reason: "match:create",
				matchId: match.id,
			});
		},
		TEST_TIMEOUT
	);

	it(
		"emits after a match is removed without a standings snapshot",
		async () => {
			const { ctx, season, seasonPlayers } = await setupSeason("SSE Remove Season");
			const recorder = createBroadcastRecorder();
			const db = getDb(realEnv.DB);
			const match = await matchRepository.create({
				db,
				input: {
					seasonId: season.id,
					homeScore: 3,
					awayScore: 0,
					homeTeamPlayerIds: [seasonPlayers[0].id],
					awayTeamPlayerIds: [seasonPlayers[1].id],
					userId: ctx.user.id,
				},
			});

			await removeMatch(
				{
					db,
					env: recorder.env,
					waitUntil: recorder.waitUntil,
					organization: { slug: ctx.league.slug },
					user: { id: ctx.user.id, name: ctx.user.name },
				},
				{ seasonSlug: season.slug, seasonId: season.id, matchId: match.id }
			);
			await recorder.settle();

			const removed = recorder.events.find((event) => event.type === "match:delete");
			expect(removed).toBeDefined();
			expect(removed && "standings" in removed.data).toBe(false);

			const standings = recorder.events.filter((event) => event.type === "standings:update");
			expect(standings).toHaveLength(1);
			expect(standings[0]?.data).toMatchObject({
				reason: "match:remove",
				matchId: match.id,
			});
		},
		TEST_TIMEOUT
	);

	it(
		"emits after a session result is recorded",
		async () => {
			const { ctx, client, season } = await setupSeason("SSE Session Result Season");
			const recorder = createBroadcastRecorder();
			const { sessionId, sessionMatchId } = await setupInProgressSession(client, season.slug);

			await logMatch(
				{
					db: getDb(realEnv.DB),
					env: recorder.env,
					waitUntil: recorder.waitUntil,
					organization: { id: ctx.league.id, slug: ctx.league.slug, name: ctx.league.name },
					user: { id: ctx.user.id, name: ctx.user.name },
				},
				ctx.league.id,
				{ sessionId, sessionMatchId, home: 3, away: 1 }
			);
			await recorder.settle();

			const standings = recorder.events.filter((event) => event.type === "standings:update");
			expect(standings).toHaveLength(1);
			expect(standings[0]?.data).toMatchObject({
				reason: "session:record-result",
				sessionId,
			});
			expect(standings[0]?.data.matchId).toBeTruthy();
		},
		TEST_TIMEOUT
	);

	it(
		"emits after the last session match is deleted",
		async () => {
			const { ctx, client, season } = await setupSeason("SSE Delete Last Season");
			const recorder = createBroadcastRecorder();
			const { sessionId, sessionMatchId } = await setupInProgressSession(client, season.slug);
			const actionCtx = {
				db: getDb(realEnv.DB),
				env: recorder.env,
				waitUntil: recorder.waitUntil,
				organization: { id: ctx.league.id, slug: ctx.league.slug, name: ctx.league.name },
				user: { id: ctx.user.id, name: ctx.user.name },
			};

			await logMatch(actionCtx, ctx.league.id, { sessionId, sessionMatchId, home: 2, away: 0 });
			await recorder.settle();
			recorder.events.length = 0;

			await deleteLastMatch(actionCtx, ctx.league.id, { sessionId });
			await recorder.settle();

			const standings = recorder.events.filter((event) => event.type === "standings:update");
			expect(standings).toHaveLength(1);
			expect(standings[0]?.data).toMatchObject({
				reason: "session:delete-last-match",
				sessionId,
			});
		},
		TEST_TIMEOUT
	);

	it(
		"does not emit for live score updates",
		async () => {
			const { ctx, client, season } = await setupSeason("SSE Live Score Season");
			const recorder = createBroadcastRecorder();
			const { sessionId } = await setupInProgressSession(client, season.slug);

			await updateLiveScore(
				{
					db: getDb(realEnv.DB),
					env: recorder.env,
					waitUntil: recorder.waitUntil,
					organization: { id: ctx.league.id, slug: ctx.league.slug, name: ctx.league.name },
					user: { id: ctx.user.id, name: ctx.user.name },
				},
				ctx.league.id,
				{ sessionId, home: 2, away: 1 }
			);
			await recorder.settle();

			expect(recorder.events.some((event) => event.type === "session:score-update")).toBe(true);
			expect(recorder.events.some((event) => event.type === "standings:update")).toBe(false);
		},
		TEST_TIMEOUT
	);
});
