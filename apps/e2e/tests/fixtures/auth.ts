import { test as base, expect, type Page } from "@playwright/test";

// Seed user credentials
export const SEED_USER = {
	email: "seeded@scorebrawl.com",
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

// Generate unique test user for signup tests
export function generateTestUser() {
	const timestamp = Date.now();
	return {
		name: `Test User ${timestamp}`,
		email: `test-${timestamp}@e2e.test`,
		password: "Test.1234!",
	};
}

// Generate unique league name
export function generateLeagueName() {
	const timestamp = Date.now();
	return {
		name: `Test League ${timestamp}`,
		slug: `test-league-${timestamp}`,
	};
}

// Auth helper functions
export async function signIn(page: Page, email: string, password: string) {
	await page.goto("/auth/sign-in", { waitUntil: "networkidle" });
	await expect(page.getByTestId("signin-submit-button")).toBeVisible({ timeout: 15000 });
	await page.getByTestId("signin-email-input").fill(email);
	await page.getByTestId("signin-password-input").fill(password);
	await page.getByTestId("signin-submit-button").click();

	// Wait for either navigation away from sign-in page or check for error
	await expect(page).not.toHaveURL(/\/auth\/sign-in/, { timeout: 15000 });
}

export async function signUp(page: Page, name: string, email: string, password: string) {
	await page.goto("/auth/sign-up", { waitUntil: "networkidle" });
	await expect(page.getByTestId("signup-submit-button")).toBeVisible({ timeout: 15000 });
	await page.getByTestId("signup-name-input").fill(name);
	await page.getByTestId("signup-email-input").fill(email);
	await page.getByTestId("signup-password-input").fill(password);
	await page.getByTestId("signup-submit-button").click();
	// Wait for navigation away from sign-up page
	await expect(page).not.toHaveURL(/\/auth\/sign-up/);
}

export async function signOut(page: Page) {
	// Navigate to settings and sign out, or just clear cookies
	await page.context().clearCookies();
	await page.goto("/");
}

// Re-export test and expect from base
export const test = base;
export { expect };
