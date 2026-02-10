import { test, expect, generateTestUser, generateLeagueName } from "./fixtures/auth";

test.describe("Signup and Onboarding", () => {
	// Skip this test for now - there's an application bug with SidebarProvider
	// after signup that needs to be fixed separately
	test("should sign up a new user and create a league", async ({ page }) => {
		const testUser = generateTestUser();
		const testLeague = generateLeagueName();

		// Step 1: Sign up
		await page.goto("/auth/sign-up", { waitUntil: "networkidle" });
		// CardTitle renders as div, not heading - check for submit button presence
		await expect(page.getByTestId("signup-submit-button")).toBeVisible({ timeout: 15000 });

		await page.getByTestId("signup-name-input").fill(testUser.name);
		await page.getByTestId("signup-email-input").fill(testUser.email);
		await page.getByTestId("signup-password-input").fill(testUser.password);
		await page.getByTestId("signup-submit-button").click();

		// Should redirect to onboarding after signup
		await expect(page).toHaveURL(/\/onboarding/);

		// Step 2: Start onboarding - click "Create your first league"
		// Wait for the page to load and find the button text
		await expect(page.getByText(/create your first league/i)).toBeVisible();
		await page.getByText(/create your first league/i).click();

		// Step 3: Create league
		await expect(page).toHaveURL(/\/onboarding\/create-league/);
		await expect(page.getByTestId("league-name-input")).toBeVisible();

		await page.getByTestId("league-name-input").fill(testLeague.name);
		// Slug should be auto-generated
		await expect(page.getByTestId("league-slug-input")).toHaveValue(testLeague.slug);

		await page.getByTestId("league-submit-button").click();

		// Should redirect to the new league page
		await expect(page).toHaveURL(new RegExp(`/leagues/${testLeague.slug}`));
	});

	test("should show validation errors on signup form", async ({ page }) => {
		await page.goto("/auth/sign-up", { waitUntil: "networkidle" });

		// Submit empty form
		await expect(page.getByTestId("signup-submit-button")).toBeVisible({ timeout: 15000 });
		await page.getByTestId("signup-submit-button").click();

		// Should show validation errors
		await expect(page.getByText(/name is required/i)).toBeVisible();
		await expect(page.getByText(/valid email/i)).toBeVisible();
		await expect(page.getByText(/at least 8 characters/i)).toBeVisible();
	});

	test("should navigate between sign-in and sign-up", async ({ page }) => {
		await page.goto("/auth/sign-up", { waitUntil: "networkidle" });
		// CardTitle renders as div - check for submit button
		await expect(page.getByTestId("signup-submit-button")).toBeVisible({ timeout: 15000 });

		// Click "Sign In" link
		await page.getByRole("link", { name: "Sign In" }).click();
		await expect(page).toHaveURL(/\/auth\/sign-in/);
		await expect(page.getByTestId("signin-submit-button")).toBeVisible();

		// Click "Sign Up" link
		await page.getByRole("link", { name: "Sign Up" }).click();
		await expect(page).toHaveURL(/\/auth\/sign-up/);
	});
});
