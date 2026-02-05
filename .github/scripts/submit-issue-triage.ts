#!/usr/bin/env bun
import { $ } from "bun";
import { extractJsonFromFile } from "./utils/extract-json";

interface TriagedOutput {
	status: "triaged";
	scope?: "small" | "medium" | "large";
	labels?: string[];
	comment: string;
}

interface PoorFitOutput {
	status: "poor-fit";
	recommendation?: "close" | "revise";
	reason?: string;
	comment: string;
}

type TriageOutput = TriagedOutput | PoorFitOutput;

async function main() {
	const [issueNumber, jsonFile] = Bun.argv.slice(2);
	if (!issueNumber || !jsonFile) {
		console.error("Usage: submit-issue-triage.ts <issue-number> <json-file>");
		process.exit(1);
	}

	let output: TriageOutput;
	try {
		output = await extractJsonFromFile<TriageOutput>(jsonFile);
	} catch (e) {
		console.error("Failed to parse structured output:", e);
		process.exit(1);
	}

	await $`gh issue comment ${issueNumber} --body ${output.comment}`;

	if (output.status === "triaged") {
		const labels = ["triaged"];
		if (output.scope) labels.push(`scope:${output.scope}`);
		if (output.labels?.length) labels.push(...output.labels);
		const needsHumanInput = output.comment.toLowerCase().includes("open questions");
		if (needsHumanInput) {
			labels.push("needs-human-input");
		}
		await $`gh issue edit ${issueNumber} --add-label ${labels.join(",")}`;

		// Auto-approve for implementation if no human input needed
		if (!needsHumanInput) {
			console.log(`Auto-approving issue #${issueNumber} for implementation`);
			await $`gh issue edit ${issueNumber} --add-label approved`;
		}
	} else {
		await $`gh issue edit ${issueNumber} --add-label poor-fit`;
		if (output.recommendation === "close") {
			await $`gh issue close ${issueNumber} --reason "not planned"`;
		}
	}
}

main();
