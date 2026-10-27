import { test as base, expect, type Page } from "@playwright/test";
import { signInWithEmulatedProvider } from "../../lib/emulated-sign-in";

const scheme = process.env.CI ? "http" : "https";
const port = process.env.PORTLESS_PORT ?? "1355";
export const API_BASE_URL = `${scheme}://scorebrawl.localhost:${port}`;

// Mirrors the users seeded into the in-Worker emulated providers
// (apps/worker/src/emulate) and the D1 seed.
export const SEED_USER = {
	email: "seed@example.com",
	name: "Seed User",
};

export const SEED_LEAGUE = {
	name: "Scorebrawl",
	slug: "scorebrawl",
};

export const SEED_SEASON = {
	name: "Season 1",
	slug: "season-1",
};

/**
 * Sign in through the emulated Google provider. Password sign-in is gone, and
 * the UI round trip through the emulator picker is slow and flaky in a loop, so
 * specs authenticate through the API and then load the app.
 */
/**
 * Pick an active organization up front. A freshly created session has none, and
 * the app's org-scoped hooks render a guest-ish shell until one is set.
 */
async function setActiveLeague(page: Page) {
	const response = await page.request.get("/api/auth/organization/list");
	if (!response.ok()) return;
	const organizations = (await response.json()) as { id: string; slug: string }[] | null;
	const organization =
		organizations?.find((entry) => entry.slug === SEED_LEAGUE.slug) ?? organizations?.[0];
	if (!organization) return;

	await page.request.post("/api/auth/organization/set-active", {
		data: { organizationId: organization.id },
		headers: { Origin: new URL(API_BASE_URL).origin },
	});
}

export async function signIn(page: Page, email: string = SEED_USER.email) {
	for (let attempt = 0; attempt < 2; attempt++) {
		await signInWithEmulatedProvider(page.request, {
			apiBaseURL: API_BASE_URL,
			provider: "google",
			email,
		});
		await setActiveLeague(page);
		await page.goto("/");

		// The app keeps its own session cache and can briefly render a guest shell,
		// so confirm the browser itself sees the session before handing over.
		const sessionEmail = await expect
			.poll(
				async () =>
					page.evaluate(async () => {
						const response = await fetch("/api/auth/get-session", { credentials: "include" });
						const body = (await response.json()) as { user?: { email: string } } | null;
						return body?.user?.email ?? null;
					}),
				{ timeout: 15_000 }
			)
			.toBe(email)
			.then(() => true)
			.catch(() => false);

		if (sessionEmail) {
			// The app redirects "/" to the last active league; let that settle so the
			// spec's next navigation does not race it.
			await page.waitForLoadState("networkidle");
			return;
		}
	}

	throw new Error(`Could not establish a browser session for ${email}`);
}

// Generate unique league name
export function generateLeagueName() {
	const timestamp = Date.now();
	return {
		name: `Test League ${timestamp}`,
		slug: `test-league-${timestamp}`,
	};
}

export async function signOut(page: Page) {
	await page.context().clearCookies();
	await page.goto("/");
}

// Re-export test and expect from base
export const test = base;
export { expect };
