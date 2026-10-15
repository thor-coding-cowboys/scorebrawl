# Mobile Passkeys Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make passkeys work in the mobile app — native passkey sign-in plus add/rename/delete passkey management — sharing one rpID with the web app so a passkey registered on either surface works on both.

**Architecture:** The server derives the passkey rpID from the request and already resolves `scorebrawl.com` for native clients (which send no `Origin` header), so the two surfaces already share an rpID. What is missing is (a) the platform association files (AASA + assetlinks) served on `scorebrawl.com`, (b) an rpID/origin config that can also accept Android `apk-key-hash` origins, and (c) a React Native implementation of the WebAuthn ceremony, since `@better-auth/passkey/client` depends on `navigator.credentials`. A native module supplies (c); the UI mirrors the existing web implementation.

**Tech Stack:** Cloudflare Workers (Hono), better-auth 1.7.3 + `@better-auth/passkey`, `expo-better-auth-passkey` 1.6.1, Expo SDK 57 / RN 0.86, Vitest with `@cloudflare/vitest-pool-workers`, TanStack Query, `expo-symbols`.

**Spec:** `docs/features/23-mobile-passkeys.md`

---

## Prerequisites (human, cannot be automated)

- Physical iOS and/or Android device. Passkey UI does not work in the iOS Simulator or Android Emulator.
- Android signing SHA-256 fingerprints (`eas credentials -p android`), converted to base64url, for `PASSKEY_ANDROID_APK_KEY_HASHES`. Until supplied, the `assetlinks.json` body ships with an empty fingerprint list and **Android passkey sign-in stays broken** (iOS is unaffected).
- A native rebuild after the dependency and `app.json` changes (`bunx expo prebuild` + EAS build / `expo run:ios|android`). OTA updates alone cannot add a native module or an entitlement.

## Reference

- Skill `@superpowers:test-driven-development` for Tasks 3 and 5.
- Skill `@mobile-web-parity` for Tasks 9 and 10. Web sources: `apps/web/src/routes/_auth/auth/-components/sign-in-form.tsx`, `apps/web/src/routes/_authenticated/_sidebar/profile.tsx:327-430`, `apps/web/src/routes/_authenticated/_sidebar/-components/profile/edit-passkey-dialog.tsx`.
- Expo v57 docs (required by `apps/mobile/AGENTS.md` before writing mobile code): [app config](https://docs.expo.dev/versions/v57.0.0/config/app/), [expo-symbols](https://docs.expo.dev/versions/v57.0.0/sdk/symbols/).
- Worker tests live in `apps/worker/test/**/*.spec.ts`. `apps/worker/src/test/` does not exist (root `AGENTS.md` is stale on this).

---

### Task 1: Give `@better-auth/passkey` a catalog entry

Three packages end up importing it: worker (server), web (client, currently imported but **undeclared**), and mobile (Task 6). AGENTS.md: shared by 2+ packages → catalog.

**Files:**

- Modify: `package.json`
- Modify: `apps/worker/package.json:32`
- Modify: `apps/web/package.json:15`

- [ ] **Step 1: Add the catalog entry**

In `package.json`, insert after `"@better-auth/expo": "1.7.3",`:

```json
		"@better-auth/passkey": "1.7.3",
```

- [ ] **Step 2: Point worker and web at the catalog**

`apps/worker/package.json`, replace `"@better-auth/passkey": "1.7.3",` with:

```json
		"@better-auth/passkey": "catalog:",
```

`apps/web/package.json`, insert after `"@base-ui/react": "^1.0.0",` (alphabetical):

```json
		"@better-auth/passkey": "catalog:",
```

- [ ] **Step 3: Install and verify resolution**

Run: `bun install`
Then: `node -p "require('./node_modules/@better-auth/passkey/package.json').version"`
Expected: prints `1.7.3`

- [ ] **Step 4: Typecheck both apps**

Run: `bun --cwd apps/worker typecheck && bun --cwd apps/web typecheck`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add package.json apps/worker/package.json apps/web/package.json bun.lock
git commit -m "chore(deps): move @better-auth/passkey to the workspace catalog"
```

---

### Task 2: Add the Android fingerprint var and regenerate worker types

**Files:**

- Modify: `apps/worker/wrangler.jsonc:66-74`
- Modify: `apps/worker/worker-configuration.d.ts` (generated)

- [ ] **Step 1: Add the var**

In `apps/worker/wrangler.jsonc`, inside `"vars"`, replace:

```jsonc
		"PROD_URL": "https://scorebrawl.com",
		"PROD_PUBLIC_API_URL": "https://api.scorebrawl.com"
	},
```

with:

```jsonc
		"PROD_URL": "https://scorebrawl.com",
		"PROD_PUBLIC_API_URL": "https://api.scorebrawl.com",
		// Comma-separated base64url SHA-256 signing-certificate fingerprints
		// (debug + Play App Signing). Empty until supplied — Android passkey
		// sign-in fails until then. iOS is unaffected.
		"PASSKEY_ANDROID_APK_KEY_HASHES": ""
	},
