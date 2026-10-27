import { test as base, expect, type Page } from "@playwright/test";

// Mirrors the web suite fixtures - the same seeded league and users.
export const SEED_USER = {
	email: "seed@example.com",
	password: "Test.1234",
};

export const SEED_LEAGUE = {
	name: "Scorebrawl",
	slug: "scorebrawl",
};

export const SEED_SEASON = {
	name: "Season 1",
	slug: "season-1",
};

export const SEED_ONE_VN_SEASON = {
	name: "1-v-N Season",
	slug: "1-v-n-1",
};

export async function signIn(page: Page, email: string, password: string) {
	await page.goto("/");

	await expect(page.getByTestId("sign-in-email")).toBeVisible({ timeout: 30_000 });
	await page.getByTestId("sign-in-email").fill(email);
	await page.getByTestId("sign-in-password").fill(password);
	await page.getByTestId("sign-in-submit").click();

	await expect(page.getByTestId("sign-in-submit")).toBeHidden({ timeout: 30_000 });
}

/**
 * The mobile app keeps the season in a search param on the home route, so the
 * dashboard can be opened directly without walking the drawer.
 */
export async function openSeason(page: Page, seasonSlug: string) {
	await page.goto(`/?seasonSlug=${seasonSlug}`);
	await expect(page.locator('[data-testid^="standing-row-"]').first()).toBeVisible({
		timeout: 30_000,
	});
}

export async function getStandingIds(page: Page) {
	const rows = page.locator('[data-testid^="standing-row-"]');
	await expect(rows.first()).toBeVisible({ timeout: 30_000 });

	const ids: string[] = [];
	for (const row of await rows.all()) {
		const testId = await row.getAttribute("data-testid");
		if (testId) ids.push(testId.replace("standing-row-", ""));
	}

	return ids;
}

export async function readStandingScore(page: Page, id: string) {
	const score = await page.getByTestId(`standing-score-${id}`).textContent();
	return Number.parseInt(score ?? "0", 10);
}

export const test = base;
export { expect };
