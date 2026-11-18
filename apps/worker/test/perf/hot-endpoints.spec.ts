import { env, SELF } from "cloudflare:test";
import { defineRelations } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { createCallerFactory } from "@trpc/server/unstable-core-do-not-import";
import { beforeAll, describe, expect, it } from "vitest";
import { newId } from "@coding-cowboys/scorebrawl-util/id-util";
import type { AuthType } from "../../src/middleware/context";
import * as schema from "../../src/db/schema";
import { getDb } from "../../src/db";
import {
	leagueTeam,
	leagueTeamPlayer,
	match,
	matchPlayer,
	matchTeam,
	seasonTeam,
} from "../../src/db/schema/league-schema";
import { trpcRouter } from "../../src/trpc/trpc-router";
import { createAuthContext, type AuthContext } from "../setup/auth-context-util";
import { createRoundTripCounter } from "../setup/d1-round-trip-counter";
import { createPlayers } from "../setup/season-context-util";
import { createTRPCTestClient } from "../trpc/trpc-test-client";

/**
 * Profile of the hot read endpoints reported by production tail.
 *
 * Round trips are the primary signal: they are deterministic, and on Workers
 * every one of them is a network wait plus query-driver work inside the
 * request's CPU budget. Wall time is logged for before/after comparison only
 * (local D1 runs in-process, so it is far cheaper than production).
 */

const PLAYER_COUNT = 24;
const TEAM_COUNT = 12;
const MATCH_COUNT = 600;
const ITERATIONS = 50;

const createCaller = createCallerFactory()(trpcRouter);

interface Measurement {
	endpoint: string;
	roundTrips: number;
	statements: number;
	meanMs: number;
}

function chunk<T>(rows: T[], size: number): T[][] {
	const out: T[][] = [];
	for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
	return out;
}

async function seedSeason(ctx: AuthContext) {
	const db = getDb(env.DB);
	const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });
	await createPlayers(ctx, PLAYER_COUNT);

	const season = await client.season.create.mutate({
		name: "Perf Season",
		initialScore: 1000,
		scoreType: "elo",
		kFactor: 32,
		startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
	});

	const seasonPlayers = await client.seasonPlayer.getAll.query({ seasonSlug: season.slug });
	const now = new Date();

	// Teams of two players each.
	const teamRows = [];
	const teamPlayerRows = [];
	const seasonTeamRows = [];
	const seasonTeamIds: string[] = [];
	for (let i = 0; i < TEAM_COUNT; i++) {
		const leagueTeamId = newId("leagueTeam");
		const seasonTeamId = newId("team");
		seasonTeamIds.push(seasonTeamId);
		teamRows.push({
			id: leagueTeamId,
			name: `Team ${i}`,
			leagueId: ctx.league.id,
			createdAt: now,
			updatedAt: now,
		});
		for (const sp of seasonPlayers.slice(i * 2, i * 2 + 2)) {
			teamPlayerRows.push({
				id: newId("leaguePlayer"),
				leagueTeamId,
				playerId: sp.playerId,
				createdAt: now,
				updatedAt: now,
			});
		}
		seasonTeamRows.push({
			id: seasonTeamId,
			seasonId: season.id,
			leagueTeamId,
			score: 1000 + ((i * 37) % 200) - 100,
			createdAt: now,
			updatedAt: now,
		});
	}
	for (const rows of chunk(teamRows, 10)) await db.insert(leagueTeam).values(rows);
	for (const rows of chunk(teamPlayerRows, 10)) await db.insert(leagueTeamPlayer).values(rows);
	for (const rows of chunk(seasonTeamRows, 10)) await db.insert(seasonTeam).values(rows);

	const matchRows = [];
	const matchPlayerRows = [];
	const matchTeamRows = [];
	for (let i = 0; i < MATCH_COUNT; i++) {
		const matchId = newId("match");
		const teamA = i % TEAM_COUNT;
		const teamB = (i + 1 + (i % (TEAM_COUNT - 1))) % TEAM_COUNT;
		const homeScore = i % 3 === 0 ? 1 : 2;
		const awayScore = i % 3 === 0 ? 1 : i % 2 === 0 ? 1 : 0;
		// A fifth of the matches land inside the 7-day window used by weekly stats.
		const ageDays = i < MATCH_COUNT / 5 ? (i % 7) * 0.5 : 8 + (i % 20);
		const createdAt = new Date(Date.now() - ageDays * 24 * 60 * 60 * 1000);
		const homeResult = homeScore > awayScore ? "W" : homeScore === awayScore ? "D" : "L";
		const awayResult = homeScore > awayScore ? "L" : homeScore === awayScore ? "D" : "W";

		matchRows.push({
			id: matchId,
			seasonId: season.id,
			homeScore,
			awayScore,
			createdBy: ctx.user.id,
			updatedBy: ctx.user.id,
			createdAt,
			updatedAt: createdAt,
		});

		for (const [teamIdx, result, home] of [
			[teamA, homeResult, true],
			[teamB, awayResult, false],
		] as const) {
			const scoreAfter = result === "W" ? 1016 : result === "L" ? 984 : 1000;
			matchTeamRows.push({
				id: newId("team"),
				seasonTeamId: seasonTeamIds[teamIdx]!,
				matchId,
				result,
				scoreBefore: 1000,
				scoreAfter,
				createdAt,
				updatedAt: createdAt,
			});
			for (const sp of seasonPlayers.slice(teamIdx * 2, teamIdx * 2 + 2)) {
				matchPlayerRows.push({
					id: newId("matchPlayer"),
					seasonPlayerId: sp.id,
					matchId,
					homeTeam: home,
					result,
					scoreBefore: 1000,
					scoreAfter,
					createdAt,
					updatedAt: createdAt,
				});
			}
		}
	}
	for (const rows of chunk(matchRows, 10)) await db.insert(match).values(rows);
	for (const rows of chunk(matchPlayerRows, 8)) await db.insert(matchPlayer).values(rows);
	for (const rows of chunk(matchTeamRows, 10)) await db.insert(matchTeam).values(rows);

	return { season };
}

