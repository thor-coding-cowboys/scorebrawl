#!/usr/bin/env bun
/**
 * `bun dev`: boots the app with the emulated GitHub/Google providers served by
 * the Worker itself (see apps/worker/src/emulate).
 *
 * Worker bindings come from wrangler dotenv, which outranks the parent shell, so
 * the emulator URLs and dummy secrets are written to the gitignored
 * `apps/worker/.env.local` before the app starts.
 * Run `EMULATE=0 bun dev` to talk to the real providers instead.
 */

import path from "node:path";
import { emulateEnvFile, realProviderEnvFile } from "./lib/emulate-env";

const root = path.join(import.meta.dir, "..");
const workerEnvFile = path.join(root, "apps", "worker", ".env.local");

const emulateEnabled = !["0", "false", "off"].includes((process.env.EMULATE ?? "").toLowerCase());

// Playwright passes BETTER_AUTH_URL through webServer.env; plain `bun dev` uses
// the portless default. Portless strips `:1355` from the Host header, so OAuth
// callbacks need the scheme/port pinned.
const origin = process.env.BETTER_AUTH_URL ?? "https://scorebrawl.localhost:1355";
const disableRateLimit = process.env.DISABLE_RATE_LIMIT ?? "false";

const childEnv: Record<string, string | undefined> = { ...process.env };

if (emulateEnabled) {
	// The web app only renders the social buttons when these are set; vite reads
	// them from the process environment, which turbo passes through.
	childEnv.VITE_GITHUB_CLIENT_ID ??= "Ov23liEHPLUdBgTj5Cxu";
	childEnv.VITE_GOOGLE_CLIENT_ID ??=
		"972190779505-ob8vi6970ib3c8i46plgmu4i9cpr7ohg.apps.googleusercontent.com";
}

await Bun.write(
	workerEnvFile,
	emulateEnabled
		? emulateEnvFile({ origin, disableRateLimit })
		: realProviderEnvFile({ origin, disableRateLimit })
);
console.log(
	emulateEnabled
		? `emulate: wrote apps/worker/.env.local (providers at ${origin}/emulate/*)`
		: "emulate: disabled, using the real providers"
);

const app = Bun.spawn(["bun", "run", "dev:app"], {
	cwd: root,
	env: childEnv,
	stdin: "inherit",
	stdout: "inherit",
	stderr: "inherit",
});

function shutdown() {
	app.kill();
	process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

process.exit(await app.exited);
