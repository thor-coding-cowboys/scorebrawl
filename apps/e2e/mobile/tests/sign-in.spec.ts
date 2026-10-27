import { expect, SEED_USER, signIn, test } from "./fixtures/auth";

test.describe("Mobile sign in", () => {
	test("boots the app, redirects to sign in and authenticates", async ({ page }) => {
		await page.goto("/");

		// No session yet, so the root layout sends the app to the auth screen.
		await expect(page).toHaveURL(/\/sign-in/, { timeout: 30_000 });
		await expect(page.getByText("Sign in to your account")).toBeVisible();

		await signIn(page);

		// The dashboard only renders once the session and the league load.
		await expect(page.locator('[data-testid^="standing-row-"]').first()).toBeVisible({
			timeout: 30_000,
		});
		await expect(page.getByText("General Info")).toBeVisible();
	});

	test("offers provider sign-in only", async ({ page }) => {
		await page.goto("/");
		await expect(page).toHaveURL(/\/sign-in/, { timeout: 30_000 });

		// Password authentication is gone, so the screen only exposes providers.
		// React Native Web renders these as divs with cursor=pointer, not
		// role=button, and the export boots slower than the default timeout.
		const googleButton = page.getByText("Sign in with Google", { exact: true });
		await expect(googleButton).toBeVisible({ timeout: 60_000 });
		await expect(page.getByText("Sign in with GitHub", { exact: true })).toBeVisible();
		await expect(page.getByText("Enter your email below to login to your account")).toBeHidden();

		// The social round trip leaves the export for the API origin; coming back
		// with the shared `localhost` cookie authenticates the app.
		await googleButton.click();
		await page.getByRole("button", { name: new RegExp(SEED_USER.email) }).click();
		await expect(page).toHaveURL(/localhost:5173/, { timeout: 30_000 });

		await page.goto("/");
		await expect(page.locator('[data-testid^="standing-row-"]').first()).toBeVisible({
			timeout: 30_000,
		});
	});
});