```

Do **not** add `PASSKEY_RP_ID` here. There are no `env` blocks, so a shared value would also apply to previews, where `scorebrawl.com` is not a valid rpID suffix — the exact thing that would break preview passkey sign-in.

- [ ] **Step 2: Regenerate types**

Run: `bun cf-typegen`
Expected: `apps/worker/worker-configuration.d.ts` updated (`wrangler types` runs with cwd `apps/worker`; the identical-looking root `worker-configuration.d.ts` is stale and unreferenced by either tsconfig)

- [ ] **Step 3: Verify the binding is typed**

Run: `grep -n "PASSKEY_ANDROID_APK_KEY_HASHES" apps/worker/worker-configuration.d.ts`
Expected: two matches. Vars from `wrangler.jsonc` are emitted as literal types, so expect `PASSKEY_ANDROID_APK_KEY_HASHES: "";` (like `VERSION: "local";`), plus a second occurrence as a key in the `NodeJS.ProcessEnv` `Pick<Cloudflare.Env, …>` list — the same duplication `VERSION` already has

- [ ] **Step 4: Commit**

```bash
git add apps/worker/wrangler.jsonc apps/worker/worker-configuration.d.ts
git commit -m "feat(worker): add PASSKEY_ANDROID_APK_KEY_HASHES var"
```

---

### Task 3: `buildPasskeyConfig` — pure rpID/origin derivation

Today the derivation is inline in `createAuth()` and untestable (the plugin's options are not inspectable). Extract it.

**Files:**

- Create: `apps/worker/src/lib/passkey-config.ts`
- Test: `apps/worker/test/lib/passkey-config.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/worker/test/lib/passkey-config.spec.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildPasskeyConfig } from "../../src/lib/passkey-config";

