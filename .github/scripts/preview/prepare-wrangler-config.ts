#!/usr/bin/env bun

export {};

const prNumber = process.env.PR_NUMBER;
const dbId = process.env.DB_ID;
const dbName = process.env.DB_NAME;
const bucketName = process.env.BUCKET_NAME;
const achievementQueueName = process.env.ACHIEVEMENT_QUEUE_NAME;
const seedQueueName = process.env.SEED_QUEUE_NAME;

if (!prNumber || !dbId || !dbName || !bucketName || !achievementQueueName || !seedQueueName) {
	console.error(
		"PR_NUMBER, DB_ID, DB_NAME, BUCKET_NAME, ACHIEVEMENT_QUEUE_NAME, and SEED_QUEUE_NAME environment variables are required"
	);
	process.exit(1);
}

const workerName = `scorebrawl-pr-${prNumber}`;

// Read wrangler.jsonc from worker directory
const configPath = "apps/worker/wrangler.jsonc";
const configContent = await Bun.file(configPath).text();

// Parse JSONC (remove comments, respecting string literals)
function stripJsoncComments(input: string): string {
	let result = "";
	let inString = false;
	let inLineComment = false;
	let inBlockComment = false;
	for (let i = 0; i < input.length; i++) {
		const ch = input[i];
		const next = input[i + 1];
		if (inLineComment) {
			if (ch === "\n") {
				inLineComment = false;
				result += ch;
			}
			continue;
		}
		if (inBlockComment) {
			if (ch === "*" && next === "/") {
				inBlockComment = false;
				i++;
			}
			continue;
		}
		if (inString) {
			result += ch;
			if (ch === "\\") {
				result += next ?? "";
				i++;
			} else if (ch === '"') {
				inString = false;
			}
			continue;
		}
		if (ch === '"') {
			inString = true;
			result += ch;
			continue;
		}
		if (ch === "/" && next === "/") {
			inLineComment = true;
			i++;
			continue;
		}
		if (ch === "/" && next === "*") {
			inBlockComment = true;
			i++;
			continue;
		}
		result += ch;
	}
	return result;
}

const jsonContent = stripJsoncComments(configContent);
const config = JSON.parse(jsonContent);

// Update config for preview deployment from root
config.name = workerName;
config.main = "./apps/worker/src/index.ts";
config.assets.directory = "./apps/web/dist/client";
config.d1_databases[0].database_id = dbId;
config.d1_databases[0].database_name = dbName;
config.d1_databases[0].migrations_dir = "./apps/worker/migrations";
config.d1_databases[0].migrations_pattern = "./apps/worker/migrations/*/migration.sql";
config.r2_buckets[0].bucket_name = bucketName;

// Update queue names to PR-specific
for (const producer of config.queues.producers) {
	if (producer.binding === "ACHIEVEMENT_QUEUE") {
		producer.queue = achievementQueueName;
	} else if (producer.binding === "SEED_QUEUE") {
		producer.queue = seedQueueName;
	}
}
for (const consumer of config.queues.consumers) {
	if (consumer.queue === "scorebrawl-achievement-calculations") {
		consumer.queue = achievementQueueName;
	} else if (consumer.queue === "scorebrawl-seed-queue") {
		consumer.queue = seedQueueName;
	}
}

// Remove custom domain routes for preview
config.routes = undefined;

// Set preview-specific vars (avoid production values)
config.vars = {
	ADMIN_USER_IDS: "seed-user-id",
	OAUTH_RESOURCE: "https://scorebrawl.com/api/v1",
};

// Write preview config
const previewConfigPath = "wrangler.preview.jsonc";
await Bun.write(previewConfigPath, JSON.stringify(config, null, "\t"));

// Output for GitHub Actions
const githubOutput = process.env.GITHUB_OUTPUT;
if (githubOutput) {
	const file = Bun.file(githubOutput);
	const existing = (await file.exists()) ? await file.text() : "";
	await Bun.write(githubOutput, `${existing}worker_name=${workerName}\n`);
}
