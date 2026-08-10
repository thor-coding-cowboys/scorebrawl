import { test, expect, signIn, SEED_USER, SEED_LEAGUE } from "./fixtures/auth";

test.describe("1-v-n Match CRUD", () => {
	test.beforeEach(async ({ page }) => {
		await signIn(page, SEED_USER.email, SEED_USER.password);
	});

	test("records a 1-v-n game, verifies ELO change, then removes it", async ({ page }) => {
		await page.goto(`/leagues/${SEED_LEAGUE.slug}/seasons/1-v-n-1`);

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

		// Open 1-v-n dialog
		await page.getByTestId("create-match-button").click();
		await expect(page.getByTestId("create-one-vn-dialog")).toBeVisible();

		// Select 4 players
		const playerButtons = page.locator('[data-testid^="one-vn-player-"]');
		const firstFour = await playerButtons.all();
		for (const btn of firstFour.slice(0, 4)) {
			await btn.click();
		}

		// Pick winner = first selected player
		const firstPlayerTestId = await firstFour[0].getAttribute("data-testid");
		const firstPlayerId = firstPlayerTestId?.replace("one-vn-player-", "");
		if (firstPlayerId) {
			await page.getByTestId(`one-vn-winner-${firstPlayerId}`).check();
		}

		await page.getByTestId("one-vn-submit-button").click();
		await expect(page.getByTestId("create-one-vn-dialog")).not.toBeVisible();

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
		await page.goto(`/leagues/${SEED_LEAGUE.slug}/seasons/1-v-n-1/matches`);
		await expect(page.getByText("Remove Latest")).toBeVisible();
		await page.getByText("Remove Latest").click();
		await expect(page.getByTestId("remove-match-dialog")).toBeVisible();
		await page.getByTestId("remove-match-confirm-button").click();

		// Winner's score should be rolled back
		await page.goto(`/leagues/${SEED_LEAGUE.slug}/seasons/1-v-n-1`);
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
