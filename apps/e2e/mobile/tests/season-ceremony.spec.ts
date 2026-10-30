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

	test("shows the champion banner and season highlights on a closed season", async ({ page }) => {
		await page.goto(`/seasons/${SEED_SEASON.slug}`);

		const recap = page.getByTestId("season-ceremony");
		await expect(recap).toBeVisible({ timeout: 30_000 });
		const banner = recap.getByTestId("champion-banner");
		await expect(banner.getByText("Season champion")).toBeVisible();
		await expect(banner.getByText("Start next season")).toBeVisible();
		await expect(recap.getByText("Player podium")).toBeVisible();
		await expect(recap.getByText("By the numbers")).toBeAttached();
	});
});
