import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { getDb } from "../../src/db/index";
import { playerAchievement } from "../../src/db/schema/league-schema";
import { calculateAchievements } from "../../src/services/achievement-calculation";
import { createAuthContext } from "../setup/auth-context-util";
import { createPlayers } from "../setup/season-context-util";
import { createTRPCTestClient } from "../trpc/trpc-test-client";

async function setupLeagueWithSeason() {
	const ctx = await createAuthContext();
	const client = createTRPCTestClient({ sessionToken: ctx.sessionToken });
	await createPlayers(ctx, 2);

	const season = await client.season.create.mutate({
		name: "Achievement Test Season",
		initialScore: 1000,
		scoreType: "elo",
		kFactor: 32,
		startDate: new Date(),
	});

	const seasonPlayers = await client.seasonPlayer.getAll.query({
		seasonSlug: season.slug,
	});

	// seasonPlayers[i].playerId is the underlying player ID used for achievement storage
	const home = seasonPlayers[0];
	const away = seasonPlayers[1];

	return { client, season, home, away };
}

async function createMatch(
	client: ReturnType<typeof createTRPCTestClient>,
	seasonSlug: string,
	homeSeasonPlayerId: string,
	awaySeasonPlayerId: string,
	homeScore: number,
	awayScore: number
) {
	return client.match.create.mutate({
		seasonSlug,
		homeScore,
		awayScore,
		homeTeamPlayerIds: [homeSeasonPlayerId],
		awayTeamPlayerIds: [awaySeasonPlayerId],
	});
}

async function getAchievements(playerId: string) {
	const db = getDb(env.DB);
	return db.select().from(playerAchievement).where(eq(playerAchievement.playerId, playerId));
}

