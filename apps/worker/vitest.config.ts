import fs from "node:fs";
import path from "node:path";
import { defineWorkersConfig, readD1Migrations } from "@cloudflare/vitest-pool-workers/config";

const migrationsPath = path.join(__dirname, "./migrations");
const migrations = await readD1Migrations(migrationsPath);

// Read and modify wrangler config for tests
const wranglerPath = path.join(__dirname, "wrangler.jsonc");
const wranglerContent = fs.readFileSync(wranglerPath, "utf-8");
const wranglerConfig = JSON.parse(
	// Remove comments from JSONC
	wranglerContent.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "")
);

// Remove assets to avoid requiring frontend build
delete wranglerConfig.assets;

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
					bindings: { TEST_MIGRATIONS: migrations },
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
