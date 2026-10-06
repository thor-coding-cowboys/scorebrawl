import { describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { createAuthContext } from "../setup/auth-context-util";
import { createPlayers } from "../setup/season-context-util";
import { createTRPCTestClient } from "./trpc-test-client";
import { createRoundTripCounter } from "../setup/d1-round-trip-counter";
import * as sessionRepository from "../../src/repositories/session";
import * as sessionService from "../../src/services/session";

const TEST_TIMEOUT = 30000;

async function setupActiveSession() {
	const ctx = await createAuthContext();
	const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });
	await createPlayers(ctx, 4);
	const season = await client.season.create.mutate({
		name: "Round Trip Season",
		initialScore: 1000,
		scoreType: "elo",
		kFactor: 32,
		startDate: new Date(),
	});
	const seasonPlayers = await client.seasonPlayer.getAll.query({ seasonSlug: season.slug });
	const created = await client.session.create.mutate({
		seasonSlug: season.slug,
		rotationMode: "winner-stays",
		teamSize: 1,
		maxConsecutiveGames: null,
		seasonPlayerIds: seasonPlayers.map((p) => p.id),
	});
	const full = await client.session.getById.query({ sessionId: created.id });
	return { ctx, client, season, sessionId: created.id, full };
}

describe("session D1 round trips", () => {
	it(
		"startNextMatch stays within a small round-trip budget",
		async () => {
			const { sessionId, full } = await setupActiveSession();
			const lineup = full.proposedLineup;
			expect(lineup).not.toBeNull();
			const toSeason = (ids: string[]) =>
				ids.map((id) => full.players.find((p) => p.id === id)!.seasonPlayerId);

			const counter = createRoundTripCounter(env.DB);
			await sessionRepository.startNextMatch({
				db: counter.db,
				sessionId,
				homeSeasonPlayerIds: toSeason(lineup!.homePlayerIds),
				awaySeasonPlayerIds: toSeason(lineup!.awayPlayerIds),
			});

			expect(counter.count()).toBeLessThanOrEqual(3);
		},
		TEST_TIMEOUT
	);

	it(
		"recordResult stays within a small round-trip budget",
		async () => {
			const { ctx, client, season, sessionId, full } = await setupActiveSession();
			const lineup = full.proposedLineup!;
			const toSeason = (ids: string[]) =>
				ids.map((id) => full.players.find((p) => p.id === id)!.seasonPlayerId);

			await client.session.startNextMatch.mutate({
				sessionId,
				homeSeasonPlayerIds: toSeason(lineup.homePlayerIds),
				awaySeasonPlayerIds: toSeason(lineup.awayPlayerIds),
			});
			const withMatch = await client.session.getById.query({ sessionId });
			const match = withMatch.matches.find((m) => m.result === null)!;

			const counter = createRoundTripCounter(env.DB);
			await sessionService.recordResult(counter.db, {
				sessionId,
				sessionMatchId: match.id,
				homeScore: 3,
				awayScore: 1,
				seasonId: season.id,
				userId: ctx.user.id,
			});

			expect(counter.count()).toBeLessThanOrEqual(6);
		},
		TEST_TIMEOUT
	);
});
