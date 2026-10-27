import { test, expect, signIn, SEED_LEAGUE, SEED_USER } from "./fixtures/auth";

const STANDINGS_PROCEDURE = "seasonPlayer.getStanding";

const CASES = [
	{ seasonSlug: "season-1", dialogTestId: "create-match-dialog" },
	{ seasonSlug: "1-v-n-1", dialogTestId: "create-one-vn-dialog" },
];

test.describe("Create match dialogs defer standings fetch", () => {
	test.beforeEach(async ({ page }) => {
		await signIn(page, SEED_USER.email, SEED_USER.password);
	});

	for (const { seasonSlug, dialogTestId } of CASES) {
		test(`${seasonSlug}: no standings request until the dialog opens`, async ({ page }) => {
			const standingsRequests: string[] = [];
			page.on("request", (request) => {
				if (request.url().includes(STANDINGS_PROCEDURE)) {
					standingsRequests.push(request.url());
				}
			});

			await page.goto(`/leagues/${SEED_LEAGUE.slug}/seasons/${seasonSlug}/matches`);

			const createButton = page.getByRole("button", { name: "Match", exact: true });
			await expect(createButton).toBeVisible({ timeout: 10000 });
			await expect(page.getByText("Total Matches")).toBeVisible();

			// Allow any trailing queries triggered by the page load to settle.
			await page.waitForTimeout(1000);
			expect(standingsRequests, "standings fetched while the dialog was closed").toHaveLength(0);

			await createButton.click();
			await expect(page.getByTestId(dialogTestId)).toBeVisible();
			await expect.poll(() => standingsRequests.length).toBeGreaterThan(0);
		});
	}
});
