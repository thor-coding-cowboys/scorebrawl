import { test, expect, signIn, SEED_USER, SEED_LEAGUE } from "./fixtures/auth";

test.describe("Seeded API Key", () => {
	test.beforeEach(async ({ page }) => {
		await signIn(page, SEED_USER.email, SEED_USER.password);
	});

	test("should create an API key via UI and use it to fetch leagues", async ({ page, request }) => {
		// Navigate to profile page
		await page.goto("/profile", { waitUntil: "networkidle" });

		// Click Add API Key button
		await page.getByTestId("add-api-key-button").click();

		// Fill in the key name and submit
		await page.getByTestId("api-key-name-input").fill("E2E Test Device");
		await page.getByTestId("api-key-submit-button").click();

		// Wait for success dialog showing the new key
		const keyElement = page.getByTestId("new-api-key-value");
		await expect(keyElement).toBeVisible({ timeout: 10000 });

		// Grab the API key value
		const apiKey = await keyElement.textContent();
		expect(apiKey).toBeTruthy();
		expect(apiKey).toMatch(/^sb_dev/);

		// Close the success dialog
		await page.getByTestId("api-key-done-button").click();

		// Use the API key to fetch device leagues (without session cookies)
		const leaguesResponse = await request.get("/api/device/leagues", {
			headers: { "x-api-key": apiKey! },
		});
		expect(leaguesResponse.status()).toBe(200);

		const leaguesData = await leaguesResponse.json();
		expect(leaguesData.leagues).toBeInstanceOf(Array);
		expect(leaguesData.leagues.length).toBeGreaterThan(0);
		expect(leaguesData.leagues.some((l: { slug: string }) => l.slug === SEED_LEAGUE.slug)).toBe(
			true
		);
	});

	test("should reject requests with invalid API key", async ({ request }) => {
		const response = await request.get("/api/device/leagues", {
			headers: {
				"x-api-key":
					"sb_dev_invalid_key_here_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
			},
		});
		expect(response.status()).toBe(401);
	});

	test("should reject requests without API key", async ({ request }) => {
		const response = await request.get("/api/device/leagues");
		expect(response.status()).toBe(401);
	});
});
