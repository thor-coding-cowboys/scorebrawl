#!/usr/bin/env bun

export {};

const prNumber = process.env.PR_NUMBER;
const dbId = process.env.DB_ID;
const dbName = process.env.DB_NAME;
const bucketName = process.env.BUCKET_NAME;
const queueName = process.env.QUEUE_NAME;

if (!prNumber || !dbId || !dbName || !bucketName || !queueName) {
	console.error(
		"PR_NUMBER, DB_ID, DB_NAME, BUCKET_NAME, and QUEUE_NAME environment variables are required"
	);
	process.exit(1);
}

const workerName = `scorebrawl-pr-${prNumber}`;

// Read wrangler.jsonc from worker directory
const configPath = "apps/worker/wrangler.jsonc";
const configContent = await Bun.file(configPath).text();

// Parse JSONC (remove comments)
const jsonContent = configContent.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
const config = JSON.parse(jsonContent);

// Update config for preview deployment from root
config.name = workerName;
config.main = "./apps/worker/src/index.ts";
config.assets.directory = "./apps/web/dist/client";
config.d1_databases[0].database_id = dbId;
config.d1_databases[0].database_name = dbName;
config.d1_databases[0].migrations_dir = "./apps/worker/migrations";
config.r2_buckets[0].bucket_name = bucketName;

// Update queue names to PR-specific
for (const producer of config.queues.producers) {
	producer.queue = queueName;
}
for (const consumer of config.queues.consumers) {
	consumer.queue = queueName;
}

// Remove custom domain routes for preview
config.routes = undefined;

// Set preview-specific vars (avoid production values)
config.vars = {
	ADMIN_USER_IDS: "seed-user-id",
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
