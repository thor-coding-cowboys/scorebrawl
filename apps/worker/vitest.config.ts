import fs from "node:fs";
import path from "node:path";
import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";
import { unstable_splitSqlQuery } from "wrangler";

const migrationsPath = path.join(__dirname, "./migrations");

function readNestedD1Migrations(dir: string) {
	const names = fs
		.readdirSync(dir, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.sort((a, b) => Number(a.split("_")[0]) - Number(b.split("_")[0]));
	return names
		.filter((name) => fs.existsSync(path.join(dir, name, "migration.sql")))
		.map((name) => ({
			name: `${name}/migration.sql`,
			queries: unstable_splitSqlQuery(
				fs.readFileSync(path.join(dir, name, "migration.sql"), "utf8")
			).filter((query) =>
				query.split("\n").some((line) => line.trim() && !line.trim().startsWith("--"))
			),
		}))
		.filter((migration) => migration.queries.length > 0);
}

const migrations = readNestedD1Migrations(migrationsPath);

// Read and modify wrangler config for tests
const wranglerPath = path.join(__dirname, "wrangler.jsonc");
const wranglerContent = fs.readFileSync(wranglerPath, "utf-8");
const wranglerConfig = JSON.parse(
	// Remove comments from JSONC
	wranglerContent.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "")
);

// Remove assets to avoid requiring frontend build
wranglerConfig.assets = undefined;

// Remove queue consumers to avoid isolated storage conflicts in tests.
// The queue producer binding is still available via the wrangler config,
// but the consumer (which uses internal SQLite) interferes with D1 isolated storage.
if (wranglerConfig.queues) {
	wranglerConfig.queues.consumers = undefined;
}

// Write temporary test config
const testConfigPath = path.join(__dirname, ".wrangler.test.json");
fs.writeFileSync(testConfigPath, JSON.stringify(wranglerConfig, null, 2));

export default defineWorkersConfig({
	test: {
		setupFiles: ["./test/setup/apply-migrations.ts"],
		poolOptions: {
			workers: {
				singleWorker: true,
				wrangler: { configPath: testConfigPath },
				miniflare: {
					bindings: {
						TEST_MIGRATIONS: migrations,
						// Override BETTER_AUTH_URL from .env (https) so better-auth uses
						// plain (non __Secure-) cookies matching the test auth helpers.
						BETTER_AUTH_URL: "http://localhost",
					},
					logLevel: "warn",
				},
			},
		},
	},
	resolve: {
		alias: {
			// Fix for tslib module resolution issue in Cloudflare Workers test environment.
			// @better-auth/passkey introduces tsyringe (via @peculiar/x509) which imports tslib
			// using named imports. In the Workers environment, tslib doesn't resolve correctly
			// to the ES module version, causing "does not provide an export named 'default'" errors.
			// This alias ensures tslib resolves to the ES module file (tslib.es6.mjs).
			tslib: path.resolve(__dirname, "../../node_modules/tslib/tslib.es6.mjs"),
		},
	},
});
