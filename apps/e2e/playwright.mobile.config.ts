import { writeFileSync } from "node:fs";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const apiUrl = process.env.MOBILE_E2E_API_URL ?? "http://localhost:5173";
const webPort = process.env.MOBILE_E2E_WEB_PORT ?? "8081";

// See playwright.config.ts: worker vars come from dotenv, which outranks the
// shell, so the API origin for this run is written to apps/worker/.env.local.
writeFileSync(
	path.resolve(__dirname, "../worker/.env.local"),
	[
		`BETTER_AUTH_URL=${apiUrl}`,
		"EMULATE_GITHUB_URL=http://localhost:4001",
		"EMULATE_GOOGLE_URL=http://localhost:4002",
		"GITHUB_CLIENT_SECRET=emulate-github-secret",
		"GOOGLE_CLIENT_SECRET=emulate-google-secret",
		"RESEND_API_KEY=re_emulated_key",
		"RESEND_BASE_URL=http://localhost:4008",
		"DISABLE_RATE_LIMIT=true",
		"",
	].join("\n")
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
			command: "bun run emulate",
			url: "http://localhost:4002/.well-known/openid-configuration",
			reuseExistingServer: !process.env.CI,
			cwd: "../..",
			timeout: 60_000,
		},
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
