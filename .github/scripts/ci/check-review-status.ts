#!/usr/bin/env bun
import { $ } from "bun";

const prNumber = process.argv[2];
if (!prNumber) {
	console.error("Usage: check-review-status.ts <pr-number>");
	process.exit(1);
}

const repo = process.env.GITHUB_REPOSITORY;
if (!repo) {
	console.error("GITHUB_REPOSITORY required");
	process.exit(1);
}

try {
	const reviews = await $`gh api repos/${repo}/pulls/${prNumber}/reviews`.json();
	const botReviews = reviews.filter(
		(r: { user: { login: string } }) => r.user.login === "opencode-agent[bot]"
	);
	const total = botReviews.length;
	const pending = botReviews.filter(
		(r: { state: string }) => r.state === "CHANGES_REQUESTED"
	).length;
	const shouldReview = total === 0 || pending > 0;

	console.log(`should_review=${shouldReview}`);

	if (process.env.GITHUB_OUTPUT) {
		const output = `should_review=${shouldReview}\n`;
		await Bun.write(process.env.GITHUB_OUTPUT, output);
	}
} catch (e) {
	console.error("Failed to check review status, defaulting to should_review=true:", e);
	console.log("should_review=true");
	if (process.env.GITHUB_OUTPUT) {
		await Bun.write(process.env.GITHUB_OUTPUT, "should_review=true\n");
	}
}
