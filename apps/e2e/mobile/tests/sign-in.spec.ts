import { expect, SEED_USER, signIn, test } from "./fixtures/auth";

test.describe("Mobile sign in", () => {
	test("boots the app, redirects to sign in and authenticates", async ({ page }) => {
		await page.goto("/");

		// No session yet, so the root layout sends the app to the auth screen.
		await expect(page).toHaveURL(/\/sign-in/, { timeout: 30_000 });
		await expect(page.getByTestId("sign-in-email")).toBeVisible();
		await expect(page.getByTestId("sign-in-password")).toBeVisible();
		await expect(page.getByText("Enter your email below to login to your account")).toBeVisible();

		await signIn(page, SEED_USER.email, SEED_USER.password);

		// The dashboard only renders once the session and the league load.
		await expect(page.locator('[data-testid^="standing-row-"]').first()).toBeVisible({
			timeout: 30_000,
		});
		await expect(page.getByText("General Info")).toBeVisible();
	});

	test("rejects bad credentials", async ({ page }) => {
		await page.goto("/");
		await expect(page.getByTestId("sign-in-email")).toBeVisible({ timeout: 30_000 });

		await page.getByTestId("sign-in-email").fill(SEED_USER.email);
		await page.getByTestId("sign-in-password").fill("not-the-password");
		await page.getByTestId("sign-in-submit").click();

		await expect(page.getByText(/invalid email or password/i)).toBeVisible({ timeout: 15_000 });
		await expect(page).toHaveURL(/\/sign-in/);
	});
});
