import { describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { createAuthContext } from "../setup/auth-context-util";
import { createPlayers } from "../setup/season-context-util";
import { createTRPCTestClient } from "./trpc-test-client";
import { getDb } from "../../src/db/index";
import * as sessionRepository from "../../src/repositories/session";
import * as sessionService from "../../src/services/session";

const TEST_TIMEOUT = 20000;

async function setupSeasonWithPlayers(count = 4) {
	const ctx = await createAuthContext();
	const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });

	await createPlayers(ctx, count);
	const season = await client.season.create.mutate({
		name: "Repeated Teams Test Season",
		initialScore: 1000,
		scoreType: "elo",
		kFactor: 32,
		startDate: new Date(),
	});

	const seasonPlayers = await client.seasonPlayer.getAll.query({ seasonSlug: season.slug });

	return { ctx, client, season, seasonPlayers };
}

type LineupPairing = string;

function pairingKey(homeSeasonIds: string[], awaySeasonIds: string[]): LineupPairing {
	const sortTeam = (ids: string[]) => [...ids].sort().join(",");
	return `${sortTeam(homeSeasonIds)} vs ${sortTeam(awaySeasonIds)}`;
}

async function playGames({
	client,
	sessionId,
	games = 6,
}: {
	client: ReturnType<typeof createTRPCTestClient>;
	sessionId: string;
	games?: number;
}) {
	const pairings: LineupPairing[] = [];

	for (let i = 0; i < games; i++) {
		const before = await client.session.getById.query({ sessionId });
		const lineup = before.proposedLineup;

		if (!lineup || lineup.homePlayerIds.length === 0 || lineup.awayPlayerIds.length === 0) {
			throw new Error(`Game ${i + 1}: no proposed lineup`);
		}

		const homeSeason = lineup.homePlayerIds
			.map((spId) => before.players.find((p) => p.id === spId)?.seasonPlayerId)
			.filter((id): id is string => id !== undefined);
		const awaySeason = lineup.awayPlayerIds
			.map((spId) => before.players.find((p) => p.id === spId)?.seasonPlayerId)
			.filter((id): id is string => id !== undefined);

		await client.session.startNextMatch.mutate({
			sessionId,
			homeSeasonPlayerIds: homeSeason,
			awaySeasonPlayerIds: awaySeason,
		});

		const withMatch = await client.session.getById.query({ sessionId });
		const match = withMatch.matches.find((m) => m.result === null);
		if (!match) throw new Error(`Game ${i + 1}: no active match`);

		await client.session.recordResult.mutate({
			sessionId,
			sessionMatchId: match.id,
			homeScore: 3,
			awayScore: 1,
		});

		pairings.push(pairingKey(match.homePlayerIds, match.awayPlayerIds));
	}

	return pairings;
}

async function playGamesDirect({
	sessionId,
	seasonId,
	userId,
	games,
}: {
	sessionId: string;
	seasonId: string;
	userId: string;
	games: number;
}) {
	const db = getDb(env.DB);
	const pairings: LineupPairing[] = [];
	const teams: Array<{ home: string[]; away: string[] }> = [];

	for (let i = 0; i < games; i++) {
		const full = await sessionRepository.getSessionById({ db, sessionId });
		const lineup = full?.proposedLineup;
		if (!lineup || lineup.homePlayerIds.length === 0 || lineup.awayPlayerIds.length === 0) {
			throw new Error(`Game ${i + 1}: no proposed lineup`);
		}

		const homeSeason = lineup.homePlayerIds
			.map((spId) => full.players.find((p) => p.id === spId)?.seasonPlayerId)
			.filter((id): id is string => id !== undefined);
		const awaySeason = lineup.awayPlayerIds
			.map((spId) => full.players.find((p) => p.id === spId)?.seasonPlayerId)
			.filter((id): id is string => id !== undefined);

		await sessionRepository.startNextMatch({
			db,
			sessionId,
			homeSeasonPlayerIds: homeSeason,
			awaySeasonPlayerIds: awaySeason,
		});

		const full2 = await sessionRepository.getSessionById({ db, sessionId });
		const match = full2?.matches.find((m) => m.result === null);
		if (!match) throw new Error(`Game ${i + 1}: no active match`);

		await sessionService.recordResult(db, {
			sessionId,
			sessionMatchId: match.id,
			homeScore: 3,
			awayScore: 1,
			seasonId,
			userId,
		});

		pairings.push(pairingKey(match.homePlayerIds, match.awayPlayerIds));
		teams.push({ home: match.homePlayerIds, away: match.awayPlayerIds });
	}

	return { pairings, teams };
}

