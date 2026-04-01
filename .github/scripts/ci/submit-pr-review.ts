#!/usr/bin/env bun
import { $ } from "bun";

type ReviewComment = {
	path: string;
	line: number;
	body: string;
};

type ReviewOutput = {
	verdict: "approve" | "request-changes";
	summary?: string;
	comments?: ReviewComment[];
};

async function dismissStaleReviews(prNumber: string) {
	const repo = process.env.GITHUB_REPOSITORY;
	if (!repo) return;

	try {
		const result =
			await $`gh api repos/${repo}/pulls/${prNumber}/reviews --jq '.[] | select(.user.login == "opencode-agent[bot]" and .state == "CHANGES_REQUESTED") | .id'`.text();

		const reviewIds = result.trim().split("\n").filter(Boolean);
		for (const reviewId of reviewIds) {
			await $`gh api repos/${repo}/pulls/${prNumber}/reviews/${reviewId}/dismissals -X PUT -f message=Re-reviewed -f event=DISMISS`;
		}
	} catch {
		// Don't fail if dismissal fails
	}
}

async function getLatestCommitSha(prNumber: string) {
	const repo = process.env.GITHUB_REPOSITORY;
	if (!repo) throw new Error("GITHUB_REPOSITORY required");
	return (await $`gh api repos/${repo}/pulls/${prNumber} --jq '.head.sha'`.text()).trim();
}

async function getPrChangedFiles(prNumber: string): Promise<Map<string, string>> {
	const repo = process.env.GITHUB_REPOSITORY;
	if (!repo) throw new Error("GITHUB_REPOSITORY required");

	// Get list of files changed in the PR - returns newline-separated JSON objects
	const output =
		await $`gh api repos/${repo}/pulls/${prNumber}/files --jq '.[] | {filename: .filename, status: .status}'`.text();
	const fileMap = new Map<string, string>();

	// Parse each line as a separate JSON object
	for (const line of output.trim().split("\n")) {
		if (!line) continue;
		try {
			const file = JSON.parse(line);
			fileMap.set(file.filename, file.status);
		} catch {
			// Skip invalid lines
		}
	}

	return fileMap;
}

async function submitReviewWithComments(
	prNumber: string,
	body: string,
	comments: ReviewComment[],
	changedFiles: Map<string, string>
) {
	const repo = process.env.GITHUB_REPOSITORY;
	const commitId = await getLatestCommitSha(prNumber);

	// Separate comments into valid inline comments and comments on deleted files
	const inlineComments: ReviewComment[] = [];
	const deletedFileComments: string[] = [];

	for (const comment of comments) {
		const status = changedFiles.get(comment.path);
		if (status === "removed") {
			// File was deleted, can't comment on specific lines
			deletedFileComments.push(`**${comment.path}:** ${comment.body}`);
		} else {
			// File exists in new version, can add inline comment
			inlineComments.push(comment);
		}
	}

	// Build review body with deleted file comments appended
	let reviewBody = body;
	if (deletedFileComments.length > 0) {
		reviewBody = `${body}\n\n**Comments on deleted files:**\n${deletedFileComments.join("\n")}`;
	}

	// If no valid inline comments, just submit review body
	if (inlineComments.length === 0) {
		await $`gh pr review ${prNumber} --request-changes -b ${reviewBody}`;
		return;
	}

	const payload = JSON.stringify({
		commit_id: commitId,
		body: reviewBody,
		event: "REQUEST_CHANGES",
		comments: inlineComments.map((c) => ({
			path: c.path,
			line: c.line,
			body: c.body,
		})),
	});

	try {
		await $`echo ${payload} | gh api repos/${repo}/pulls/${prNumber}/reviews -X POST --input -`;
	} catch {
		await $`gh pr review ${prNumber} --request-changes -b ${reviewBody}`;
	}
}

async function main() {
	const jsonFile = Bun.argv[2];
	if (!jsonFile) {
		console.error("Usage: submit-pr-review.ts <json-file>");
		process.exit(1);
	}

	const prNumber = process.env.PR_NUMBER;
	if (!prNumber) {
		console.error("PR_NUMBER required");
		process.exit(1);
	}

	let output: ReviewOutput;
	try {
		output = await Bun.file(jsonFile).json();
	} catch (e) {
		console.error("Failed to parse structured output:", e);
		process.exit(1);
	}

	await dismissStaleReviews(prNumber);

	if (output.verdict === "approve") {
		await $`gh pr review ${prNumber} --approve`;
	} else {
		const body = `${output.summary ?? "See review comments"}\n\n---\n_To re-request review after addressing feedback, push a new commit._`;
		const comments = output.comments ?? [];

		if (comments.length > 0) {
			const changedFiles = await getPrChangedFiles(prNumber);
			await submitReviewWithComments(prNumber, body, comments, changedFiles);
		} else {
			await $`gh pr review ${prNumber} --request-changes -b ${body}`;
		}
	}
}

main();
