import { defineConfig, devices } from "@playwright/test";

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
	testDir: "./tests",
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
		baseURL: "http://localhost:5173",
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

	/* Run your local dev server before starting the tests */
	webServer: {
		command: "bun run dev",
		url: "http://localhost:5173",
		reuseExistingServer: !process.env.CI,
		cwd: "../..",
		timeout: 120_000,
		stdout: "pipe",
		stderr: "pipe",
		// Wait for Vite to report ready (Vite 6 uses "VITE v" message)
		wait: {
			stdout: /VITE v[\d.]+\s+ready/i,
		},
	},
});
