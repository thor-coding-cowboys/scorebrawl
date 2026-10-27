import { writeFileSync } from "node:fs";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";
import { emulateEnvFile } from "../../scripts/lib/emulate-env";

const apiUrl = process.env.MOBILE_E2E_API_URL ?? "http://localhost:5173";
const webPort = process.env.MOBILE_E2E_WEB_PORT ?? "8081";

// See playwright.config.ts: worker vars come from dotenv, which outranks the
// shell, so the API origin for this run is written to apps/worker/.env.local.
// The emulated providers are served by that same Worker origin.
writeFileSync(
	path.resolve(__dirname, "../worker/.env.local"),
	emulateEnvFile({ origin: apiUrl, disableRateLimit: true })
);

/**
 * Plays the Expo web export in Chromium to smoke test the shared React Native
 * screens. The app and the API have to share a hostname (`localhost`, differing
 * only by port) so better-auth cookies stay same-site - `scorebrawl.localhost`
 * would make them separate sites and drop the session cookie.
 */
export default defineConfig({
	testDir: "./mobile/tests",
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: 1,
	timeout: 60_000,
	reporter: [
		["list"],
		["html", { open: "never", outputFolder: "mobile-playwright-report" }],
		["junit", { outputFile: "mobile-playwright-report/results.xml" }],
	],
	use: {
		baseURL: `http://localhost:${webPort}`,
		trace: "on-first-retry",
		screenshot: "only-on-failure",
	},
	projects: [{ name: "mobile-web", use: { ...devices["Pixel 7"] } }],
	webServer: [
		{
			command: "bunx vite --port 5173",
			url: `${apiUrl}/api/version`,
			cwd: "../web",
			reuseExistingServer: !process.env.CI,
			timeout: 180_000,
			env: {
				VITE_GITHUB_CLIENT_ID: "Ov23liEHPLUdBgTj5Cxu",
				VITE_GOOGLE_CLIENT_ID:
					"972190779505-ob8vi6970ib3c8i46plgmu4i9cpr7ohg.apps.googleusercontent.com",
			},
		},
		{
			command: "bun run ./scripts/serve-mobile-web.ts",
			url: `http://localhost:${webPort}`,
			reuseExistingServer: !process.env.CI,
			timeout: 60_000,
		},
	],
});
