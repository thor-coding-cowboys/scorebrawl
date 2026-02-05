#!/usr/bin/env bun
import { chromium } from "playwright";

const BASE_URL = "http://localhost:3000";
const OUTPUT_PATH = "/tmp/web-screenshots/demo.webm";
const SCRIPT_PATH = "/tmp/web-screenshots/video-script.json";

interface VideoAction {
	type: "navigate" | "click" | "type" | "wait" | "theme" | "scroll";
	target?: string; // URL path for navigate, selector for click/type
	value?: string; // Text for type, theme name for theme, ms for wait
	description?: string; // What this action demonstrates
}

interface VideoScript {
	title: string;
	actions: VideoAction[];
}

async function main() {
	// Read video script
	const scriptFile = Bun.file(SCRIPT_PATH);
	if (!(await scriptFile.exists())) {
		console.log("No video script found, skipping video recording");
		process.exit(0);
	}

	const script: VideoScript = await scriptFile.json();
	console.log(`Recording video: ${script.title}`);
	console.log(`Actions: ${script.actions.length}`);

	// Launch browser with video recording
	const browser = await chromium.launch();
	const context = await browser.newContext({
		viewport: { width: 1280, height: 720 },
		recordVideo: {
			dir: "/tmp/web-screenshots/",
			size: { width: 1280, height: 720 },
		},
	});

	const page = await context.newPage();

	// Execute each action
	for (const action of script.actions) {
		console.log(
			`  ${action.type}: ${action.description || action.target || action.value}`,
		);

		switch (action.type) {
			case "navigate":
				await page.goto(`${BASE_URL}${action.target}`);
				await page.waitForLoadState("networkidle");
				await page.waitForTimeout(500); // Let animations settle
				break;

			case "click":
				if (action.target) {
					await page.click(action.target);
					await page.waitForTimeout(300);
				}
				break;

			case "type":
				if (action.target && action.value) {
					await page.fill(action.target, action.value);
					await page.waitForTimeout(200);
				}
				break;

			case "wait":
				await page.waitForTimeout(parseInt(action.value || "1000", 10));
				break;

			case "theme": {
				const theme = action.value || "dark";
				await page.evaluate((t) => {
					localStorage.setItem("theme", t);
					window.dispatchEvent(new Event("storage"));
				}, theme);
				await page.waitForTimeout(500);
				break;
			}

			case "scroll":
				if (action.target) {
					await page.locator(action.target).scrollIntoViewIfNeeded();
				} else {
					await page.evaluate(() => window.scrollBy(0, 300));
				}
				await page.waitForTimeout(300);
				break;
		}
	}

	// Final pause to show end state
	await page.waitForTimeout(1000);

	// Close and save video
	await context.close();
	await browser.close();

	// Playwright saves with a random name, rename to expected path
	const { readdir, rename } = await import("node:fs/promises");
	const files = await readdir("/tmp/web-screenshots/");
	const videoFile = files.find((f) => f.endsWith(".webm") && f !== "demo.webm");
	if (videoFile) {
		await rename(`/tmp/web-screenshots/${videoFile}`, OUTPUT_PATH);
		console.log(`Video saved: ${OUTPUT_PATH}`);
	} else {
		console.error("No video file found");
		process.exit(1);
	}
}

main().catch((error) => {
	console.error("Video recording failed:", error);
	process.exit(1);
});
