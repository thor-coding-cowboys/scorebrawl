import { test, expect, signIn, SEED_USER, SEED_LEAGUE } from "./fixtures/auth";

test.describe("Team Page", () => {
	test.beforeEach(async ({ page }) => {
		// Sign in with seeded user before each test
		await signIn(page, SEED_USER.email, SEED_USER.password);
	});

	test("should navigate to teams page and render correctly", async ({ page }) => {
		// Navigate to the seeded league's teams page
		await page.goto(`/leagues/${SEED_LEAGUE.slug}/teams`);

		// Wait for the page to load and verify we're on the teams page
		await expect(page).toHaveURL(`/leagues/${SEED_LEAGUE.slug}/teams`);

		// Verify the page title/header is visible
		await expect(page.getByRole("heading", { name: /teams/i })).toBeVisible();

		// Verify stats cards are rendered
		await expect(page.getByText("Total Teams")).toBeVisible();
		await expect(page.getByText("Active Teams")).toBeVisible();
		await expect(page.getByText("Avg Players")).toBeVisible();

		// Verify the teams list is visible
		await expect(page.getByText(/Showing \d+ of \d+/)).toBeVisible();

		// Verify at least one team row is present
		const teamRows = page.locator('[class*="divide-y"] > div');
		await expect(teamRows.first()).toBeVisible();
	});

	test("should navigate to team detail page when clicking a team", async ({ page }) => {
		// Navigate to the teams list page
		await page.goto(`/leagues/${SEED_LEAGUE.slug}/teams`);

		// Wait for teams to load
		await expect(page.getByText(/Showing \d+ of \d+/)).toBeVisible();

		// Click on the first team in the list
		const firstTeam = page.locator('[class*="divide-y"] > div').first();
		await expect(firstTeam).toBeVisible();

		// Get the team name before clicking
		const teamName = await firstTeam.locator("p.font-medium").textContent();
		expect(teamName).toBeTruthy();

		// Click on the team row
		await firstTeam.click();

		// Wait for navigation to team detail page
		await expect(page).toHaveURL(/\/leagues\/[^/]+\/teams\/[^/]+$/);

		// Verify the team detail page rendered with the team name in header
		await expect(page.getByRole("heading", { name: teamName || "" })).toBeVisible();

		// Verify team stats cards are visible
		await expect(page.getByText("Current Score")).toBeVisible();
		await expect(page.getByText("Win Rate", { exact: true })).toBeVisible();
		await expect(page.getByText("Total Matches")).toBeVisible();
		await expect(page.getByText("Best Season")).toBeVisible();

		// Verify charts section
		await expect(page.getByText("Season Performance")).toBeVisible();
		await expect(page.getByText("Match Results by Season")).toBeVisible();

		// Verify team roster section
		await expect(page.getByText("Team Roster")).toBeVisible();

		// Verify recent matches section
		await expect(page.getByText("Recent Matches")).toBeVisible();
	});

	test("should navigate to team detail from team standings", async ({ page }) => {
		// Navigate to the season dashboard where team standings are shown
		await page.goto(`/leagues/${SEED_LEAGUE.slug}`);

		// Wait for the page to load
		await expect(page.getByText("Team Standings")).toBeVisible();

		// Wait for team standings table to be visible
		await expect(page.getByTestId("team-standings-table")).toBeVisible();

		// Click on the first team row in standings
		const firstTeamRow = page.getByTestId(/^team-standing-row-/).first();
		await expect(firstTeamRow).toBeVisible();

		// Get the team name before clicking
		const teamName = await firstTeamRow
			.locator('[data-testid^="team-standing-name-"]')
			.textContent();
		expect(teamName).toBeTruthy();

		// Click on the team row
		await firstTeamRow.click();

		// Wait for navigation to team detail page
		await expect(page).toHaveURL(/\/leagues\/[^/]+\/teams\/[^/]+$/);

		// Verify the team detail page rendered with the team name in header
		await expect(page.getByRole("heading", { name: teamName || "" })).toBeVisible();

		// Verify team stats cards are visible
		await expect(page.getByText("Current Score")).toBeVisible();
		await expect(page.getByText("Win Rate", { exact: true })).toBeVisible();
		await expect(page.getByText("Total Matches")).toBeVisible();
		await expect(page.getByText("Best Season")).toBeVisible();
	});
});
