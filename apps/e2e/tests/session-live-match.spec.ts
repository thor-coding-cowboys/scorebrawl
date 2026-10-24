import { test, expect, signIn, SEED_USER, SEED_LEAGUE, SEED_SEASON } from "./fixtures/auth";

test.describe("Session live match", () => {
	test.beforeEach(async ({ page }) => {
		await signIn(page, SEED_USER.email, SEED_USER.password);
	});

	// Covers the session write path end to end: session.getById, session.startNextMatch,
	// session.recordResult (match create + result recording + achievement queue).
	test("starts a live session, starts a match and records a result", async ({ page, browser }) => {
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

		// In-progress scores persist and sync to a second device.
		const nextMatch = page.getByTestId("session-start-match");
		await expect(nextMatch).toBeEnabled({ timeout: 15000 });
		await nextMatch.click();
		await expect(page.getByTestId("session-home-increment")).toBeEnabled({ timeout: 15000 });
		const sessionUrl = page.url();

		await page.getByTestId("session-home-increment").click();
		await page.getByTestId("session-home-increment").click();
		await expect(page.getByTestId("session-home-score")).toHaveText("2");

		const secondContext = await browser.newContext({ ignoreHTTPSErrors: true });
		const secondPage = await secondContext.newPage();
		try {
			await signIn(secondPage, SEED_USER.email, SEED_USER.password);
			await secondPage.goto(sessionUrl);

			// Mount-sync: a device that loads after scoring shows the persisted in-progress score.
			await expect(secondPage.getByTestId("session-home-score")).toHaveText("2", {
				timeout: 15000,
			});

			// Live-sync: further scoring on device one reflects on device two over SSE.
			await page.getByTestId("session-home-increment").click();
			await expect(page.getByTestId("session-home-score")).toHaveText("3");
			await expect(secondPage.getByTestId("session-home-score")).toHaveText("3", {
				timeout: 10000,
			});
		} finally {
			await secondContext.close();
		}

		// Ending the session swaps the live view for the summary in place. The
		// session URL must keep resolving to the results, not the live view or the
		// "start session" dialog.
		await page.getByTestId("session-end").click();
		await page.getByTestId("session-end-confirm").click();

		await expect(page.getByText("Session Summary")).toBeVisible({ timeout: 15000 });
		await expect(page).toHaveURL(sessionUrl);
		await expect(page.getByTestId("session-end")).toHaveCount(0);

		// Reloading the restored URL still shows the results.
		await page.reload();
		await expect(page.getByText("Session Summary")).toBeVisible({ timeout: 15000 });
		await expect(page).toHaveURL(sessionUrl);

		// Legacy summary links redirect to the session route.
		await page.goto(`${sessionUrl}/summary`);
		await expect(page).toHaveURL(sessionUrl);
		await expect(page.getByText("Session Summary")).toBeVisible({ timeout: 15000 });

		// The session entry route resolves to the most recent session, which is
		// finished, so it shows the results instead of starting a new session.
		await page.goto(sessionUrl.replace(/\/session\/.*$/, "/session"));
		await expect(page).toHaveURL(sessionUrl);
		await expect(page.getByText("Session Summary")).toBeVisible({ timeout: 15000 });
	});
});
