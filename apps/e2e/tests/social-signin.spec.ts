import { test, expect, signIn, signOut, SEED_USER, type Page } from "./fixtures/auth";

// Seeded in the in-Worker emulated providers (apps/worker/src/emulate).
const EMULATED_GOOGLE_EMAIL = "emulate-e2e@example.com";
const EMULATED_GITHUB_LOGIN = "seed";

async function signInWithGoogle(page: Page) {
	await page.goto("/auth/sign-in", { waitUntil: "networkidle" });
	await page.getByRole("button", { name: /sign in with google/i }).click();
	await page.getByRole("button", { name: new RegExp(EMULATED_GOOGLE_EMAIL) }).click();
}

async function signInWithGitHub(page: Page) {
	await page.goto("/auth/sign-in", { waitUntil: "networkidle" });
	await page.getByRole("button", { name: /sign in with github/i }).click();
	await page.getByRole("button", { name: new RegExp(EMULATED_GITHUB_LOGIN) }).click();
}

async function sessionUserId(page: Page) {
	const response = await page.request.get("/api/auth/get-session");
	const body = (await response.json()) as { user?: { id: string; email: string } } | null;
	return body?.user;
}

test.describe("Emulated social sign-in", () => {
	test("signs up a new user through the emulated Google provider", async ({ page }) => {
		await signInWithGoogle(page);

		await expect(page).not.toHaveURL(/\/auth\/sign-in/, { timeout: 20000 });
		const user = await sessionUserId(page);
		expect(user?.email).toBe(EMULATED_GOOGLE_EMAIL);
	});

	test("links the emulated GitHub account to the existing seed user", async ({ page }) => {
		await signIn(page);
		const seedUser = await sessionUserId(page);
		expect(seedUser?.email).toBe(SEED_USER.email);

		await signOut(page);
		await signInWithGitHub(page);

		await expect(page).not.toHaveURL(/\/auth\/sign-in/, { timeout: 20000 });
		const linkedUser = await sessionUserId(page);
		expect(linkedUser?.email).toBe(SEED_USER.email);
		expect(linkedUser?.id).toBe(seedUser?.id);
	});
});