function sameTeamRepeatRate(teams: Array<{ home: string[]; away: string[] }>): number {
	let samples = 0;
	let repeats = 0;
	for (let i = 1; i < teams.length; i++) {
		const prevHome = new Set(teams[i - 1].home);
		const prevAway = new Set(teams[i - 1].away);
		const prevAll = [...teams[i - 1].home, ...teams[i - 1].away];
		const nextHome = new Set(teams[i].home);
		const nextAway = new Set(teams[i].away);
		const nextAll = [...nextHome, ...nextAway];

		for (let a = 0; a < prevAll.length; a++) {
			for (let b = a + 1; b < prevAll.length; b++) {
				const x = prevAll[a];
				const y = prevAll[b];
				if (!nextAll.includes(x) || !nextAll.includes(y)) continue;
				const teamedPrev =
					(prevHome.has(x) && prevHome.has(y)) || (prevAway.has(x) && prevAway.has(y));
				if (!teamedPrev) continue;
				samples++;
				if ((nextHome.has(x) && nextHome.has(y)) || (nextAway.has(x) && nextAway.has(y))) {
					repeats++;
				}
			}
		}
	}
	return samples === 0 ? 0 : repeats / samples;
}

describe("session team variety (reproduction: same teams every game)", () => {
	it(
		"autoRandomize OFF but no waiting players: 4 players, 2v2 → teams still vary",
		async () => {
			const { client, season, seasonPlayers } = await setupSeasonWithPlayers(4);

			const session = await client.session.create.mutate({
				seasonSlug: season.slug,
				rotationMode: "winner-stays",
				teamSize: 2,
				maxConsecutiveGames: null,
				autoRandomize: false,
				seasonPlayerIds: seasonPlayers.map((p) => p.id),
			});

			const pairings = await playGames({ client, sessionId: session.id, games: 6 });

			const unique = new Set(pairings);
			expect(unique.size).toBeGreaterThan(1);
		},
		TEST_TIMEOUT
	);

	it(
		"autoRandomize ON (fisher-yates): 4 players, 2v2 → teams vary",
		async () => {
			const { client, season, seasonPlayers } = await setupSeasonWithPlayers(4);

			const session = await client.session.create.mutate({
				seasonSlug: season.slug,
				rotationMode: "winner-stays",
				teamSize: 2,
				maxConsecutiveGames: null,
				autoRandomize: true,
				randomizerType: "fisher-yates",
				seasonPlayerIds: seasonPlayers.map((p) => p.id),
			});

			const pairings = await playGames({ client, sessionId: session.id, games: 6 });

			const unique = new Set(pairings);
			expect(unique.size).toBeGreaterThan(1);
		},
		TEST_TIMEOUT
	);

	it(
		"autoRandomize ON (diversity): 4 players, 2v2 → respects diversity, avoids re-teaming partners",
		async () => {
			const { ctx, client, season, seasonPlayers } = await setupSeasonWithPlayers(4);

			const session = await client.session.create.mutate({
				seasonSlug: season.slug,
				rotationMode: "winner-stays",
				teamSize: 2,
				maxConsecutiveGames: null,
				autoRandomize: true,
				randomizerType: "diversity",
				seasonPlayerIds: seasonPlayers.map((p) => p.id),
			});

			const { pairings, teams } = await playGamesDirect({
				sessionId: session.id,
				seasonId: season.id,
				userId: ctx.user.id,
				games: 40,
			});

			expect(new Set(pairings).size).toBeGreaterThan(1);
			const repeatRate = sameTeamRepeatRate(teams);
			expect(repeatRate).toBeLessThan(0.25);
		},
		TEST_TIMEOUT
	);

	it(
		"diversity with waiting players avoids re-teaming last game's partners",
		async () => {
			const { ctx, client, season, seasonPlayers } = await setupSeasonWithPlayers(6);

			const session = await client.session.create.mutate({
				seasonSlug: season.slug,
				rotationMode: "winner-stays",
				teamSize: 2,
				maxConsecutiveGames: null,
				autoRandomize: true,
				randomizerType: "diversity",
				seasonPlayerIds: seasonPlayers.map((p) => p.id),
			});

			const { pairings, teams } = await playGamesDirect({
				sessionId: session.id,
				seasonId: season.id,
				userId: ctx.user.id,
				games: 40,
			});

			expect(new Set(pairings).size).toBeGreaterThan(1);
			const repeatRate = sameTeamRepeatRate(teams);
			expect(repeatRate).toBeLessThan(0.25);
		},
		TEST_TIMEOUT
	);
});
