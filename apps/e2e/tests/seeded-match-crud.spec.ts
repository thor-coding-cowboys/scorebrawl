import { test, expect, signIn, SEED_USER, SEED_LEAGUE, SEED_SEASON } from "./fixtures/auth";

test.describe("Seeded Match CRUD", () => {
	test.beforeEach(async ({ page }) => {
		// Sign in with seeded user before each test
		await signIn(page, SEED_USER.email, SEED_USER.password);
	});

	test("should create a match and verify ELO changes, then remove it and verify rollback", async ({
		page,
	}) => {
		// Navigate to the seeded season
		await page.goto(`/leagues/${SEED_LEAGUE.slug}/seasons/${SEED_SEASON.slug}`);

		// Wait for standings to load
		await expect(page.getByTestId("standings-table")).toBeVisible({ timeout: 10000 });

		// Store initial standings scores for comparison
		const standingRows = page.locator('[data-testid^="standing-row-"]');
		await expect(standingRows.first()).toBeVisible();

		// Get initial player scores (first 4 players for 2v2 match)
		const initialScores: Record<string, number> = {};
		const rows = await standingRows.all();
		for (const row of rows.slice(0, 4)) {
			const testId = await row.getAttribute("data-testid");
			if (testId) {
				const playerId = testId.replace("standing-row-", "");
				const scoreEl = row.locator(`[data-testid="standing-score-${playerId}"]`);
				const scoreText = await scoreEl.textContent();
				initialScores[playerId] = Number.parseInt(scoreText || "0", 10);
			}
		}

		// Also check team standings if available
		const teamStandingsTable = page.getByTestId("team-standings-table");
		const hasTeamStandings = await teamStandingsTable.isVisible().catch(() => false);

		if (hasTeamStandings) {
			const teamRows = page.locator('[data-testid^="team-standing-row-"]');
			const teamRowElements = await teamRows.all();
			for (const row of teamRowElements.slice(0, 4)) {
				const testId = await row.getAttribute("data-testid");
				if (testId) {
					// Team standings are visible but we don't need to track them for this test
				}
			}
		}

		// Step 1: Open create match dialog
		await page.getByTestId("create-match-button").click();
		await expect(page.getByTestId("create-match-dialog")).toBeVisible();

		// Step 2: Select players (2v2)
		await page.getByTestId("match-select-players-button").click();
		await expect(page.getByTestId("player-selection-drawer")).toBeVisible();

		// Select first 2 players for home team (click in home column - left side)
		// The drawer has two columns: Home (left) and Away (right)
		// Each player appears in both columns with the same data-testid
		// We need to click in the correct column to assign them to that team

		// Get the home and away columns by their testids
		const homeColumn = page.getByTestId("player-selection-home-column");
		const awayColumn = page.getByTestId("player-selection-away-column");

		// Get all player buttons in each column
		const homePlayerButtons = homeColumn.locator('[data-testid^="player-item-"]');
		const awayPlayerButtons = awayColumn.locator('[data-testid^="player-item-"]');

		// Select first 2 players for home team
		await homePlayerButtons.nth(0).click();
		await homePlayerButtons.nth(1).click();

		// Select next 2 players for away team (players 2 and 3 in the away column)
		await awayPlayerButtons.nth(2).click();
		await awayPlayerButtons.nth(3).click();

		// Click Done to close player selection
		await page.getByTestId("match-done-button").click();
		await expect(page.getByTestId("player-selection-drawer")).not.toBeVisible();

		// Verify players are assigned
		await expect(page.getByTestId("match-home-roster")).toBeVisible();
		await expect(page.getByTestId("match-away-roster")).toBeVisible();

		// Step 3: Set scores (use 11-0 which can't exist in seeded data since max is 10)
		for (let i = 0; i < 11; i++) {
			await page.getByTestId("match-home-increment").click();
		}
		await expect(page.getByTestId("match-home-score")).toHaveText("11");

		// Away score stays at 0

		// Step 4: Submit match - wait for button to be enabled first
		const submitButton = page.getByTestId("match-submit-button");
		await expect(submitButton).toBeEnabled({ timeout: 5000 });

		// Click the submit button
		await submitButton.click();

		// Wait for dialog to close (indicates mutation completed)
		await expect(page.getByTestId("create-match-dialog")).not.toBeVisible({ timeout: 15000 });

		// Wait for the new match to appear in the list - verify score 11-0
		await expect(async () => {
			const latestMatchRow = page.locator('[data-testid^="match-row-"]').first();
			const scoreEls = latestMatchRow.locator('[data-testid^="match-score-"]');
			await expect(scoreEls).toHaveCount(2);
			const scores = await scoreEls.allTextContents();
			expect(scores[0]).toBe("11");
			expect(scores[1]).toBe("0");
		}).toPass({ timeout: 10000 });

		// Verify standings updated
		let scoresChanged = false;
		for (const [playerId, initialScore] of Object.entries(initialScores)) {
			const scoreEl = page.getByTestId(`standing-score-${playerId}`);
			const newScoreText = await scoreEl.textContent();
			const newScore = Number.parseInt(newScoreText || "0", 10);
			if (newScore !== initialScore) {
				scoresChanged = true;
				break;
			}
		}
		expect(scoresChanged).toBe(true);

		// Step 7: Remove the latest match
		await page.getByTestId("remove-latest-match-button").click();

		// Wait for remove dialog and confirm removal
		await expect(page.getByTestId("remove-match-dialog")).toBeVisible();
		await page.getByTestId("remove-match-confirm-button").click();

		// Wait for the match with 11-0 score to disappear
		await expect(async () => {
			const latestMatchRow = page.locator('[data-testid^="match-row-"]').first();
			const scoreEls = latestMatchRow.locator('[data-testid^="match-score-"]');
			await expect(scoreEls).toHaveCount(2);
			const scores = await scoreEls.allTextContents();
			// The 11-0 match should no longer be the first row
			expect(scores[0] !== "11" || scores[1] !== "0").toBe(true);
		}).toPass({ timeout: 10000 });

		// Step 8: Verify scores went back to original (with retry for timing)
		await expect(async () => {
			for (const [playerId, initialScore] of Object.entries(initialScores)) {
				const scoreEl = page.getByTestId(`standing-score-${playerId}`);
				const revertedScoreText = await scoreEl.textContent();
				const revertedScore = Number.parseInt(revertedScoreText || "0", 10);
				expect(revertedScore).toBe(initialScore);
			}
		}).toPass({ timeout: 10000 });
	});

	test("should display standings correctly for seeded data", async ({ page }) => {
		await page.goto(`/leagues/${SEED_LEAGUE.slug}/seasons/${SEED_SEASON.slug}`);

		// Verify standings table is visible
		await expect(page.getByTestId("standings-table")).toBeVisible({ timeout: 10000 });

		// Verify there are standings rows
		const standingRows = page.locator('[data-testid^="standing-row-"]');
		const count = await standingRows.count();
		expect(count).toBeGreaterThan(0);

		// Verify standings have expected columns (name, MP, score)
		const firstRow = standingRows.first();
		await expect(firstRow.locator('[data-testid^="standing-name-"]')).toBeVisible();
		await expect(firstRow.locator('[data-testid^="standing-mp-"]')).toBeVisible();
		await expect(firstRow.locator('[data-testid^="standing-score-"]')).toBeVisible();
	});

	test("should display latest matches for seeded data", async ({ page }) => {
		await page.goto(`/leagues/${SEED_LEAGUE.slug}/seasons/${SEED_SEASON.slug}`);

		// Wait for matches to load
		await expect(page.getByTestId("latest-matches-table")).toBeVisible({ timeout: 10000 });

		// Verify there are match rows
		const matchRows = page.locator('[data-testid^="match-row-"]');
		const count = await matchRows.count();
		expect(count).toBeGreaterThan(0);

		// Verify match has scores displayed (new format: inline with team names)
		const firstMatch = matchRows.first();
		const scoreEls = firstMatch.locator('[data-testid^="match-score-"]');
		await expect(scoreEls).toHaveCount(2);
		const scores = await scoreEls.allTextContents();
		expect(scores.length).toBe(2);
		expect(Number.parseInt(scores[0], 10)).toBeGreaterThanOrEqual(0);
		expect(Number.parseInt(scores[1], 10)).toBeGreaterThanOrEqual(0);
	});
});
