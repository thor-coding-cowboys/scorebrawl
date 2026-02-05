#!/usr/bin/env bun
import { createHash } from "node:crypto";
import { $ } from "bun";

const SCREENSHOT_DIR = "/tmp/web-screenshots";
const REVIEW_FILE = `${SCREENSHOT_DIR}/visual-review.md`;
const COMMENT_MARKER = "<!-- visual-review -->";

const PAGES = ["overview", "sessions", "chat"] as const;
const THEMES = ["light", "dark"] as const;

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

	const fileName = filePath
		.split("/")
		.pop()
		?.replace(/\.(png|webm)$/, "");
	if (!fileName) {
		return null;
	}
	const timestamp = Math.floor(Date.now() / 1000);

	// Generate signature
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
			{
				method: "POST",
				body: formData,
			},
		);

		if (!response.ok) {
			const error = await response.text();
			console.error(`Upload failed: ${response.status} - ${error}`);
			return null;
		}

		const result = await response.json();
		return result.secure_url;
	} catch (error) {
		console.error(`Error uploading ${fileName}:`, error);
		return null;
	}
}

async function findExistingComment(
	prNumber: string,
): Promise<string | null> {
	try {
		const result =
			await $`gh pr view ${prNumber} --json comments --jq '.comments[] | select(.body | contains("${COMMENT_MARKER}")) | .url'`
				.text();
		const urls = result.trim().split("\n").filter(Boolean);
		if (urls.length > 0) {
			// Extract comment ID from URL like https://github.com/owner/repo/pull/123#issuecomment-456
			const match = urls[0].match(/issuecomment-(\d+)/);
			return match ? match[1] : null;
		}
		return null;
	} catch {
		return null;
	}
}

async function readVisualReview(): Promise<string> {
	const file = Bun.file(REVIEW_FILE);
	if (await file.exists()) {
		return await file.text();
	}
	return "No visual review findings available.";
}

async function main() {
	const prNumber = process.env.PR_NUMBER;
	const repo = process.env.GITHUB_REPOSITORY;
	const runId = process.env.GITHUB_RUN_ID;
	const artifactId = process.env.ARTIFACT_ID;

	const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
	const apiKey = process.env.CLOUDINARY_API_KEY;
	const apiSecret = process.env.CLOUDINARY_API_SECRET;

	if (!prNumber || !repo) {
		console.error("PR_NUMBER and GITHUB_REPOSITORY required");
		process.exit(1);
	}

	if (!cloudName || !apiKey || !apiSecret) {
		console.error("Cloudinary credentials required");
		process.exit(1);
	}

	// Read the visual review written by Claude
	const visualReview = await readVisualReview();
	console.log("Read visual review from file");

	const folder = `visual-review/pr-${prNumber}`;
	console.log(`Uploading media to Cloudinary (${folder})...`);

	// Upload all screenshots
	const uploadedUrls: Record<string, string> = {};
	let allImagesUploaded = true;

	for (const page of PAGES) {
		for (const theme of THEMES) {
			const key = `${page}-${theme}`;
			const filePath = `${SCREENSHOT_DIR}/${key}.png`;

			console.log(`  Uploading ${key}.png...`);
			const url = await uploadToCloudinary(
				filePath,
				cloudName,
				apiKey,
				apiSecret,
				folder,
				"image",
			);

			if (url) {
				uploadedUrls[key] = url;
				console.log(`    ✓ ${url}`);
			} else {
				allImagesUploaded = false;
				console.log(`    ✗ Failed`);
			}
		}
	}

	// Upload video if it exists
	let videoUrl: string | null = null;
	const videoPath = `${SCREENSHOT_DIR}/demo.webm`;
	const videoFile = Bun.file(videoPath);

	if (await videoFile.exists()) {
		console.log(`  Uploading demo.webm...`);
		videoUrl = await uploadToCloudinary(
			videoPath,
			cloudName,
			apiKey,
			apiSecret,
			folder,
			"video",
		);
		if (videoUrl) {
			console.log(`    ✓ ${videoUrl}`);
		} else {
			console.log(`    ✗ Failed`);
		}
	}

	// Build comment body
	const artifactUrl = `https://github.com/${repo}/actions/runs/${runId}/artifacts/${artifactId}`;
	const workflowUrl = `https://github.com/${repo}/actions/runs/${runId}`;

	let mediaSection: string;

	if (allImagesUploaded) {
		// Video section (if available)
		// Convert video URL to GIF using Cloudinary transformation
		const videoSection = videoUrl
			? (() => {
					const gifUrl = videoUrl.replace(
						"/video/upload/",
						"/video/upload/f_gif,w_800/",
					);
					return `## 🎬 Demo Video

![Demo](${gifUrl})

[▶️ View full video](${videoUrl})

`;
				})()
			: "";

		const sections = PAGES.map((page) => {
			const pageName = page.charAt(0).toUpperCase() + page.slice(1);
			const light = uploadedUrls[`${page}-light`];
			const dark = uploadedUrls[`${page}-dark`];
			return `### ${pageName}

| Light | Dark |
|:-----:|:----:|
| <img src="${light}" width="400" alt="${pageName} light"> | <img src="${dark}" width="400" alt="${pageName} dark"> |`;
		});

		mediaSection = `${videoSection}## 📸 Screenshots

${sections.join("\n\n")}

<details>
<summary>Full resolution</summary>

**[Download Screenshots](${artifactUrl})**

</details>`;
	} else {
		// Fallback to artifact link only
		mediaSection = `## 📸 Screenshots

Screenshots captured for visual review:

| Page | Light | Dark |
|------|-------|------|
| Overview | ✅ | ✅ |
| Sessions | ✅ | ✅ |
| Chat | ✅ | ✅ |

**[Download Screenshots](${artifactUrl})** to view the captured UI states.`;
	}

	// Combine visual review with media into single comment
	const body = `${COMMENT_MARKER}
## Visual Review

${visualReview}

---

${mediaSection}

---
_Captured by [Web Visual Review](${workflowUrl}) workflow_`;

	// Check for existing comment to update
	const existingCommentId = await findExistingComment(prNumber);

	if (existingCommentId) {
		// Update existing comment
		await $`gh api repos/${repo}/issues/comments/${existingCommentId} -X PATCH -f body=${body}`;
		console.log(`Updated existing visual review comment (${existingCommentId})`);
	} else {
		// Create new comment
		await $`gh pr comment ${prNumber} --body ${body}`;
		console.log("Posted new visual review comment");
	}
}

main().catch((error) => {
	console.error("Failed to post comment:", error);
	process.exit(1);
});
