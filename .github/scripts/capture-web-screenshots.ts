#!/usr/bin/env bun
import { mkdir } from "node:fs/promises";
import { $ } from "bun";

const BASE_URL = "http://localhost:3000";
const OUTPUT_DIR = "/tmp/web-screenshots";

const PAGES = [
	{ name: "overview", path: "/" },
	{ name: "sessions", path: "/sessions" },
	{ name: "chat", path: "/chat" },
];

const THEMES = ["light", "dark"] as const;

async function captureScreenshot(
	name: string,
	path: string,
	theme: (typeof THEMES)[number],
): Promise<void> {
	const url = `${BASE_URL}${path}`;
	const screenshotPath = `${OUTPUT_DIR}/${name}-${theme}.png`;
	const snapshotPath = `${OUTPUT_DIR}/${name}-${theme}-a11y.txt`;

	console.log(`Capturing ${name} (${theme})...`);

	// Open the page
	await $`agent-browser open ${url}`.quiet();

	// Set theme via localStorage
	const themeValue = theme === "dark" ? "dark" : "light";
	await $`agent-browser eval "localStorage.setItem('theme', '${themeValue}'); location.reload()"`.quiet();

	// Wait for page to reload and settle
	await Bun.sleep(1500);

	// Take screenshot
	await $`agent-browser screenshot ${screenshotPath}`.quiet();
	console.log(`  Screenshot: ${screenshotPath}`);

	// Take accessibility snapshot
	const snapshot = await $`agent-browser snapshot`.text();
	await Bun.write(snapshotPath, snapshot);
	console.log(`  A11y snapshot: ${snapshotPath}`);
}

async function main(): Promise<void> {
	// Create output directory
	await mkdir(OUTPUT_DIR, { recursive: true });

	const manifest: {
		capturedAt: string;
		baseUrl: string;
		pages: Array<{
			name: string;
			path: string;
			screenshots: Record<string, string>;
			snapshots: Record<string, string>;
		}>;
	} = {
		capturedAt: new Date().toISOString(),
		baseUrl: BASE_URL,
		pages: [],
	};

	for (const page of PAGES) {
		const pageManifest = {
			name: page.name,
			path: page.path,
			screenshots: {} as Record<string, string>,
			snapshots: {} as Record<string, string>,
		};

		for (const theme of THEMES) {
			await captureScreenshot(page.name, page.path, theme);
			pageManifest.screenshots[theme] = `${page.name}-${theme}.png`;
			pageManifest.snapshots[theme] = `${page.name}-${theme}-a11y.txt`;
		}

		manifest.pages.push(pageManifest);
	}

	// Close browser
	await $`agent-browser close`.quiet();

	// Write manifest
	const manifestPath = `${OUTPUT_DIR}/manifest.json`;
	await Bun.write(manifestPath, JSON.stringify(manifest, null, 2));
	console.log(`\nManifest: ${manifestPath}`);
	console.log("Done!");
}

main().catch((error) => {
	console.error("Screenshot capture failed:", error);
	process.exit(1);
});
