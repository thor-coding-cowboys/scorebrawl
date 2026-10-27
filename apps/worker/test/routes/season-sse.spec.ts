import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { SeasonRealtimeEvent } from "@coding-cowboys/scorebrawl-core/realtime";

import { createAuthContext } from "../setup/auth-context-util";
import { createPlayers } from "../setup/season-context-util";
import { createTRPCTestClient } from "../trpc/trpc-test-client";

const TEST_TIMEOUT = 30000;

type EventOf<T extends SeasonRealtimeEvent["type"]> = Extract<SeasonRealtimeEvent, { type: T }>;

async function connectSeasonSocket(leagueSlug: string, seasonSlug: string) {
	const response = await SELF.fetch(`http://example.com/api/sse/${leagueSlug}/${seasonSlug}`, {
		headers: { Upgrade: "websocket" },
	});

	const socket = response.webSocket;
	if (!socket) throw new Error("WebSocket upgrade failed");

	socket.accept();
	const events: SeasonRealtimeEvent[] = [];
	socket.addEventListener("message", (event) => {
		if (typeof event.data !== "string") return;
		events.push(JSON.parse(event.data) as SeasonRealtimeEvent);
	});

	return { events, close: () => socket.close() };
}

async function waitForEvent<T extends SeasonRealtimeEvent["type"]>(
	events: SeasonRealtimeEvent[],
	type: T,
	predicate: (event: EventOf<T>) => boolean = () => true
): Promise<EventOf<T>> {
	const deadline = Date.now() + 5000;

	while (Date.now() < deadline) {
		const event = events.find(
			(candidate): candidate is EventOf<T> =>
				candidate.type === type && predicate(candidate as EventOf<T>)
		);
		if (event) return event;
		await new Promise((resolve) => setTimeout(resolve, 25));
	}

	throw new Error(
		`Timed out waiting for ${type}; received ${events.map((event) => event.type).join(", ")}`
	);
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
		"emits a standings update after a match is created without a standings snapshot",
		async () => {
			const { ctx, client, season, seasonPlayers } = await setupSeason("SSE Create Season");
			const { events, close } = await connectSeasonSocket(ctx.league.slug, season.slug);

			try {
				const match = await client.match.create.mutate({
					seasonSlug: season.slug,
					homeScore: 2,
					awayScore: 1,
					homeTeamPlayerIds: [seasonPlayers[0].id],
					awayTeamPlayerIds: [seasonPlayers[1].id],
				});

				const standings = await waitForEvent(events, "standings:update");
				expect(standings.data).toMatchObject({
					reason: "match:create",
					matchId: match.id,
				});

				const insert = await waitForEvent(events, "match:insert");
				expect(insert.data.match.id).toBe(match.id);
				expect("standings" in insert.data).toBe(false);
			} finally {
				close();
			}
		},
		TEST_TIMEOUT
	);

	it(
		"emits a standings update after a match is removed",
		async () => {
			const { ctx, client, season, seasonPlayers } = await setupSeason("SSE Remove Season");
			const match = await client.match.create.mutate({
				seasonSlug: season.slug,
				homeScore: 3,
				awayScore: 0,
				homeTeamPlayerIds: [seasonPlayers[0].id],
				awayTeamPlayerIds: [seasonPlayers[1].id],
			});
			const { events, close } = await connectSeasonSocket(ctx.league.slug, season.slug);

			try {
				await client.match.remove.mutate({ seasonSlug: season.slug, matchId: match.id });

				const standings = await waitForEvent(events, "standings:update");
				expect(standings.data).toMatchObject({
					reason: "match:remove",
					matchId: match.id,
				});

				const removed = await waitForEvent(events, "match:delete");
				expect(removed.data.matchId).toBe(match.id);
			} finally {
				close();
			}
		},
		TEST_TIMEOUT
	);

	it(
		"emits a standings update after a session result is recorded",
		async () => {
			const { ctx, client, season } = await setupSeason("SSE Session Result Season");
			const { events, close } = await connectSeasonSocket(ctx.league.slug, season.slug);

			try {
				const { sessionId, sessionMatchId } = await setupInProgressSession(client, season.slug);

				await client.session.recordResult.mutate({
					sessionId,
					sessionMatchId,
					homeScore: 3,
					awayScore: 1,
				});

				const standings = await waitForEvent(events, "standings:update");
				expect(standings.data).toMatchObject({
					reason: "session:record-result",
					sessionId,
				});
				expect(standings.data.matchId).toBeTruthy();
			} finally {
				close();
			}
		},
		TEST_TIMEOUT
	);

	it(
		"emits a standings update after the last session match is deleted",
		async () => {
			const { ctx, client, season } = await setupSeason("SSE Delete Last Season");
			const { events, close } = await connectSeasonSocket(ctx.league.slug, season.slug);

			try {
				const { sessionId, sessionMatchId } = await setupInProgressSession(client, season.slug);

				await client.session.recordResult.mutate({
					sessionId,
					sessionMatchId,
					homeScore: 2,
					awayScore: 0,
				});
				await waitForEvent(events, "standings:update", (event) => {
					return event.data.reason === "session:record-result";
				});

				await client.session.deleteLastMatch.mutate({ sessionId });

				const standings = await waitForEvent(events, "standings:update", (event) => {
					return event.data.reason === "session:delete-last-match";
				});
				expect(standings.data).toMatchObject({ sessionId });
			} finally {
				close();
			}
		},
		TEST_TIMEOUT
	);
});