describe("achievement calculation", () => {
	it("returns early with no errors for empty input", async () => {
		const db = getDb(env.DB);
		await calculateAchievements(db, []);
	});

	it("awards no achievements when player has fewer than 5 matches", async () => {
		const { client, season, home, away } = await setupLeagueWithSeason();

		for (let i = 0; i < 4; i++) {
			await createMatch(client, season.slug, home.id, away.id, 3, 0);
		}

		const db = getDb(env.DB);
		await calculateAchievements(db, [home.id]);

		const achievements = await getAchievements(home.playerId);
		expect(achievements).toHaveLength(0);
	});

	describe("win streak achievements", () => {
		it("awards 5_win_streak after 5 consecutive wins", async () => {
			const { client, season, home, away } = await setupLeagueWithSeason();

			for (let i = 0; i < 5; i++) {
				await createMatch(client, season.slug, home.id, away.id, 2, 1);
			}

			const db = getDb(env.DB);
			await calculateAchievements(db, [home.id]);

			const achievements = await getAchievements(home.playerId);
			const types = achievements.map((a) => a.type);
			expect(types).toContain("5_win_streak");
			expect(types).not.toContain("10_win_streak");
		});

		it("awards 10_win_streak after 10 consecutive wins", async () => {
			const { client, season, home, away } = await setupLeagueWithSeason();

			for (let i = 0; i < 10; i++) {
				await createMatch(client, season.slug, home.id, away.id, 2, 1);
			}

			const db = getDb(env.DB);
			await calculateAchievements(db, [home.id]);

			const achievements = await getAchievements(home.playerId);
			const types = achievements.map((a) => a.type);
			expect(types).toContain("5_win_streak");
			expect(types).toContain("10_win_streak");
			expect(types).not.toContain("15_win_streak");
		});

		it("does not award win streak when streak is broken by a loss", async () => {
			const { client, season, home, away } = await setupLeagueWithSeason();

			for (let i = 0; i < 3; i++) {
				await createMatch(client, season.slug, home.id, away.id, 2, 1);
			}
			await createMatch(client, season.slug, home.id, away.id, 0, 2);
			for (let i = 0; i < 3; i++) {
				await createMatch(client, season.slug, home.id, away.id, 2, 1);
			}

			const db = getDb(env.DB);
			await calculateAchievements(db, [home.id]);

			const achievements = await getAchievements(home.playerId);
			const types = achievements.map((a) => a.type);
			expect(types).not.toContain("5_win_streak");
		});
	});

	describe("clean sheet streak achievements", () => {
		it("awards 5_clean_sheet_streak after 5 consecutive clean sheets", async () => {
			const { client, season, home, away } = await setupLeagueWithSeason();

			for (let i = 0; i < 5; i++) {
				await createMatch(client, season.slug, home.id, away.id, 2, 0);
			}

			const db = getDb(env.DB);
			await calculateAchievements(db, [home.id]);

			const achievements = await getAchievements(home.playerId);
			const types = achievements.map((a) => a.type);
			expect(types).toContain("5_clean_sheet_streak");
			expect(types).toContain("5_win_streak");
		});

		it("does not award clean sheet streak when a goal is conceded mid-streak", async () => {
			const { client, season, home, away } = await setupLeagueWithSeason();

			for (let i = 0; i < 3; i++) {
				await createMatch(client, season.slug, home.id, away.id, 2, 0);
			}
			await createMatch(client, season.slug, home.id, away.id, 3, 1);
			for (let i = 0; i < 3; i++) {
				await createMatch(client, season.slug, home.id, away.id, 2, 0);
			}

			const db = getDb(env.DB);
			await calculateAchievements(db, [home.id]);

			const achievements = await getAchievements(home.playerId);
			const types = achievements.map((a) => a.type);
			expect(types).not.toContain("5_clean_sheet_streak");
		});
	});

	describe("redemption achievements", () => {
		it("awards 3_win_loss_redemption for 3 losses followed by 3 wins", async () => {
			const { client, season, home, away } = await setupLeagueWithSeason();

			for (let i = 0; i < 3; i++) {
				await createMatch(client, season.slug, home.id, away.id, 0, 2);
			}
			for (let i = 0; i < 3; i++) {
				await createMatch(client, season.slug, home.id, away.id, 2, 0);
			}

			const db = getDb(env.DB);
			await calculateAchievements(db, [home.id]);

			const achievements = await getAchievements(home.playerId);
			const types = achievements.map((a) => a.type);
			expect(types).toContain("3_win_loss_redemption");
		});

		it("awards 5_win_loss_redemption for 5 losses followed by 5 wins", async () => {
			const { client, season, home, away } = await setupLeagueWithSeason();

			for (let i = 0; i < 5; i++) {
				await createMatch(client, season.slug, home.id, away.id, 0, 2);
			}
			for (let i = 0; i < 5; i++) {
				await createMatch(client, season.slug, home.id, away.id, 2, 0);
			}

			const db = getDb(env.DB);
			await calculateAchievements(db, [home.id]);

			const achievements = await getAchievements(home.playerId);
			const types = achievements.map((a) => a.type);
			expect(types).toContain("3_win_loss_redemption");
			expect(types).toContain("5_win_loss_redemption");
			expect(types).toContain("5_win_streak");
		});

		it("does not award redemption when pattern is not contiguous", async () => {
			const { client, season, home, away } = await setupLeagueWithSeason();

			for (let i = 0; i < 3; i++) {
				await createMatch(client, season.slug, home.id, away.id, 0, 2);
			}
			await createMatch(client, season.slug, home.id, away.id, 1, 1);
			for (let i = 0; i < 3; i++) {
				await createMatch(client, season.slug, home.id, away.id, 2, 0);
			}

			const db = getDb(env.DB);
			await calculateAchievements(db, [home.id]);

			const achievements = await getAchievements(home.playerId);
			const types = achievements.map((a) => a.type);
			expect(types).not.toContain("3_win_loss_redemption");
		});
	});

	describe("goals scored achievements", () => {
		it("awards 3_goals_5_games when all last 5 games have 3+ goals", async () => {
			const { client, season, home, away } = await setupLeagueWithSeason();

			for (let i = 0; i < 5; i++) {
				await createMatch(client, season.slug, home.id, away.id, 3, 0);
			}

			const db = getDb(env.DB);
			await calculateAchievements(db, [home.id]);

			const achievements = await getAchievements(home.playerId);
			const types = achievements.map((a) => a.type);
			expect(types).toContain("3_goals_5_games");
		});

		it("awards 5_goals_5_games when all last 5 games have 5+ goals", async () => {
			const { client, season, home, away } = await setupLeagueWithSeason();

			for (let i = 0; i < 5; i++) {
				await createMatch(client, season.slug, home.id, away.id, 5, 0);
			}

			const db = getDb(env.DB);
			await calculateAchievements(db, [home.id]);

			const achievements = await getAchievements(home.playerId);
			const types = achievements.map((a) => a.type);
			expect(types).toContain("3_goals_5_games");
			expect(types).toContain("5_goals_5_games");
		});

		it("awards 8_goals_5_games when all last 5 games have 8+ goals", async () => {
			const { client, season, home, away } = await setupLeagueWithSeason();

			for (let i = 0; i < 5; i++) {
				await createMatch(client, season.slug, home.id, away.id, 8, 0);
			}

			const db = getDb(env.DB);
			await calculateAchievements(db, [home.id]);

			const achievements = await getAchievements(home.playerId);
			const types = achievements.map((a) => a.type);
			expect(types).toContain("3_goals_5_games");
			expect(types).toContain("5_goals_5_games");
			expect(types).toContain("8_goals_5_games");
		});

		it("does not award goals achievement when fewer than 5 games played", async () => {
			const { client, season, home, away } = await setupLeagueWithSeason();

			for (let i = 0; i < 4; i++) {
				await createMatch(client, season.slug, home.id, away.id, 10, 0);
			}

			const db = getDb(env.DB);
			await calculateAchievements(db, [home.id]);

			const achievements = await getAchievements(home.playerId);
			const types = achievements.map((a) => a.type);
			expect(types).not.toContain("3_goals_5_games");
		});

		it("does not award goals achievement when one of last 5 games has too few goals", async () => {
			const { client, season, home, away } = await setupLeagueWithSeason();

			for (let i = 0; i < 4; i++) {
				await createMatch(client, season.slug, home.id, away.id, 5, 0);
			}
			await createMatch(client, season.slug, home.id, away.id, 2, 0);

			const db = getDb(env.DB);
			await calculateAchievements(db, [home.id]);

			const achievements = await getAchievements(home.playerId);
			const types = achievements.map((a) => a.type);
			expect(types).not.toContain("5_goals_5_games");
		});
	});

	describe("idempotency", () => {
		it("does not duplicate achievements when called multiple times", async () => {
			const { client, season, home, away } = await setupLeagueWithSeason();

			for (let i = 0; i < 5; i++) {
				await createMatch(client, season.slug, home.id, away.id, 2, 1);
			}

			const db = getDb(env.DB);
			await calculateAchievements(db, [home.id]);
			await calculateAchievements(db, [home.id]);

			const achievements = await getAchievements(home.playerId);
			const winStreakCount = achievements.filter((a) => a.type === "5_win_streak").length;
			expect(winStreakCount).toBe(1);
		});
	});

	describe("multiple players", () => {
		it("calculates achievements for multiple season players in one call", async () => {
			const { client, season, home, away } = await setupLeagueWithSeason();

			for (let i = 0; i < 5; i++) {
				await createMatch(client, season.slug, home.id, away.id, 2, 1);
			}

			const db = getDb(env.DB);
			await calculateAchievements(db, [home.id, away.id]);

			const homeAchievements = await getAchievements(home.playerId);
			const homeTypes = homeAchievements.map((a) => a.type);
			expect(homeTypes).toContain("5_win_streak");

			const awayAchievements = await getAchievements(away.playerId);
			const awayTypes = awayAchievements.map((a) => a.type);
			expect(awayTypes).not.toContain("5_win_streak");
		});
	});

	describe("away player achievements", () => {
		it("awards clean sheet streak to away player when they concede 0", async () => {
			const { client, season, home, away } = await setupLeagueWithSeason();

			// Away player wins 0-2 five times (concedes 0 = homeScore)
			for (let i = 0; i < 5; i++) {
				await createMatch(client, season.slug, home.id, away.id, 0, 2);
			}

			const db = getDb(env.DB);
			await calculateAchievements(db, [away.id]);

			const achievements = await getAchievements(away.playerId);
			const types = achievements.map((a) => a.type);
			expect(types).toContain("5_clean_sheet_streak");
			expect(types).toContain("5_win_streak");
		});
	});

	describe("return value", () => {
		it("returns newly earned achievements with player info", async () => {
			const { client, season, home, away } = await setupLeagueWithSeason();

			for (let i = 0; i < 5; i++) {
				await createMatch(client, season.slug, home.id, away.id, 2, 1);
			}

			const db = getDb(env.DB);
			const result = await calculateAchievements(db, [home.id]);

			const types = result.map((a) => a.type);
			expect(types).toContain("5_win_streak");
			expect(types).not.toContain("10_win_streak");

			const winStreak = result.find((a) => a.type === "5_win_streak");
			expect(winStreak?.playerId).toBe(home.playerId);
			expect(winStreak?.name).toBeTruthy();
		});

		it("omits already-earned achievements on subsequent calls", async () => {
			const { client, season, home, away } = await setupLeagueWithSeason();

			for (let i = 0; i < 5; i++) {
				await createMatch(client, season.slug, home.id, away.id, 2, 1);
			}

			const db = getDb(env.DB);
			const first = await calculateAchievements(db, [home.id]);
			expect(first.map((a) => a.type)).toContain("5_win_streak");

			const second = await calculateAchievements(db, [home.id]);
			expect(second).toHaveLength(0);
		});
	});
});
