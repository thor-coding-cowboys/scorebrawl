import type { Page } from "@playwright/test";
import { expect, SEED_SEASON, signIn, test } from "./fixtures/auth";

const API_BASE_URL = process.env.MOBILE_E2E_API_URL ?? "http://localhost:5173";

async function setSeasonClosed(page: Page, closed: boolean) {
	const response = await page.request.post(`${API_BASE_URL}/api/trpc/season.updateClosedStatus`, {
		data: { json: { seasonSlug: SEED_SEASON.slug, closed } },
	});
	expect(response.ok()).toBe(true);
}

test.describe("Mobile season ceremony", () => {
	test.beforeEach(async ({ page }) => {
		await signIn(page);
		await setSeasonClosed(page, true);
	});

	test.afterEach(async ({ page }) => {
		await setSeasonClosed(page, false);
	});

	test("shows the season recap hero and its full-screen view on a closed season", async ({
		page,
	}) => {
		await page.goto(`/seasons/${SEED_SEASON.slug}`);

		const hero = page.getByTestId("season-ceremony");
		await expect(hero).toBeVisible({ timeout: 30_000 });
		await expect(hero.getByText("Season recap")).toBeVisible();
		await expect(hero.getByText("Champion", { exact: true })).toBeVisible();
		await expect(hero.getByText("Start next season")).toBeVisible();
		await expect(hero.getByRole("button", { name: /Go to slide/ })).not.toHaveCount(0);

		await hero.getByTestId("recap-full-screen-button").click();
		const fullScreen = page.getByTestId("season-recap-full-screen");
		await expect(fullScreen).toBeVisible();
		await expect(fullScreen.getByText("By the numbers")).toBeAttached();
		await fullScreen.getByRole("button", { name: "Close" }).click();
		await expect(fullScreen).toBeHidden();
	});
});