describe("buildPasskeyConfig", () => {
	it("derives rpID and origin from the request origin", () => {
		expect(buildPasskeyConfig({ requestOrigin: "https://scorebrawl.com" })).toEqual({
			rpID: "scorebrawl.com",
			origin: ["https://scorebrawl.com"],
		});
	});

	it("derives rpID from the host for non-local origins", () => {
		expect(buildPasskeyConfig({ requestOrigin: "https://pr-1.workers.dev" }).rpID).toBe(
			"pr-1.workers.dev"
		);
	});

	it("normalises local origins to the vite dev origin", () => {
		expect(buildPasskeyConfig({ requestOrigin: "https://scorebrawl.localhost:1355" })).toEqual({
			rpID: "localhost",
			origin: ["http://localhost:5173"],
		});
		expect(buildPasskeyConfig({})).toEqual({
			rpID: "localhost",
			origin: ["http://localhost:5173"],
		});
	});

	it("appends one apk-key-hash origin per configured fingerprint", () => {
		const config = buildPasskeyConfig({
			requestOrigin: "https://scorebrawl.com",
			androidKeyHashes: " AAA , ,BBB ",
		});
		expect(config.origin).toEqual([
			"https://scorebrawl.com",
			"android:apk-key-hash:AAA",
			"android:apk-key-hash:BBB",
		]);
		expect(config.rpID).toBe("scorebrawl.com");
	});

	it("honours the rpID override without changing the origin list", () => {
		const config = buildPasskeyConfig({
			requestOrigin: "https://pr-1.workers.dev",
			rpIdOverride: "preview.scorebrawl.com",
		});
		expect(config.rpID).toBe("preview.scorebrawl.com");
		expect(config.origin).toEqual(["https://pr-1.workers.dev"]);
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun --cwd apps/worker vitest run test/lib/passkey-config.spec.ts`
Expected: FAIL — cannot resolve `../../src/lib/passkey-config`

- [ ] **Step 3: Write the implementation**

Create `apps/worker/src/lib/passkey-config.ts`:

```ts
const LOCAL_DEV_ORIGIN = "http://localhost:5173";

export interface PasskeyConfig {
	rpID: string;
	origin: string[];
}

export interface PasskeyConfigInput {
	requestOrigin?: string;
	rpIdOverride?: string;
	androidKeyHashes?: string;
}

function resolveOrigin(requestOrigin?: string): string {
	if (!requestOrigin) return LOCAL_DEV_ORIGIN;
	if (requestOrigin.includes("localhost") || requestOrigin.includes("127.0.0.1")) {
		return LOCAL_DEV_ORIGIN;
	}
	return requestOrigin;
}

function originHostname(origin: string): string {
	try {
		return new URL(origin).hostname;
	} catch {
		return "localhost";
	}
}

function androidOrigins(raw?: string): string[] {
	if (!raw) return [];
	return raw
		.split(",")
		.map((hash) => hash.trim())
		.filter(Boolean)
		.map((hash) => `android:apk-key-hash:${hash}`);
}

/**
 * Derives the WebAuthn relying party config from the request.
 *
 * Native clients send no `Origin` header, so the caller falls back to the
 * request host — in production that yields `scorebrawl.com`, the same rpID the
 * web app uses, which is what lets one passkey work on both surfaces.
 */
export function buildPasskeyConfig({
	requestOrigin,
	rpIdOverride,
	androidKeyHashes,
}: PasskeyConfigInput): PasskeyConfig {
	const baseOrigin = resolveOrigin(requestOrigin);
	return {
		rpID: rpIdOverride || originHostname(baseOrigin),
		origin: [baseOrigin, ...androidOrigins(androidKeyHashes)],
	};
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun --cwd apps/worker vitest run test/lib/passkey-config.spec.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/worker/src/lib/passkey-config.ts apps/worker/test/lib/passkey-config.spec.ts
git commit -m "feat(worker): extract pure passkey rpID/origin derivation"
```

---

### Task 4: Wire the helper into the auth config

**Files:**

- Modify: `apps/worker/src/lib/better-auth.ts:47-91` (params) and `:332-336` (plugin)
- Modify: `apps/worker/src/middleware/context.ts:57-76`

- [ ] **Step 1: Delete the inline derivation**

In `apps/worker/src/lib/better-auth.ts`, delete the `getRpID` function and the `passkeyOrigin` / `rpID` constants (the block spanning the `// Determine rpID and origin for passkey` comment through `const rpID = getRpID(passkeyOrigin);`), leaving `hasAnySocialProviders` in place.

- [ ] **Step 2: Accept the config as a parameter**

Add the import at the top of `apps/worker/src/lib/better-auth.ts`:

```ts
import { buildPasskeyConfig, type PasskeyConfig } from "./passkey-config";
```

Add `passkey` to the `createAuth` signature in **both** places it appears — the destructured binding list and the inline parameter type. Miss the first and Step 3's `passkey ?? …` will not compile (`Cannot find name 'passkey'`).

In the destructure list, after `oauthResource,`:

```ts
	oauthResource,
	passkey,
	baseURL,
}: {
```

In the inline type, after `oauthResource?: string;` (optional):

```ts
	oauthResource?: string;
	passkey?: PasskeyConfig;
	baseURL?: string;
```

It must be optional. `createAuth` has eight call sites and only the request middleware supplies a config. `apps/worker/src/middleware/context.ts:91` (the better-auth CLI export) and six test helpers — `apps/worker/test/setup/auth-context-util.ts:72,138,167`, `apps/worker/test/setup/oauth-util.ts:55`, `apps/worker/test/lib/sign-in.spec.ts:10`, `apps/worker/test/trpc/player-router.spec.ts:173` — call it without one, and the plugin options object is evaluated eagerly when `betterAuth()` is constructed, so a required field would throw `Cannot read properties of undefined (reading 'rpID')` in those tests. (`apps/worker/test/` is outside the worker tsconfig `include`, so typecheck would not catch that — only the test run would.)

- [ ] **Step 3: Default it and pass it to the plugin**

At the top of the `createAuth` body, before `return betterAuth({`, add:

```ts
// Only the request middleware supplies a config; tests and the better-auth
// CLI export fall back to local dev values, matching previous behaviour.
const passkeyConfig = passkey ?? buildPasskeyConfig({});
```

Then replace the `passkey({ ... })` plugin options with:

```ts
			passkey({
				rpID: passkeyConfig.rpID,
				rpName: "Scorebrawl",
				origin: passkeyConfig.origin,
			}),
```

> Superseded: the `passkey` parameter (Step 2) shadows the `passkey` plugin import, so the landed implementation aliases the import (`import { passkey as passkeyPlugin }`) and calls `passkeyPlugin({ ... })`.

- [ ] **Step 4: Build the config in the middleware**

In `apps/worker/src/middleware/context.ts`, add the import:

```ts
import { buildPasskeyConfig } from "../lib/passkey-config";
```

Replace the `// Get origin from request for passkey configuration` comment and the `origin` constant with:

```ts
// Native clients send no Origin header, so this falls back to the request
// host — in production `https://scorebrawl.com`, which keeps the passkey
// rpID identical to the web app's.
const origin =
	c.req.header("origin") ||
	`${c.req.header("x-forwarded-proto") || "https"}://${c.req.header("host") || "localhost"}`;

// Unset in wrangler.jsonc by design (see docs/features/23-mobile-passkeys.md).
const passkey = buildPasskeyConfig({
	requestOrigin: origin,
	rpIdOverride: (c.env as { PASSKEY_RP_ID?: string }).PASSKEY_RP_ID,
	androidKeyHashes: c.env.PASSKEY_ANDROID_APK_KEY_HASHES,
});
```

Add `passkey,` to the `createAuth({ ... })` call, after `origin,`:

```ts
		origin,
		passkey,
```

Leave `baseURL: betterAuthUrl ?? origin` and `trustedOrigins` untouched — they are unrelated to rpID.

- [ ] **Step 5: Verify**

Run: `bun --cwd apps/worker typecheck`
Expected: no errors

Run: `bun --cwd apps/worker vitest run test/lib/passkey-config.spec.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/worker/src/lib/better-auth.ts apps/worker/src/middleware/context.ts
git commit -m "refactor(worker): source passkey rpID/origin from buildPasskeyConfig"
```

---

### Task 5: Serve the `.well-known` association files

**Files:**

- Create: `apps/worker/src/routes/well-known.ts`
- Modify: `apps/worker/src/index.ts:45-49`
- Modify: `apps/worker/wrangler.jsonc:89-93`
- Test: `apps/worker/test/routes/well-known.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/worker/test/routes/well-known.spec.ts`:

```ts
import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { enforceHostScope } from "../../src/public-api/host-scope";
import { sha256Base64ToHex, wellKnownRouter } from "../../src/routes/well-known";
import type { HonoEnv } from "../../src/middleware/context";

// A real SHA-256 fingerprint in both encodings, to pin url-safe decoding.
const FINGERPRINT_BASE64URL = "FG3pg8VzBlDY7rmVLzT8ZBagg0LmHb6oigSWsj_PROU";
const FINGERPRINT_HEX =
	"14:6D:E9:83:C5:73:06:50:D8:EE:B9:95:2F:34:FC:64:16:A0:83:42:E6:1D:BE:A8:8A:04:96:B2:3F:CF:44:E5";

const hostEnv = {
	PROD_URL: "https://scorebrawl.com",
	PROD_PUBLIC_API_URL: "https://api.scorebrawl.com",
};

const app = new Hono<HonoEnv>().use("*", enforceHostScope).route("/.well-known", wellKnownRouter);

const call = (path: string, env: Record<string, string> = {}) =>
	app.request(`https://scorebrawl.com/.well-known/${path}`, {}, {
		...hostEnv,
		...env,
	} as unknown as Env);

describe("sha256Base64ToHex", () => {
	it("decodes base64url into colon-separated uppercase hex", () => {
		expect(sha256Base64ToHex(FINGERPRINT_BASE64URL)).toBe(FINGERPRINT_HEX);
	});
});

describe("apple-app-site-association", () => {
	it("serves the webcredentials app id as JSON", async () => {
		const res = await call("apple-app-site-association");
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("application/json");
		expect(await res.json()).toEqual({
			webcredentials: { apps: ["VWB9AT6XKY.com.scorebrawl"] },
		});
	});
});

describe("assetlinks.json", () => {
	it("returns an android_app target with an empty fingerprint list when unset", async () => {
		const res = await call("assetlinks.json");
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("application/json");
		expect(await res.json()).toEqual([
			{
				relation: [
					"delegate_permission/common.get_login_creds",
					"delegate_permission/common.handle_all_urls",
				],
				target: {
					namespace: "android_app",
					package_name: "com.scorebrawl",
					sha256_cert_fingerprints: [],
				},
			},
		]);
	});

	it("converts configured fingerprints to hex", async () => {
		const res = await call("assetlinks.json", {
			PASSKEY_ANDROID_APK_KEY_HASHES: ` ${FINGERPRINT_BASE64URL} ,`,
		});
		const body = (await res.json()) as Array<{ target: { sha256_cert_fingerprints: string[] } }>;
		expect(body[0].target.sha256_cert_fingerprints).toEqual([FINGERPRINT_HEX]);
	});

	it("is not reachable on the API host", async () => {
		const res = await app.request(
			"https://api.scorebrawl.com/.well-known/assetlinks.json",
			{},
			hostEnv as unknown as Env
		);
		expect(res.status).toBe(404);
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun --cwd apps/worker vitest run test/routes/well-known.spec.ts`
Expected: FAIL — cannot resolve `../../src/routes/well-known`

- [ ] **Step 3: Write the route**

Create `apps/worker/src/routes/well-known.ts`:

```ts
import { Hono } from "hono";
import type { HonoEnv } from "../middleware/context";

// Apple Developer team ID (apps/mobile/eas.json) + the iOS bundle identifier.
const APPLE_APP_ID = "VWB9AT6XKY.com.scorebrawl";

const ANDROID_PACKAGE_NAME = "com.scorebrawl";

/** Apple and Android both want colon-separated uppercase hex; we store base64url. */
export function sha256Base64ToHex(value: string): string {
	const normalised = value.replace(/-/g, "+").replace(/_/g, "/");
	const padded = normalised + "=".repeat((4 - (normalised.length % 4)) % 4);
	const bytes = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0").toUpperCase()).join(":");
}

export const wellKnownRouter = new Hono<HonoEnv>()
	.get("/apple-app-site-association", (c) => c.json({ webcredentials: { apps: [APPLE_APP_ID] } }))
	.get("/assetlinks.json", (c) => {
		const fingerprints = (c.env.PASSKEY_ANDROID_APK_KEY_HASHES ?? "")
			.split(",")
			.map((hash) => hash.trim())
			.filter(Boolean)
			.map(sha256Base64ToHex);

		// TODO: set PASSKEY_ANDROID_APK_KEY_HASHES (debug + Play App Signing
		// SHA-256s, base64url). Android passkey sign-in fails while this is empty.
		return c.json([
			{
				relation: [
					"delegate_permission/common.get_login_creds",
					"delegate_permission/common.handle_all_urls",
				],
				target: {
					namespace: "android_app",
					package_name: ANDROID_PACKAGE_NAME,
					sha256_cert_fingerprints: fingerprints,
				},
			},
		]);
	});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun --cwd apps/worker vitest run test/routes/well-known.spec.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Register the routes before the catch-all auth middleware**

In `apps/worker/src/index.ts`, add the import near the other route imports:

```ts
import { wellKnownRouter } from "./routes/well-known";
```

Then insert the route immediately after the `/api/version` handler (before `.route("/api/auth", authRouter)`):

```ts
	.route("/.well-known", wellKnownRouter)
```

This position matters: the catch-all `.use("*", ...)` at the end of the chain calls `enforceAuthMiddleware`, so registering later would return 401 instead of association JSON.

- [ ] **Step 6: Let the worker see the paths**

In `apps/worker/wrangler.jsonc`, add `"/.well-known/*"` to `assets.run_worker_first`:

```jsonc
		"run_worker_first": [
			"/api/*",
			"/v1/*",
			"/leagues/v1/*",
			"/.well-known/*"
		]
```

Without this the `single-page-application` fallback answers with `index.html`.

- [ ] **Step 7: Verify end to end**

Run: `bun --cwd apps/worker test`
Expected: all suites pass, including the new ones

- [ ] **Step 8: Commit**

```bash
git add apps/worker/src/routes/well-known.ts apps/worker/src/index.ts apps/worker/wrangler.jsonc apps/worker/test/routes/well-known.spec.ts
git commit -m "feat(worker): serve apple-app-site-association and assetlinks.json"
```

---

### Task 6: Add the mobile passkey dependencies

**Files:**

- Modify: `apps/mobile/package.json`

- [ ] **Step 1: Add the dependencies**

In `apps/mobile/package.json`, inside `"dependencies"`, insert in alphabetical position:

```json
		"@better-auth/passkey": "catalog:",
		"@better-fetch/fetch": "^1.3.1",
		"@simplewebauthn/browser": "^13.3.0",
		"expo-better-auth-passkey": "1.6.1",
```

`@better-auth/passkey` comes from the catalog (Task 1). The other three are declared here only — they are `expo-better-auth-passkey`'s peers at 1.6.1 (`@better-fetch/fetch`, `@simplewebauthn/browser`) and its base client. `nanostores` is **not** a peer of 1.6.1; do not add it.

- [ ] **Step 2: Install**

Run: `bun install`
Expected: exit 0

- [ ] **Step 3: Verify the module resolves**

Run: `node -p "require('./node_modules/expo-better-auth-passkey/package.json').version"`
Expected: `1.6.1`

- [ ] **Step 4: Typecheck**

Run: `bun --cwd apps/mobile typecheck`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/package.json bun.lock
git commit -m "feat(mobile): add expo-better-auth-passkey and its peers"
```

---

### Task 7: Declare the iOS associated domain

**Files:**

- Modify: `apps/mobile/app.json`

`apps/mobile/ios` is gitignored and regenerated from config, so the entitlement cannot be hand-edited or committed.

- [ ] **Step 1: Add `associatedDomains`**

In `apps/mobile/app.json`, replace the `ios` block with:

```json
		"ios": {
			"icon": "./assets/images/icon.png",
			"bundleIdentifier": "com.scorebrawl",
			"associatedDomains": ["webcredentials:scorebrawl.com"],
			"config": {
				"usesNonExemptEncryption": false
			}
		},
```

- [ ] **Step 2: Verify the resolved config**

Run: `cd apps/mobile && bunx expo config --json | grep -A 2 associatedDomains`
Expected: `"webcredentials:scorebrawl.com"` present

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app.json
git commit -m "feat(mobile): declare webcredentials associated domain"
```

---

### Task 8: Wire the passkey client

**Files:**

- Modify: `apps/mobile/src/lib/auth-client.ts`
- Modify: `apps/mobile/src/lib/auth-options.ts`

- [ ] **Step 1: Add the plugin**

In `apps/mobile/src/lib/auth-client.ts`, add the import:

```ts
import { expoPasskeyClient } from "expo-better-auth-passkey";
```

and add it to `plugins`, after `organizationClient({})`:

```ts
	plugins: [
		expoClient({
			scheme: "scorebrawl",
			storagePrefix: "scorebrawl",
			storage: SecureStore,
		}),
		organizationClient({}),
		expoPasskeyClient(),
	],
```

`expoPasskeyClient()` delegates to the stock browser client when `Platform.OS === "web"`, so the Expo web build is unaffected.

- [ ] **Step 2: Add the kill switch**

In `apps/mobile/src/lib/auth-options.ts`, append:

```ts
export const isPasskeyEnabled = process.env.EXPO_PUBLIC_DISABLE_PASSKEY !== "true";
```

- [ ] **Step 3: Typecheck**

Run: `bun --cwd apps/mobile typecheck`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/lib/auth-client.ts apps/mobile/src/lib/auth-options.ts
git commit -m "feat(mobile): add passkey client plugin and kill switch"
```

---

### Task 9: Passkey sign-in button

**Files:**

- Modify: `apps/mobile/src/app/sign-in.tsx`

Mirror the web wording from `apps/web/src/routes/_auth/auth/-components/sign-in-form.tsx:154-226`.

- [ ] **Step 1: Add imports and state**

In `apps/mobile/src/app/sign-in.tsx`, extend the auth-options import:

```ts
import {
	isEmailPasswordEnabled,
	isGithubEnabled,
	isGoogleEnabled,
	isPasskeyEnabled,
} from "@/lib/auth-options";
```

Add state alongside the existing loading flags:

```ts
const [isPasskeyLoading, setIsPasskeyLoading] = useState(false);
```

- [ ] **Step 2: Add the handler**

Insert before `const hasSocialOptions = ...`:

```ts
const handlePasskeySignIn = async () => {
	setApiError("");
	setIsPasskeyLoading(true);
	try {
		const { data, error } = await authClient.signIn.passkey();
		if (error) {
			setApiError(passkeyErrorMessage(error.message));
			return;
		}
		if (!data) {
			setApiError("Failed to sign in with passkey. Please try again.");
			return;
		}
		await authClient.getSession();
		router.replace("/");
	} catch (err) {
		setApiError(
			err instanceof Error ? err.message : "Failed to sign in with passkey. Please try again."
		);
	} finally {
		setIsPasskeyLoading(false);
	}
};
```

And add the message mapper above the component (after the imports):

```ts
function passkeyErrorMessage(message?: string) {
	const lower = (message ?? "").toLowerCase();
	if (lower.includes("cancel") || lower.includes("abort")) {
		return "Passkey sign-in was cancelled. If you have no passkey for this account, sign in another way, then add one from your profile.";
	}
	if (lower.includes("not allowed")) {
		return "Passkey sign-in was not allowed. Please try again or use another sign-in method.";
	}
	if (
		lower.includes("not found") ||
		lower.includes("no passkey") ||
		lower.includes("no credential")
	) {
		return "No passkey found for this account. Sign in another way, then add one from your profile.";
	}
	return message || "Failed to sign in with passkey. Please try again.";
}
```

Read `error.message` only. The declared return type is `ReturnType<typeof passkeyClient>` (`expo-better-auth-passkey/build/index.d.ts` → `build/plugin.d.ts`), whose error union contains members both with and without `code`, so `error.code` is a TS2339 error. Pattern-matching the message is also what the web implementation does (`sign-in-form.tsx:162-184`).

- [ ] **Step 3: Update the gate and render the button**

Replace the `hasSocialOptions` line with:

```ts
const hasPasskeyOption = isPasskeyEnabled;
const hasAlternateOptions = hasPasskeyOption || isGithubEnabled || isGoogleEnabled;
```

Then rename the `{hasSocialOptions && (` condition to `{hasAlternateOptions && (`. The fragment inside that condition must end up exactly as follows — the passkey button added first, and the two existing social buttons each given their own guard:

```tsx
<>
	{isEmailPasswordEnabled && <Separator label="Or continue with" />}
	{!isEmailPasswordEnabled && apiError ? (
		<ThemedText style={[styles.error, { color: theme.destructive }]}>{apiError}</ThemedText>
	) : null}
	{hasPasskeyOption && (
		<Button
			variant="outline"
			fullWidth
			icon={{ ios: "key.fill", android: "key", web: "key" }}
			loading={isPasskeyLoading}
			disabled={isSubmitting}
			onPress={handlePasskeySignIn}
		>
			{isPasskeyLoading ? "Signing in..." : "Sign in with Passkey"}
		</Button>
	)}
	{isGithubEnabled && (
		<Button
			variant="outline"
			fullWidth
			loading={isGithubLoading}
			disabled={isSubmitting}
			onPress={() => handleSocialSignIn("github")}
		>
			{isGithubLoading ? "Signing in..." : "Sign in with GitHub"}
		</Button>
	)}
	{isGoogleEnabled && (
		<Button
			variant="outline"
			fullWidth
			loading={isGoogleLoading}
			disabled={isSubmitting}
			onPress={() => handleSocialSignIn("google")}
		>
			{isGoogleLoading ? "Signing in..." : "Sign in with Google"}
		</Button>
	)}
</>
```

The two added guards matter: the social buttons currently render unconditionally inside a block gated on `isGithubEnabled || isGoogleEnabled`, so widening that gate to include passkeys (on by default) would show non-functional GitHub and Google buttons wherever those env vars are unset.

`theme` and `styles.error` are already defined in this file (the email/password branch uses them).

- [ ] **Step 4: Typecheck**

Run: `bun --cwd apps/mobile typecheck`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/app/sign-in.tsx
git commit -m "feat(mobile): sign in with a passkey"
```

---

### Task 10: Passkey management in profile

**Files:**

- Modify: `apps/mobile/src/app/profile.tsx`
- Create: `apps/mobile/src/components/profile/rename-passkey-modal.tsx`

Mirror `apps/web/src/routes/_authenticated/_sidebar/profile.tsx:327-430` (list/add/edit/delete) and `edit-passkey-dialog.tsx` (rename), mapped to mobile patterns: rows like the existing Sessions section, `Alert.alert` for the delete confirm, and a `Modal` like `edit-profile-modal.tsx`. The web implementation uses `toast`; mobile has no toast, so surface errors as inline text.

- [ ] **Step 1: Create the rename modal**

Create `apps/mobile/src/components/profile/rename-passkey-modal.tsx`:

```tsx
import { useEffect, useState } from "react";
import { Modal, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ModalCloseButton } from "@/components/ui/modal-close-button";
import { Spacing } from "@/constants/theme";

export function RenamePasskeyModal({
	isOpen,
	currentName,
	isSaving,
	onClose,
	onSave,
}: {
	isOpen: boolean;
	currentName: string;
	isSaving: boolean;
	onClose: () => void;
	onSave: (name: string) => void;
}) {
	const insets = useSafeAreaInsets();
	const [name, setName] = useState(currentName);

	useEffect(() => {
		if (isOpen) setName(currentName);
	}, [isOpen, currentName]);

	return (
		<Modal visible={isOpen} animationType="slide" onRequestClose={onClose}>
			<ThemedView style={styles.flex}>
				<View
					style={[
						styles.content,
						{ paddingTop: insets.top + Spacing.three, paddingBottom: insets.bottom + Spacing.two },
					]}
				>
					<View style={styles.header}>
						<ThemedText type="subtitle">Rename Passkey</ThemedText>
						<ModalCloseButton onPress={onClose} />
					</View>

					<Input
						label="Passkey name"
						placeholder="My Passkey"
						value={name}
						onChangeText={setName}
						editable={!isSaving}
						autoFocus
					/>

					<View style={styles.actions}>
						<Button variant="outline" onPress={onClose} disabled={isSaving}>
							Cancel
						</Button>
						<Button
							variant="glow"
							style={styles.submit}
							onPress={() => onSave(name.trim())}
							loading={isSaving}
							disabled={!name.trim()}
						>
							Save Changes
						</Button>
					</View>
				</View>
			</ThemedView>
		</Modal>
	);
}

const styles = StyleSheet.create({
	flex: { flex: 1 },
	content: { flex: 1, paddingHorizontal: Spacing.four, gap: Spacing.three },
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	actions: { flexDirection: "row", gap: Spacing.two, marginTop: Spacing.two },
	submit: { flex: 1 },
});
```

- [ ] **Step 2: Add the passkey data and mutations to the profile screen**

In `apps/mobile/src/app/profile.tsx`, extend the React Query import:

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
```

Add the modal import next to the existing profile component import:

```ts
import { RenamePasskeyModal } from "@/components/profile/rename-passkey-modal";
```

Add state next to `isEditOpen`:

```ts
const [editingPasskey, setEditingPasskey] = useState<{ id: string; name: string } | null>(null);
const [passkeyError, setPasskeyError] = useState("");
```

Add the query and mutations after `sessionsQuery`:

```ts
const passkeysQuery = useQuery({
	queryKey: ["passkeys"],
	queryFn: async () => {
		const { data, error } = await authClient.passkey.listUserPasskeys({});
		if (error) throw new Error(error.message || "Failed to load passkeys");
		return data ?? [];
	},
});

const addPasskey = useMutation({
	mutationFn: async () => {
		const { data, error } = await authClient.passkey.addPasskey();
		if (error) throw new Error(error.message || "Failed to add passkey");
		return data;
	},
	onSuccess: () => {
		setPasskeyError("");
		void queryClient.invalidateQueries({ queryKey: ["passkeys"] });
	},
	onError: (err) => setPasskeyError(err instanceof Error ? err.message : "Failed to add passkey"),
});

const renamePasskey = useMutation({
	mutationFn: async ({ id, name }: { id: string; name: string }) => {
		const { data, error } = await authClient.passkey.updatePasskey({ id, name });
		if (error) throw new Error(error.message || "Failed to update passkey");
		return data;
	},
	onSuccess: () => {
		setPasskeyError("");
		setEditingPasskey(null);
		void queryClient.invalidateQueries({ queryKey: ["passkeys"] });
	},
	onError: (err) =>
		setPasskeyError(err instanceof Error ? err.message : "Failed to update passkey"),
});

const deletePasskey = useMutation({
	mutationFn: async (id: string) => {
		const { data, error } = await authClient.passkey.deletePasskey({ id });
		if (error) throw new Error(error.message || "Failed to delete passkey");
		return data;
	},
	onSuccess: () => {
		setPasskeyError("");
		void queryClient.invalidateQueries({ queryKey: ["passkeys"] });
	},
	onError: (err) =>
		setPasskeyError(err instanceof Error ? err.message : "Failed to delete passkey"),
});

const passkeys = passkeysQuery.data ?? [];
```

Add the confirm helper next to `revokeOther`:

```ts
const confirmDeletePasskey = (passkey: { id: string; name?: string | null }) => {
	Alert.alert(
		"Delete passkey?",
		`"${passkey.name || "Unnamed passkey"}" will be removed. This cannot be undone.`,
		[
			{ text: "Cancel", style: "cancel" },
			{
				text: "Delete",
				style: "destructive",
				onPress: () => deletePasskey.mutate(passkey.id),
			},
		]
	);
};
```

Include `passkeysQuery.refetch()` in the pull-to-refresh list:

```ts
const { refreshing, onRefresh } = usePullToRefresh(() =>
	Promise.all([
		leaguesQuery.refetch(),
		matchesQuery.refetch(),
		sessionsQuery.refetch(),
		passkeysQuery.refetch(),
	])
);
```

- [ ] **Step 3: Render the section**

Add the import next to the other `@/lib` imports:

```ts
import { isPasskeyEnabled } from "@/lib/auth-options";
```

Insert immediately after the Sessions section's closing `</View>`, wrapped in the kill switch so `EXPO_PUBLIC_DISABLE_PASSKEY=true` hides this section as well as the sign-in button: the guard is `{isPasskeyEnabled && ( … )}`, and the fragment inside it is exactly:

```tsx
<>
	<Divider />

	<View>
		<View style={styles.sectionHeader}>
			<SectionLabel>Passkeys</SectionLabel>
			<Pressable
				accessibilityRole="button"
				hitSlop={8}
				disabled={addPasskey.isPending}
				onPress={() => addPasskey.mutate()}
			>
				<ThemedText type="small" themeColor={addPasskey.isPending ? "mutedForeground" : "primary"}>
					{addPasskey.isPending ? "Adding…" : "Add passkey"}
				</ThemedText>
			</Pressable>
		</View>

		{passkeyError ? (
			<ThemedText type="small" style={{ color: theme.destructive }}>
				{passkeyError}
			</ThemedText>
		) : null}

		{passkeysQuery.isPending ? (
			<ThemedText type="small" themeColor="mutedForeground">
				Loading passkeys…
			</ThemedText>
		) : passkeysQuery.isError ? (
			<ThemedText type="small" themeColor="mutedForeground">
				Couldn't load passkeys
			</ThemedText>
		) : passkeys.length === 0 ? (
			<ThemedText type="small" themeColor="mutedForeground">
				No passkeys yet. Add one to sign in without a password.
			</ThemedText>
		) : (
			passkeys.map((passkey, index) => (
				<View
					key={passkey.id}
					style={[
						styles.sessionRow,
						index < passkeys.length - 1 && {
							borderBottomWidth: StyleSheet.hairlineWidth,
							borderBottomColor: theme.border,
						},
					]}
				>
					<View style={styles.sessionInfo}>
						<ThemedText numberOfLines={1}>{passkey.name || "Unnamed passkey"}</ThemedText>
						<ThemedText type="small" themeColor="mutedForeground" numberOfLines={1}>
							{passkey.deviceType}
							{passkey.backedUp ? " · Backed up" : ""}
						</ThemedText>
					</View>
					<View style={styles.sectionActions}>
						<Pressable
							accessibilityRole="button"
							hitSlop={8}
							onPress={() => setEditingPasskey({ id: passkey.id, name: passkey.name || "" })}
						>
							<ThemedText type="small" themeColor="mutedForeground">
								Rename
							</ThemedText>
						</Pressable>
						<Pressable
							accessibilityRole="button"
							hitSlop={8}
							onPress={() => confirmDeletePasskey(passkey)}
						>
							<ThemedText type="small" style={{ color: theme.destructive }}>
								Delete
							</ThemedText>
						</Pressable>
					</View>
				</View>
			))
		)}
	</View>
</>
```

- [ ] **Step 4: Render the modal**

Next to the existing `<EditProfileModal ... />`, add:

```tsx
<RenamePasskeyModal
	isOpen={editingPasskey !== null}
	currentName={editingPasskey?.name ?? ""}
	isSaving={renamePasskey.isPending}
	onClose={() => setEditingPasskey(null)}
	onSave={(name) => {
		if (editingPasskey) renamePasskey.mutate({ id: editingPasskey.id, name });
	}}
/>
```

- [ ] **Step 5: Typecheck**

Run: `bun --cwd apps/mobile typecheck`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/app/profile.tsx apps/mobile/src/components/profile/rename-passkey-modal.tsx
git commit -m "feat(mobile): manage passkeys from profile"
```

---

### Task 11: Full verification and documentation

**Files:**

- Modify: `docs/features/23-mobile-passkeys.md` (Status section)
- Modify: `docs/features/README.md` (feature 23 row)

- [ ] **Step 1: Run the full gate**

Run: `bun check && bun run test`
Expected: clean typecheck, lint and format; all tests pass

- [ ] **Step 2: Update the doc status**

In `docs/features/23-mobile-passkeys.md`, replace the `## Status` body with a line naming the landed commit range and stating explicitly what remains blocked on the Android fingerprints and on a physical-device check.

In `docs/features/README.md`, change feature 23's Status cell from `Not started — …` to `Partial — server + app wiring landed; blocked on Android fingerprints and device verification`.

- [ ] **Step 3: Commit**

```bash
git add docs/features/23-mobile-passkeys.md docs/features/README.md
git commit -m "docs(features): record mobile passkeys implementation status"
```

- [ ] **Step 4: Manual verification (requires a human with a device)**

Not automatable in this repo; record the outcome in the PR.

1. Deploy or use a preview with the association files live. Verify:
   `curl -i https://scorebrawl.com/.well-known/apple-app-site-association`
   `curl -i https://scorebrawl.com/.well-known/assetlinks.json`
   Expect `200`, `content-type: application/json`, no redirect.
2. Build a native app (`bunx expo prebuild` then `expo run:ios` / EAS build) on a physical device.
3. In the mobile app: Profile → Add passkey → complete the system prompt → the passkey appears in the list.
4. Sign out, then sign in with the passkey button.
5. Cross-surface check: register a passkey in the **web** app, then sign in with it on **mobile**. This is the acceptance test for the shared rpID.

---

## Notes for the implementer

- Do not add `PASSKEY_RP_ID` to `wrangler.jsonc`. It is read as an optional field; adding it to shared `vars` breaks preview passkey sign-in (see the spec).
- The `android:apk-key-hash:` value encoding (base64url, padding) should be confirmed against the device's `clientDataJSON.origin` during manual verification. A mismatch surfaces as a misleading "rpId cannot be validated" error whose real cause is an origin mismatch.
- The mobile app has no test infrastructure; mobile tasks are verified by typecheck plus manual device steps. Do not invent a test framework for this change.
- `apps/mobile/AGENTS.md` requires reading the versioned Expo docs before writing mobile code. Tasks 7, 9 and 10 touch Expo-config or `expo-symbols` surfaces — check the v57 pages linked in Reference first.
