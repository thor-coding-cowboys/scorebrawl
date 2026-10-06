import { test, expect, signIn, SEED_USER, SEED_LEAGUE, SEED_SEASON } from "./fixtures/auth";

test.describe("Session live match", () => {
	test.beforeEach(async ({ page }) => {
		await signIn(page, SEED_USER.email, SEED_USER.password);
	});

	// Covers the session write path end to end: session.getById, session.startNextMatch,
	// session.recordResult (match create + result recording + achievement queue).
	test("starts a live session, starts a match and records a result", async ({ page }) => {
		await page.goto(`/leagues/${SEED_LEAGUE.slug}/seasons/${SEED_SEASON.slug}`);

		// Create the session via the config dialog (default team size 2 -> pick 4 players).
		const startSessionButton = page.getByTestId("start-session-button");
		await expect(startSessionButton).toBeVisible({ timeout: 15000 });
		await startSessionButton.click();

		const playerOptions = page.locator('[data-testid="session-player-option"]:visible');
		await expect(playerOptions.first()).toBeVisible({ timeout: 10000 });
		for (let i = 0; i < 4; i++) {
			await playerOptions.nth(i).click();
		}

		await page.locator('[data-testid="session-config-submit"]:visible').click();

		// Land on the session page.
		await expect(page).toHaveURL(/\/session\/gsess_/, { timeout: 15000 });

		// Start a match from the auto-generated lineup.
		const startMatch = page.getByTestId("session-start-match");
		await expect(startMatch).toBeEnabled({ timeout: 15000 });
		await startMatch.click();

		// Record a 5-0 result.
		const homeIncrement = page.getByTestId("session-home-increment");
		await expect(homeIncrement).toBeEnabled({ timeout: 10000 });
		for (let i = 0; i < 5; i++) {
			await homeIncrement.click();
		}
		await expect(page.getByTestId("session-home-score")).toHaveText("5");

		await page.getByTestId("session-record-result").click();

		// The match is recorded: header reports one played match and a new match is proposed.
		await expect(page.getByTestId("session-matches-played")).toHaveText(/1 played/, {
			timeout: 15000,
		});
		await expect(page.getByTestId("session-start-match")).toBeVisible();

		// Persisted server-side, not just client state.
		await page.reload();
		await expect(page.getByTestId("session-matches-played")).toHaveText(/1 played/, {
			timeout: 15000,
		});
	});
});
