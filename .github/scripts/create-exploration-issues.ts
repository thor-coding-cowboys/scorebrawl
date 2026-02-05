#!/usr/bin/env bun
import { createHash } from "node:crypto";
import { basename, dirname, join } from "node:path";
import { $ } from "bun";

const DEDUP_CONFIG = {
	cooldownDays: 14, // Skip if closed within this period
	searchLabels: ["explorer"], // Only search explorer issues
};

interface VideoAction {
	type: "navigate" | "click" | "type" | "wait" | "theme" | "scroll";
	target?: string;
	value?: string;
	description?: string;
}

interface VideoScript {
	title: string;
	actions: VideoAction[];
}

interface Finding {
	title: string;
	description: string;
	category:
		| "bug"
		| "ux"
		| "accessibility"
		| "visual"
		| "performance"
		| "product";
	severity: "low" | "medium" | "high";
	page: string;
	video_script?: VideoScript;
}

interface ExplorationOutput {
	findings: Finding[];
}

interface ExistingIssue {
	number: number;
	title: string;
	state: "open" | "closed";
	closed_at: string | null;
	html_url: string;
}

const BASE_URL = "http://localhost:3000";
const MEDIA_DIR = "/tmp/exploration-media";

const CATEGORY_LABELS: Record<string, string> = {
	bug: "bug",
	ux: "ux",
	accessibility: "accessibility",
	visual: "visual",
	performance: "performance",
	product: "product",
};

const SEVERITY_LABELS: Record<string, string> = {
	low: "priority: low",
	medium: "priority: medium",
	high: "priority: high",
};

// Allowlist of valid page paths
const VALID_PAGES = ["/", "/sessions", "/chat"];

async function searchSimilarIssues(title: string): Promise<ExistingIssue[]> {
	const repo = process.env.GITHUB_REPOSITORY;
	const token = process.env.GH_TOKEN;
	if (!repo || !token) return [];

	// Extract key words from title for search
	const keywords = title
		.toLowerCase()
		.replace(/[^\w\s]/g, "")
		.split(/\s+/)
		.filter((w) => w.length > 3)
		.slice(0, 3)
		.join(" ");

	const query = `repo:${repo} is:issue label:explorer ${keywords}`;

	try {
		const response = await fetch(
			`https://api.github.com/search/issues?q=${encodeURIComponent(query)}&per_page=10`,
			{
				headers: {
					Authorization: `Bearer ${token}`,
					Accept: "application/vnd.github+json",
				},
			},
		);

		if (!response.ok) return [];

		const result = await response.json();
		return result.items || [];
	} catch {
		return [];
	}
}

function calculateSimilarity(a: string, b: string): number {
	const wordsA = new Set(a.split(/\s+/).filter((w) => w.length > 0));
	const wordsB = new Set(b.split(/\s+/).filter((w) => w.length > 0));
	if (wordsA.size === 0 && wordsB.size === 0) return 1; // Both empty = identical
	const intersection = [...wordsA].filter((w) => wordsB.has(w)).length;
	const union = new Set([...wordsA, ...wordsB]).size;
	return intersection / union; // Jaccard similarity
}

function isDuplicate(
	finding: Finding,
	existingIssues: ExistingIssue[],
): { isDuplicate: boolean; reason?: string; issue?: ExistingIssue } {
	const normalizedTitle = finding.title.toLowerCase().trim();

	for (const issue of existingIssues) {
		const existingTitle = issue.title.toLowerCase().trim();

		// Check title similarity (contains key phrases)
		const titleMatch =
			existingTitle.includes(normalizedTitle) ||
			normalizedTitle.includes(existingTitle) ||
			calculateSimilarity(normalizedTitle, existingTitle) > 0.7;

		if (!titleMatch) continue;

		if (issue.state === "open") {
			return { isDuplicate: true, reason: "Open issue exists", issue };
		}

		if (issue.state === "closed" && issue.closed_at) {
			const closedDate = new Date(issue.closed_at);
			const daysSinceClosed =
				(Date.now() - closedDate.getTime()) / (1000 * 60 * 60 * 24);

			if (daysSinceClosed < DEDUP_CONFIG.cooldownDays) {
				return {
					isDuplicate: true,
					reason: `Closed ${Math.round(daysSinceClosed)} days ago (cooldown: ${DEDUP_CONFIG.cooldownDays} days)`,
					issue,
				};
			}
		}
	}

	return { isDuplicate: false };
}

// Validate page path against allowlist
function validatePage(page: string): string {
	const normalized = page.startsWith("/") ? page : `/${page}`;
	if (VALID_PAGES.includes(normalized)) {
		return normalized;
	}
	// Default to root if invalid
	console.warn(`Invalid page path: ${page}, defaulting to /`);
	return "/";
}

