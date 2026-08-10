import { test, expect, signIn, SEED_USER, SEED_LEAGUE } from "./fixtures/auth";

test.describe("Darts Match CRUD", () => {
	test.beforeEach(async ({ page }) => {
		await signIn(page, SEED_USER.email, SEED_USER.password);
	});

	test("records a darts game, verifies ELO change, then removes it", async ({ page }) => {
		await page.goto(`/leagues/${SEED_LEAGUE.slug}/seasons/darts-1`);

		await expect(page.locator('[data-testid="standings-table"]:visible')).toBeVisible({
			timeout: 10000,
		});

		// Capture initial standings for the top 4 players
		const standingsTable = page.locator('[data-testid="standings-table"]:visible');
		const standingRows = standingsTable.locator('[data-testid^="standing-row-"]:visible');
		const rows = await standingRows.all();
		const initialScores: Record<string, number> = {};
		for (const row of rows.slice(0, 4)) {
			const testId = await row.getAttribute("data-testid");
			if (testId) {
				const playerId = testId.replace("standing-row-", "");
				const scoreText = await row
					.locator(`[data-testid="standing-score-${playerId}"]:visible`)
					.textContent();
				initialScores[playerId] = Number.parseInt(scoreText || "0", 10);
			}
		}

		// Open darts dialog
		await page.getByTestId("create-match-button").click();
		await expect(page.getByTestId("create-darts-dialog")).toBeVisible();

		// Select game type
		await page.getByTestId("darts-game-type-cricket").click();

		// Select 4 players
		const playerButtons = page.locator('[data-testid^="darts-player-"]');
		const firstFour = await playerButtons.all();
		for (const btn of firstFour.slice(0, 4)) {
			await btn.click();
		}

		// Pick winner = first selected player
		const firstPlayerTestId = await firstFour[0].getAttribute("data-testid");
		const firstPlayerId = firstPlayerTestId?.replace("darts-player-", "");
		if (firstPlayerId) {
			await page.getByTestId(`darts-winner-${firstPlayerId}`).check();
		}

		await page.getByTestId("darts-submit-button").click();
		await expect(page.getByTestId("create-darts-dialog")).not.toBeVisible();

		// Winner's standings score should have increased
		await expect(page.getByTestId("standings-table").first()).toBeVisible();
		if (firstPlayerId) {
			const winnerScoreEl = page
				.locator(`[data-testid="standing-score-${firstPlayerId}"]:visible`)
				.first();
			await expect
				.poll(async () => Number.parseInt((await winnerScoreEl.textContent()) || "0", 10))
				.toBeGreaterThan(initialScores[firstPlayerId] ?? 0);
		}

		// Remove the match via the matches page
		await page.goto(`/leagues/${SEED_LEAGUE.slug}/seasons/darts-1/matches`);
		await expect(page.getByText("Remove Latest")).toBeVisible();
		await page.getByText("Remove Latest").click();
		await expect(page.getByTestId("remove-match-dialog")).toBeVisible();
		await page.getByTestId("remove-match-confirm-button").click();

		// Winner's score should be rolled back
		await page.goto(`/leagues/${SEED_LEAGUE.slug}/seasons/darts-1`);
		if (firstPlayerId) {
			await expect
				.poll(async () => {
					const el = page
						.locator(`[data-testid="standing-score-${firstPlayerId}"]:visible`)
						.first();
					return Number.parseInt((await el.textContent()) || "0", 10);
				})
				.toBe(initialScores[firstPlayerId] ?? 0);
		}
	});
});
