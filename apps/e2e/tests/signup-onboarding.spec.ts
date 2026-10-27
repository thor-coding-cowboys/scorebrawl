import { expect, generateLeagueName, signIn, test } from "./fixtures/auth";

// Seeded in emulate.config.yaml but not in D1: signing in creates the account and
// drops the user into onboarding.
const NEW_USER = "signup-e2e@example.com";

test.describe("Signup and Onboarding", () => {
	test("signs up with a provider and creates a league", async ({ page }) => {
		const testLeague = generateLeagueName();

		await signIn(page, NEW_USER);

		// A fresh account has no league yet.
		await expect(page).toHaveURL(/\/onboarding/, { timeout: 20000 });

		// Step 1: Start onboarding - click "Create your first league"
		await expect(page.getByText(/create your first league/i)).toBeVisible();
		await page.getByText(/create your first league/i).click();

		// Step 2: Create league
		await expect(page).toHaveURL(/\/onboarding\/create-league/);
		await expect(page.getByTestId("league-name-input")).toBeVisible();

		await page.getByTestId("league-name-input").fill(testLeague.name);
		// Slug should be auto-generated
		await expect(page.getByTestId("league-slug-input")).toHaveValue(testLeague.slug);

		await page.getByTestId("league-submit-button").click();

		// Should redirect to the new league page
		await expect(page).toHaveURL(new RegExp(`/leagues/${testLeague.slug}`));
	});
});