async function uploadToCloudinary(
	filePath: string,
	cloudName: string,
	apiKey: string,
	apiSecret: string,
	folder: string,
	resourceType: "image" | "video" = "image",
): Promise<string | null> {
	const file = Bun.file(filePath);
	if (!(await file.exists())) {
		return null;
	}

	const fileName = basename(filePath).replace(/\.(png|webm)$/, "");
	const timestamp = Math.floor(Date.now() / 1000);

	const params = `folder=${folder}&public_id=${fileName}&timestamp=${timestamp}`;
	const signature = createHash("sha1")
		.update(params + apiSecret)
		.digest("hex");

	const formData = new FormData();
	formData.append("file", file);
	formData.append("api_key", apiKey);
	formData.append("timestamp", timestamp.toString());
	formData.append("signature", signature);
	formData.append("folder", folder);
	formData.append("public_id", fileName);

	try {
		const response = await fetch(
			`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
			{ method: "POST", body: formData },
		);

		if (!response.ok) {
			console.error(`Upload failed: ${response.status}`);
			return null;
		}

		const result = await response.json();
		return result.secure_url;
	} catch (error) {
		console.error(`Error uploading:`, error);
		return null;
	}
}

async function captureScreenshot(
	page: string,
	outputPath: string,
): Promise<boolean> {
	const validPage = validatePage(page);
	const url = `${BASE_URL}${validPage}`;

	try {
		await $`agent-browser open ${url}`.quiet();
		await Bun.sleep(1000);
		await $`agent-browser screenshot ${outputPath}`.quiet();
		await $`agent-browser close`.quiet();
		return true;
	} catch (error) {
		console.error(`Failed to capture screenshot: ${error}`);
		await $`agent-browser close`.quiet().nothrow();
		return false;
	}
}

async function recordVideo(
	script: VideoScript,
	outputPath: string,
): Promise<boolean> {
	let browserOpened = false;
	const screenshotPath = outputPath.endsWith(".webm")
		? join(dirname(outputPath), `${basename(outputPath, ".webm")}.png`)
		: outputPath;

	try {
		for (const action of script.actions) {
			switch (action.type) {
				case "navigate": {
					const validPage = validatePage(action.target || "/");
					await $`agent-browser open ${BASE_URL}${validPage}`.quiet();
					browserOpened = true;
					await Bun.sleep(500);
					break;
				}
				case "click":
					console.log(`  Skipping click action for security`);
					await Bun.sleep(300);
					break;
				case "type":
					console.log(`  Skipping type action for security`);
					await Bun.sleep(200);
					break;
				case "wait": {
					const waitMs = Math.min(
						Math.max(parseInt(action.value || "1000", 10) || 1000, 100),
						5000,
					);
					await Bun.sleep(waitMs);
					break;
				}
				case "theme":
					if (action.value === "light") {
						await $`agent-browser eval "localStorage.setItem('theme', 'light'); location.reload()"`.quiet();
					} else {
						await $`agent-browser eval "localStorage.setItem('theme', 'dark'); location.reload()"`.quiet();
					}
					await Bun.sleep(500);
					break;
				case "scroll":
					await $`agent-browser eval "window.scrollBy(0, 300)"`.quiet();
					await Bun.sleep(300);
					break;
			}
		}

		await $`agent-browser screenshot ${screenshotPath}`.quiet();
		await $`agent-browser close`.quiet();
		return true;
	} catch (error) {
		console.error(`Failed to record video: ${error}`);
		if (browserOpened) {
			await $`agent-browser close`.quiet().nothrow();
		}
		return false;
	}
}

async function createIssueViaApi(
	title: string,
	body: string,
	labels: string[],
): Promise<string | null> {
	const repo = process.env.GITHUB_REPOSITORY;
	const token = process.env.GH_TOKEN;
	if (!repo || !token) return null;

	try {
		const response = await fetch(
			`https://api.github.com/repos/${repo}/issues`,
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${token}`,
					Accept: "application/vnd.github+json",
					"Content-Type": "application/json",
					"X-GitHub-Api-Version": "2022-11-28",
				},
				body: JSON.stringify({ title, body, labels }),
			},
		);

		if (!response.ok) {
			const error = await response.text();
			console.error(`GitHub API error: ${response.status} - ${error}`);
			return null;
		}

		const result = await response.json();
		return result.html_url;
	} catch (error) {
		console.error(`Failed to create issue: ${error}`);
		return null;
	}
}

async function createIssue(
	finding: Finding,
	index: number,
	cloudName: string,
	apiKey: string,
	apiSecret: string,
): Promise<"created" | "skipped" | "failed"> {
	const folder = `explorer/${new Date().toISOString().split("T")[0]}`;
	const screenshotPath = `${MEDIA_DIR}/finding-${index}-screenshot.png`;

	console.log(`\nProcessing finding ${index + 1}: ${finding.title}`);

	// Check for duplicates
	console.log(`  Checking for existing issues...`);
	const existingIssues = await searchSimilarIssues(finding.title);
	const dupCheck = isDuplicate(finding, existingIssues);

	if (dupCheck.isDuplicate) {
		console.log(`  ⏭ Skipped: ${dupCheck.reason}`);
		console.log(`    Existing: ${dupCheck.issue?.html_url}`);
		return "skipped";
	}

	// Capture screenshot
	console.log(`  Capturing screenshot of ${finding.page}...`);
	const screenshotSuccess = await captureScreenshot(
		finding.page,
		screenshotPath,
	);

	// Upload screenshot
	let screenshotUrl: string | null = null;
	if (screenshotSuccess) {
		console.log(`  Uploading screenshot...`);
		screenshotUrl = await uploadToCloudinary(
			screenshotPath,
			cloudName,
			apiKey,
			apiSecret,
			folder,
			"image",
		);
		if (screenshotUrl) {
			console.log(`    ✓ Uploaded screenshot`);
		}
	} else {
		console.log(`  ⚠ Screenshot capture failed, continuing without it`);
	}

	// Record video actions if script provided
	let videoScreenshotUrl: string | null = null;
	if (finding.video_script) {
		const videoScreenshotPath = `${MEDIA_DIR}/finding-${index}-video.png`;
		console.log(`  Recording video script actions...`);
		const videoSuccess = await recordVideo(
			finding.video_script,
			videoScreenshotPath,
		);

		if (videoSuccess) {
			console.log(`  Uploading video end state...`);
			videoScreenshotUrl = await uploadToCloudinary(
				videoScreenshotPath,
				cloudName,
				apiKey,
				apiSecret,
				folder,
				"image",
			);
			if (videoScreenshotUrl) {
				console.log(`    ✓ Uploaded video screenshot`);
			}
		} else {
			console.log(`  ⚠ Video recording failed, continuing without it`);
		}
	}

	// Build issue body
	const mediaSection = [];

	if (videoScreenshotUrl) {
		mediaSection.push(
			`## Demo Screenshot\n\n![Demo](${videoScreenshotUrl})\n\n_Screenshot showing the end state after reproducing the issue_`,
		);
	}

	if (screenshotUrl) {
		mediaSection.push(`## Page Screenshot\n\n![Screenshot](${screenshotUrl})`);
	}

	const body = `## Description

${finding.description}

**Page:** \`${finding.page}\`
**Category:** ${finding.category}
**Severity:** ${finding.severity}

${mediaSection.join("\n\n")}

---
_Found by Web Explorer 🔍_`;

	// Create issue via API (safe from injection)
	const labels = [
		"explorer",
		CATEGORY_LABELS[finding.category],
		SEVERITY_LABELS[finding.severity],
	].filter(Boolean);

	console.log(`  Creating issue...`);
	const issueUrl = await createIssueViaApi(finding.title, body, labels);
	if (issueUrl) {
		console.log(`  ✓ ${issueUrl}`);
		return "created";
	} else {
		console.log(`  ✗ Failed to create issue`);
		return "failed";
	}
}

