import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { getDb } from "../../src/db/index";
import { match, matchPlayer, matchTeam } from "../../src/db/schema/league-schema";
import { createAuthContext } from "../setup/auth-context-util";
import { createPlayers } from "../setup/season-context-util";
import { createTRPCTestClient } from "../trpc/trpc-test-client";

const DAY_MS = 24 * 60 * 60 * 1000;

/** UTC midnight, matching SQLite's `start of day` on D1. */
function utcMidnight(date: Date): number {
	return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

async function setMatchCreatedAt(matchId: string, createdAt: Date) {
	const db = getDb(env.DB);
	await db.update(match).set({ createdAt }).where(eq(match.id, matchId));
	await db.update(matchPlayer).set({ createdAt }).where(eq(matchPlayer.matchId, matchId));
	await db.update(matchTeam).set({ createdAt }).where(eq(matchTeam.matchId, matchId));
}

describe("weekly stats window", () => {
	it("counts matches from the last 7 days (UTC) only", async () => {
		const ctx = await createAuthContext();
		const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });
		await createPlayers(ctx, 4);

		const season = await client.season.create.mutate({
			name: "Weekly Stats Season",
			initialScore: 1000,
			scoreType: "elo",
			kFactor: 32,
			startDate: new Date(Date.now() - 30 * DAY_MS),
		});
		const seasonPlayers = await client.seasonPlayer.getAll.query({ seasonSlug: season.slug });

		const createMatch = (homeScore: number, awayScore: number) =>
			client.match.create.mutate({
				seasonSlug: season.slug,
				homeScore,
				awayScore,
				homeTeamPlayerIds: [seasonPlayers[0].id, seasonPlayers[1].id],
				awayTeamPlayerIds: [seasonPlayers[2].id, seasonPlayers[3].id],
			});

		const windowStart = new Date(utcMidnight(new Date()) - 6 * DAY_MS);

		const beforeWindow = await createMatch(1, 0);
		const atWindowStart = await createMatch(2, 0);
		const insideWindow = await createMatch(0, 2);
		const muchOlder = await createMatch(3, 0);

		await setMatchCreatedAt(beforeWindow.id, new Date(windowStart.getTime() - 1000));
		await setMatchCreatedAt(atWindowStart.id, windowStart);
		await setMatchCreatedAt(insideWindow.id, new Date(windowStart.getTime() + 60 * 60 * 1000));
		await setMatchCreatedAt(muchOlder.id, new Date(windowStart.getTime() - 14 * DAY_MS));

		const playerStats = await client.seasonPlayer.getWeeklyStats.query({
			seasonSlug: season.slug,
		});

		expect(playerStats).toHaveLength(4);
		const home = playerStats.find((p) => p.seasonPlayerId === seasonPlayers[0].id)!;
		const away = playerStats.find((p) => p.seasonPlayerId === seasonPlayers[2].id)!;
		expect(home.matchCount).toBe(2);
		expect(home.winCount).toBe(1);
		expect(home.lossCount).toBe(1);
		expect(away.matchCount).toBe(2);
		expect(away.winCount).toBe(1);
		expect(away.lossCount).toBe(1);

		const teamStats = await client.seasonTeam.getWeeklyStats.query({ seasonSlug: season.slug });
		expect(teamStats).toHaveLength(2);
		expect(teamStats.every((t) => t.matchCount === 2)).toBe(true);
		expect(teamStats.every((t) => t.teamName.length > 0)).toBe(true);

		const totalPointChange =
			playerStats.reduce((sum, p) => sum + p.pointChange, 0) +
			teamStats.reduce((sum, t) => sum + t.pointChange, 0);
		expect(totalPointChange).toBe(0);
	});

	it("returns no rows when every match is older than the window", async () => {
		const ctx = await createAuthContext();
		const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });
		await createPlayers(ctx, 4);

		const season = await client.season.create.mutate({
			name: "Stale Weekly Season",
			initialScore: 1000,
			scoreType: "elo",
			kFactor: 32,
			startDate: new Date(Date.now() - 60 * DAY_MS),
		});
		const seasonPlayers = await client.seasonPlayer.getAll.query({ seasonSlug: season.slug });

		const created = await client.match.create.mutate({
			seasonSlug: season.slug,
			homeScore: 2,
			awayScore: 1,
			homeTeamPlayerIds: [seasonPlayers[0].id, seasonPlayers[1].id],
			awayTeamPlayerIds: [seasonPlayers[2].id, seasonPlayers[3].id],
		});
		const oldDate = new Date(utcMidnight(new Date()) - 20 * DAY_MS);
		await setMatchCreatedAt(created.id, oldDate);

		expect(
			await client.seasonPlayer.getWeeklyStats.query({ seasonSlug: season.slug })
		).toHaveLength(0);
		expect(await client.seasonTeam.getWeeklyStats.query({ seasonSlug: season.slug })).toHaveLength(
			0
		);
	});
});
