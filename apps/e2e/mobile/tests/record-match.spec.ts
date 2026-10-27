import {
	expect,
	getStandingIds,
	openSeason,
	readStandingScore,
	SEED_ONE_VN_SEASON,
	signIn,
	test,
} from "./fixtures/auth";

test.describe("Mobile match registration", () => {
	test.beforeEach(async ({ page }) => {
		await signIn(page);
	});

	test("records a 1-v-n game and moves the winner's score", async ({ page }) => {
		await openSeason(page, SEED_ONE_VN_SEASON.slug);

		const playerIds = (await getStandingIds(page)).slice(0, 4);
		expect(playerIds.length).toBeGreaterThanOrEqual(4);

		const winnerId = playerIds[0];
		const loserId = playerIds[1];
		const scoreBefore = await readStandingScore(page, winnerId);
		const loserScoreBefore = await readStandingScore(page, loserId);

		// The header "Match" action opens the recording flow for this score type.
		await page.getByRole("button", { name: "Match" }).click();
		await expect(page.getByTestId("record-game-modal")).toBeVisible();

		for (const id of playerIds) {
			await page.getByTestId(`record-game-player-${id}`).click();
		}

		await page.getByTestId(`record-game-winner-${winnerId}`).click();
		await page.getByTestId("record-game-submit").click();

		await expect(page.getByTestId("record-game-modal")).toBeHidden({ timeout: 30_000 });

		// The match is persisted: the winner gains points, the losers lose them.
		await expect
			.poll(() => readStandingScore(page, winnerId), { timeout: 30_000 })
			.toBeGreaterThan(scoreBefore);

		await expect
			.poll(() => readStandingScore(page, loserId), { timeout: 30_000 })
			.toBeLessThan(loserScoreBefore);
	});
});