async function main() {
	const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
	const apiKey = process.env.CLOUDINARY_API_KEY;
	const apiSecret = process.env.CLOUDINARY_API_SECRET;
	const outputJson = process.env.STRUCTURED_OUTPUT;

	if (!cloudName || !apiKey || !apiSecret) {
		console.error("Cloudinary credentials required");
		process.exit(1);
	}

	if (!outputJson) {
		console.log("No structured output, skipping issue creation");
		process.exit(0);
	}

	let output: ExplorationOutput;
	try {
		// Use extractJson for robust parsing of potentially mixed LLM output
		const { extractJson } = await import("./utils/extract-json");
		output = extractJson<ExplorationOutput>(outputJson);
	} catch (e) {
		console.error("Failed to parse structured output:", e);
		process.exit(1);
	}

	if (!output.findings || output.findings.length === 0) {
		console.log("No findings to report");
		process.exit(0);
	}

	// Create media directory
	const { mkdir } = await import("node:fs/promises");
	await mkdir(MEDIA_DIR, { recursive: true });

	console.log(`Found ${output.findings.length} findings to report`);

	let successCount = 0;
	let skippedCount = 0;
	let failureCount = 0;

	for (let i = 0; i < output.findings.length; i++) {
		const result = await createIssue(
			output.findings[i],
			i,
			cloudName,
			apiKey,
			apiSecret,
		);
		if (result === "created") {
			successCount++;
		} else if (result === "skipped") {
			skippedCount++;
		} else {
			failureCount++;
		}
	}

	console.log(
		`\nDone! Created ${successCount}, skipped ${skippedCount} duplicates, ${failureCount} failed.`,
	);

	// Exit with success even if some issues failed - we don't want to fail the workflow
	// The summary above shows what happened
}

main().catch((error) => {
	console.error("Failed:", error);
	process.exit(1);
});
