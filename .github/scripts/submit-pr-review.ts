#!/usr/bin/env bun
import { $ } from "bun";
import { extractJsonFromFile } from "./utils/extract-json";

interface ReviewComment {
	path: string;
	line: number;
	body: string;
}

interface ReviewOutput {
	verdict: "approve" | "request-changes";
	summary?: string;
	comments?: ReviewComment[];
}

async function dismissStaleReviews(prNumber: string): Promise<void> {
	const repo = process.env.GITHUB_REPOSITORY;
	if (!repo) return;

	try {
		const botLogin = process.env.REVIEW_BOT_LOGIN || "opencode-review[bot]";
		const result =
			await $`gh api repos/${repo}/pulls/${prNumber}/reviews --jq ${`.[] | select(.user.login == "${botLogin}" and .state == "CHANGES_REQUESTED") | .id`}`.text();

		const reviewIds = result.trim().split("\n").filter(Boolean);
		for (const reviewId of reviewIds) {
			await $`gh api repos/${repo}/pulls/${prNumber}/reviews/${reviewId}/dismissals -X PUT -f message=Re-reviewed -f event=DISMISS`;
		}
	} catch {
		// Don't fail if dismissal fails
	}
}

async function getLatestCommitSha(prNumber: string): Promise<string> {
	const repo = process.env.GITHUB_REPOSITORY;
	if (!repo) throw new Error("GITHUB_REPOSITORY required");
	return (
		await $`gh api repos/${repo}/pulls/${prNumber} --jq '.head.sha'`.text()
	).trim();
}

async function submitReviewWithComments(
	prNumber: string,
	body: string,
	comments: ReviewComment[],
): Promise<void> {
	const repo = process.env.GITHUB_REPOSITORY;
	const commitId = await getLatestCommitSha(prNumber);

	const payload = JSON.stringify({
		commit_id: commitId,
		body,
		event: "REQUEST_CHANGES",
		comments: comments.map((c) => ({
			path: c.path,
			line: c.line,
			body: c.body,
		})),
	});

	try {
		await $`echo ${payload} | gh api repos/${repo}/pulls/${prNumber}/reviews -X POST --input -`;
	} catch {
		await $`gh pr review ${prNumber} --request-changes -b ${body}`;
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
		output = await extractJsonFromFile<ReviewOutput>(jsonFile);
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
			await submitReviewWithComments(prNumber, body, comments);
		} else {
			await $`gh pr review ${prNumber} --request-changes -b ${body}`;
		}
	}
}

main();
