import { writeFileSync } from "node:fs";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const scheme = process.env.CI ? "http" : "https";
const port = process.env.PORTLESS_PORT || "1355";
const baseURL = `${scheme}://scorebrawl.localhost:${port}`;

// Worker vars come from wrangler dotenv, which outranks the shell environment,
// and scheme/port differ between CI and a local run - so write them per run to
// the gitignored apps/worker/.env.local (loaded after .env).
writeFileSync(
	path.resolve(__dirname, "../worker/.env.local"),
	[
		`BETTER_AUTH_URL=${baseURL}`,
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
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
	testDir: "./tests",
	globalSetup: "./global-setup.ts",
	/* Run tests serially - shared database requires isolation */
	fullyParallel: false,
	/* Fail the build on CI if you accidentally left test.only in the source code. */
	forbidOnly: !!process.env.CI,
	/* Retry on CI only */
	retries: process.env.CI ? 2 : 0,
	/* Single worker for shared database */
	workers: 1,
	/* Reporter to use. See https://playwright.dev/docs/test-reporters */
	reporter: [
		["html", { open: "never" }],
		["junit", { outputFile: "playwright-report/results.xml" }],
	],
	/* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
	use: {
		baseURL,
		/* CI runs over plain HTTP; local runs over portless HTTPS (self-signed) */
		ignoreHTTPSErrors: true,
		/* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
		trace: "on-first-retry",
	},

	/* Configure projects for major browsers */
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],

	/* Emulated third-party providers (GitHub/Google OAuth + Resend) */
	webServer: [
		{
			command: "bun run emulate",
			url: "http://localhost:4002/.well-known/openid-configuration",
			reuseExistingServer: !process.env.CI,
			cwd: "../..",
			timeout: 60_000,
			stdout: "pipe",
			stderr: "pipe",
		},
		{
			command: "bun run dev",
			// Worker route, so readiness means the Worker answers too (the SPA
			// assets are served before the Worker is warm).
			url: `${baseURL}/api/version`,
			reuseExistingServer: !process.env.CI,
			cwd: "../..",
			timeout: 120_000,
			stdout: "pipe",
			stderr: "pipe",
			ignoreHTTPSErrors: true,
			env: {
				// Public client ids (also in wrangler.jsonc) so the social buttons
				// render in the built web app; the worker reads the same ids.
				VITE_GITHUB_CLIENT_ID: "Ov23liEHPLUdBgTj5Cxu",
				VITE_GOOGLE_CLIENT_ID:
					"972190779505-ob8vi6970ib3c8i46plgmu4i9cpr7ohg.apps.googleusercontent.com",
			},
			// Wait for Vite to report ready (Vite 6 uses "VITE v" message).
			// Regex must tolerate ANSI color codes present in piped output.
			wait: {
				stdout: /VITE[^\n]*?ready/i,
			},
		},
	],
});
