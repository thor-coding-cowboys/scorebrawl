#!/usr/bin/env bun
import { spawnSync } from "bun";
import { rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const mobileDir = resolve(import.meta.dir, "../../mobile");
const envFile = resolve(mobileDir, ".env.local");

const apiUrl = process.env.MOBILE_E2E_API_URL ?? "http://localhost:5173";

// apps/mobile/.env is committed and outranks the shell environment, so the e2e
// values have to go in .env.local (gitignored, higher precedence, removed again
// after the export). Social sign-in is the only way in: the specs drive the
// emulated GitHub/Google providers, so both ids have to render the buttons.
const overrides: Record<string, string> = {
	EXPO_PUBLIC_API_URL: apiUrl,
	EXPO_PUBLIC_DISABLE_PASSKEY: "true",
	EXPO_PUBLIC_GITHUB_CLIENT_ID: "Ov23liEHPLUdBgTj5Cxu",
	EXPO_PUBLIC_GOOGLE_CLIENT_ID:
		"972190779505-ob8vi6970ib3c8i46plgmu4i9cpr7ohg.apps.googleusercontent.com",
};

await writeFile(
	envFile,
	`${Object.entries(overrides)
		.map(([key, value]) => `${key}=${value}`)
		.join("\n")}\n`
);

try {
	// Metro does not invalidate its cache when the inlined EXPO_PUBLIC_* values
	// change, so every export starts clean.
	const result = spawnSync(["bunx", "expo", "export", "--platform", "web", "--clear"], {
		cwd: mobileDir,
		stdout: "inherit",
		stderr: "inherit",
		env: { ...process.env, ...overrides },
	});

	if (result.exitCode !== 0) {
		process.exit(result.exitCode ?? 1);
	}
} finally {
	await rm(envFile, { force: true });
}