describe("hot trpc endpoint profile", () => {
	let counterCaller: ReturnType<typeof createCaller>;
	let loggingCaller: ReturnType<typeof createCaller>;
	let counter: ReturnType<typeof createRoundTripCounter>;
	let seasonSlug: string;
	let sessionToken: string;
	let sqlLog: unknown[];

	beforeAll(async () => {
		const ctx = await createAuthContext();
		sessionToken = ctx.sessionToken;
		const { season } = await seedSeason(ctx);
		seasonSlug = season.slug;

		const authentication = {
			user: { id: ctx.user.id, name: ctx.user.name, email: ctx.user.email, role: "user" },
			session: { activeOrganizationId: ctx.league.id, id: "session" },
		} as unknown as AuthType;

		counter = createRoundTripCounter(env.DB);

		const loggingDb = drizzle(env.DB, {
			relations: defineRelations(schema),
			logger: {
				logQuery() {
					sqlLog.push(null);
				},
			},
		});

		const baseContext = {
			authentication,
			betterAuth: {} as never,
			userAssets: {} as never,
			env,
			waitUntil: () => {},
			headers: new Headers(),
		};

		counterCaller = createCaller({ ...baseContext, db: counter.db });
		loggingCaller = createCaller({ ...baseContext, db: loggingDb });
	}, 180_000);

	async function measure(
		name: string,
		run: (caller: ReturnType<typeof createCaller>) => Promise<unknown>
	): Promise<Measurement> {
		await run(counterCaller); // warmup

		sqlLog = [];
		await run(loggingCaller);
		const statements = sqlLog.length;

		counter.reset();
		await run(counterCaller);
		const roundTrips = counter.count();

		const start = performance.now();
		for (let i = 0; i < ITERATIONS; i++) await run(counterCaller);
		const meanMs = (performance.now() - start) / ITERATIONS;

		return { endpoint: name, roundTrips, statements, meanMs: Number(meanMs.toFixed(2)) };
	}

	it("keeps the hot read endpoints within their D1 round-trip budget", async () => {
		const season = { seasonSlug };

		const measurements = [
			await measure("season.getBySlug", (c) => c.season.getBySlug(season)),
			await measure("season.getCountInfo", (c) => c.season.getCountInfo(season)),
			await measure("seasonPlayer.getStanding", (c) => c.seasonPlayer.getStanding(season)),
			await measure("seasonPlayer.getTop", (c) => c.seasonPlayer.getTop(season)),
			await measure("seasonPlayer.getAll", (c) => c.seasonPlayer.getAll(season)),
			await measure("seasonPlayer.getWeeklyStats", (c) => c.seasonPlayer.getWeeklyStats(season)),
			await measure("seasonTeam.getStanding", (c) => c.seasonTeam.getStanding(season)),
			await measure("seasonTeam.getWeeklyStats", (c) => c.seasonTeam.getWeeklyStats(season)),
			await measure("match.getAll(limit=5)", (c) =>
				c.match.getAll({ ...season, limit: 5, offset: 0 })
			),
			await measure("match.getAll(limit=30)", (c) =>
				c.match.getAll({ ...season, limit: 30, offset: 0 })
			),
			await measure("session.getActive", (c) => c.session.getActive(season)),
		];

		console.log(
			"\n" +
				measurements
					.map(
						(m) =>
							`${m.endpoint.padEnd(32)} roundTrips=${String(m.roundTrips).padStart(2)} statements=${String(
								m.statements
							).padStart(2)} mean=${m.meanMs}ms`
					)
					.join("\n")
		);

		// Every season-scoped call resolves league membership and the season in a
		// single authorization query; anything above these numbers is a new query.
		const budget: Record<string, number> = {
			"season.getBySlug": 1,
			"season.getCountInfo": 2,
			"seasonPlayer.getStanding": 2,
			"seasonPlayer.getTop": 3,
			"seasonPlayer.getAll": 2,
			"seasonPlayer.getWeeklyStats": 2,
			"seasonTeam.getStanding": 3,
			"seasonTeam.getWeeklyStats": 2,
			"match.getAll(limit=5)": 3,
			"match.getAll(limit=30)": 3,
			"session.getActive": 4,
		};
		for (const measurement of measurements) {
			expect(measurement.roundTrips, measurement.endpoint).toBeLessThanOrEqual(
				budget[measurement.endpoint]!
			);
		}
	}, 180_000);

	it("measures the full HTTP path with a warm session cookie cache", async () => {
		const season = { seasonSlug };

		// Replay the signed session cookie the way a browser does, so get-session
		// is served from the cookie cache instead of D1.
		const tokenCookie = `better-auth.session_token=${sessionToken}`;
		const warmup = await SELF.fetch("http://example.com/api/auth/get-session", {
			headers: { Cookie: tokenCookie },
		});
		const cacheCookies = warmup.headers
			.getSetCookie()
			.map((cookie) => cookie.split(";")[0]!)
			.filter((cookie) => cookie.startsWith("better-auth."));
		const cachedCookie = [tokenCookie, ...cacheCookies].join("; ");
		const client = createTRPCTestClient({ headers: { Cookie: cachedCookie } });

		const cases: Array<[string, () => Promise<unknown>]> = [
			["http GET /api/version", () => SELF.fetch("http://example.com/api/version")],
			[
				"http get-session (cached)",
				() =>
					SELF.fetch("http://example.com/api/auth/get-session", {
						headers: { Cookie: cachedCookie },
					}),
			],
			["http season.getBySlug", () => client.season.getBySlug.query(season)],
			["http seasonPlayer.getStanding", () => client.seasonPlayer.getStanding.query(season)],
			[
				"http match.getAll(limit=5)",
				() => client.match.getAll.query({ ...season, limit: 5, offset: 0 }),
			],
			[
				"http match.getAll(limit=30)",
				() => client.match.getAll.query({ ...season, limit: 30, offset: 0 }),
			],
		];

		const rows: string[] = [];
		for (const [name, run] of cases) {
			await run();
			const start = performance.now();
			for (let i = 0; i < 30; i++) await run();
			rows.push(`${name.padEnd(34)} mean=${((performance.now() - start) / 30).toFixed(2)}ms`);
		}

		// Response size drives superjson serialization, which is Worker CPU.
		const payloads: string[] = [];
		for (const [name, path, input] of [
			["season.getBySlug", "season.getBySlug", { json: season }],
			["match.getAll(limit=5)", "match.getAll", { json: { ...season, limit: 5, offset: 0 } }],
			["match.getAll(limit=30)", "match.getAll", { json: { ...season, limit: 30, offset: 0 } }],
			["seasonPlayer.getStanding", "seasonPlayer.getStanding", { json: season }],
		] as const) {
			const res = await SELF.fetch(
				`http://example.com/api/trpc/${path}?batch=1&input=${encodeURIComponent(
					JSON.stringify({ 0: input })
				)}`,
				{ headers: { Cookie: cachedCookie } }
			);
			payloads.push(`${name.padEnd(34)} ${(await res.text()).length} bytes`);
		}

		console.log("\n" + rows.join("\n") + "\n" + payloads.join("\n"));
	}, 180_000);
});
