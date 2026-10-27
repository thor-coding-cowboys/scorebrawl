import { chromium } from "@playwright/test";

const scheme = process.env.CI ? "http" : "https";
const port = process.env.PORTLESS_PORT ?? "1355";
const baseURL = `${scheme}://scorebrawl.localhost:${port}`;

/**
 * Vite transforms routes and pre-bundles deps on first request, which can take
 * longer than a spec's first assertion and leaves the app rendering a guest
 * shell. Warm the app (and a Worker route) once before the suite starts.
 */
export default async function globalSetup() {
	const browser = await chromium.launch();
	try {
		const page = await browser.newPage({ ignoreHTTPSErrors: true });
		await page.goto(`${baseURL}/auth/sign-in`, { waitUntil: "networkidle" });
		await page.evaluate(async () => {
			await fetch("/api/auth/get-session", { credentials: "include" });
		});
	} finally {
		await browser.close();
	}
}
