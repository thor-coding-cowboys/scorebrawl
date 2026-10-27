import { expect, openSeason, SEED_SEASON, signIn, test } from "./fixtures/auth";

test.describe("Mobile session flow", () => {
	test.beforeEach(async ({ page }) => {
		await signIn(page);
	});

	test("creates a session, starts a match and records the result", async ({ page }) => {
		await openSeason(page, SEED_SEASON.slug);

		// The header play action starts a session when none is active.
		await page.getByRole("button", { name: "Start session" }).click();
		await expect(page.getByTestId("session-config-modal")).toBeVisible();

		// Step 1: rotation settings, step 2: player selection.
		await page.getByTestId("session-config-next").click();

		const playerOptions = page.locator('[data-testid^="session-player-option-"]');
		await expect(playerOptions.first()).toBeVisible({ timeout: 15_000 });
		for (let i = 0; i < 4; i++) {
			await playerOptions.nth(i).click();
		}

		await page.getByTestId("session-config-submit").click();

		// The session view opens with an auto-proposed lineup.
		const startMatch = page.getByTestId("session-start-match");
		await expect(startMatch).toBeEnabled({ timeout: 30_000 });
		await startMatch.click();

		// "Record Result" only renders once the match is live, which is also when
		// the score steppers accept input.
		await expect(page.getByTestId("session-record-result")).toBeVisible({ timeout: 30_000 });

		// Record a 1-0 result. Deliberately a single increment: the score sync
		// debounces at 300ms and late realtime echoes overwrite the local score,
		// which makes multi-click sequences racy under automation. One increment
		// still covers updateMatchScore + recordResult.
		const homeIncrement = page.getByTestId("session-home-increment");
		await homeIncrement.click();
		await expect(page.getByTestId("session-home-score")).toHaveText("1");
		await expect(page.getByTestId("session-away-score")).toHaveText("0");

		// Let the debounced sync and its realtime echo settle before recording.
		await page.waitForTimeout(1_000);
		await expect(page.getByTestId("session-home-score")).toHaveText("1");

		await page.getByTestId("session-record-result").click();

		// Persisted server-side: the session reports the match and proposes the next one.
		await expect(page.getByTestId("session-matches-played")).toHaveText(/1 played/, {
			timeout: 30_000,
		});
		await expect(page.getByTestId("session-start-match")).toBeVisible();
	});
});
