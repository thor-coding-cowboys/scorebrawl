# MCP Device Auth Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace custom MCP auth (auth code + token exchange + custom middleware) with better-auth's `deviceAuthorization` + `bearer` plugins.

**Architecture:** Server adds `deviceAuthorization()` and `bearer()` plugins to better-auth config. The MCP CLI uses the better-auth client's device flow (request code, open browser, poll for token). The `/device` verification page lives in the frontend with an org picker. The custom `mcp-auth-router`, `mcp-auth.ts` middleware, `mcp-tokens.ts`, and `mcp-schema.ts` are deleted — better-auth manages device codes and bearer tokens via sessions.

**Tech Stack:** better-auth (deviceAuthorization + bearer plugins), Hono, TanStack Router, better-auth/client

---

## Decisions

- **Org selection:** `/device` page shows org picker before approve. User selects which league to scope the session to.
- **Token format:** Remove `scbr_` prefix check from middleware. Bearer plugin uses session tokens directly.
- **Token expiry:** Use better-auth default session expiry for now.
- **Migration:** Not on prod yet — no migration path needed. Users re-login.
- **Client approach:** Follow archive pattern closely — `createAuthClient` with `deviceAuthorizationClient()`, keyring + file fallback for token storage.
- **Device code table:** better-auth manages this table via its adapter. No manual Drizzle schema needed. Run `bunx @better-auth/cli generate` to create the migration SQL, then `bun db:generate` to flatten. Since all custom MCP tables (`mcp_auth_code`, `mcp_token`) were created on this branch and never merged to main, they can be dropped freely — just reset dev DB.

## How it works

1. `bearer()` plugin: hooks into every request, checks for `Authorization: Bearer <token>` header, converts the token into a session cookie internally so better-auth resolves the session normally.
2. `deviceAuthorization()` plugin: creates a `device_code` table. Exposes endpoints:
   - `POST /api/auth/device/code` — CLI requests a device+user code
   - `GET /api/auth/device?user_code=X` — verify user code is valid
   - `POST /api/auth/device/approve` — authed user approves (requires session via cookie)
   - `POST /api/auth/device/token` — CLI polls; on approval, creates a session and returns `{ access_token: session.token }`
3. The `access_token` IS a session token. The bearer plugin makes it work as `Authorization: Bearer <session_token>`.

## Reference

Archive at `~/Downloads/Archive/`:

- `core/src/auth.ts` — server config with `bearer()`, `deviceAuthorization()`, `admin()` plugins
- `cli/src/commands/auth-login.ts` — CLI device flow: `authClient.device.code()` + poll `authClient.device.token()`
- `core/src/device-page.tsx` — Hono JSX page for device verification (login + approve)
- `cli/src/credentials.ts` — keyring + file fallback token storage

---

### Task 1: Add better-auth plugins + generate migration

**Files:**

- Modify: `apps/worker/src/lib/better-auth.ts`

- [ ] **Step 1: Add `bearer` and `deviceAuthorization` imports**

```typescript
import { organization, admin, bearer, deviceAuthorization } from "better-auth/plugins";
```

- [ ] **Step 2: Add plugins to the `plugins` array in `createAuth`**

Add after the `passkey` plugin:

```typescript
bearer(),
deviceAuthorization({
  verificationUri: "/device",
  schema: {},
}),
```

`schema: {}` is a workaround for a Zod v4 bug in better-auth (see archive reference).

- [ ] **Step 3: Run `bun oxc && bun typecheck`**

- [ ] **Step 4: Generate migration for `device_code` table**

```bash
bunx @better-auth/cli generate --config apps/worker/src/middleware/context.ts
```

Review output — should add `device_code` table. Then:

```bash
bun db:generate
bun db:migrate
```

- [ ] **Step 5: Run `bun run test`**

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(auth): add bearer and deviceAuthorization plugins to better-auth"
```

---

### Task 2: Delete custom MCP auth code + tables

Since `mcp_auth_code` and `mcp_token` were created on this branch and never merged to main, just delete everything and reset.

**Files:**

- Delete: `apps/worker/src/routes/mcp-auth-router.ts`
- Delete: `apps/worker/src/lib/mcp-tokens.ts`
- Delete: `apps/worker/src/db/schema/mcp-schema.ts`
- Delete: `apps/worker/src/middleware/mcp-auth.ts`
- Modify: `apps/worker/src/index.ts` — remove `mcpAuthRouter` import and `.route("/api/mcp-auth", mcpAuthRouter)`
- Modify: `apps/worker/src/db/schema/index.ts` — remove `export * from "./mcp-schema"`
- Modify: `apps/worker/src/routes/mcp-router.ts` — update to use better-auth session instead of custom middleware

- [ ] **Step 1: Remove `mcp-auth-router` route from `index.ts`**

Remove the import and `.route("/api/mcp-auth", mcpAuthRouter)` line.

- [ ] **Step 2: Delete files**

```bash
rm apps/worker/src/routes/mcp-auth-router.ts
rm apps/worker/src/lib/mcp-tokens.ts
rm apps/worker/src/db/schema/mcp-schema.ts
rm apps/worker/src/middleware/mcp-auth.ts
```

- [ ] **Step 3: Remove `mcp-schema` export from `schema/index.ts`**

- [ ] **Step 4: Update `mcp-router.ts` auth**

Replace `mcpAuthMiddleware` usage with better-auth session resolution:

```typescript
const session = await c.get("betterAuth").api.getSession({
	headers: c.req.raw.headers,
});
```

The bearer plugin handles `Authorization: Bearer <token>` → session automatically.

Set `c.set("authentication", { user: session.user, session: session.session })` from the returned data, maintaining `AuthType` shape.

No `scbr_` prefix check — bearer plugin handles any valid session token.

- [ ] **Step 5: Generate migration to drop custom tables**

```bash
bun db:generate
bun db:reset
```

- [ ] **Step 6: Run `bun oxc && bun typecheck && bun run test`**

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "refactor(mcp): remove custom auth, use better-auth bearer sessions"
```

---

### Task 3: Rewrite MCP CLI auth to use device flow

Follow archive pattern closely (`~/Downloads/Archive/cli/src/commands/auth-login.ts` and `~/Downloads/Archive/cli/src/credentials.ts`).

**Files:**

- Rewrite: `packages/mcp/src/auth.ts`
- Modify: `packages/mcp/src/config.ts`

- [ ] **Step 1: Rewrite `auth.ts`**

Replace local HTTP server + callback flow with better-auth client device flow:

```typescript
import { createAuthClient } from "better-auth/client";
import { deviceAuthorizationClient } from "better-auth/client/plugins";
import { loadConfig, saveConfig } from "./config.js";

const authClient = createAuthClient({
	baseURL: loadConfig().apiBaseUrl,
	plugins: [deviceAuthorizationClient()],
});

export async function runLoginFlow(): Promise<void> {
	const { data, error } = await authClient.device.code({
		client_id: "scorebrawl-mcp",
		scope: "openid",
	});

	if (error || !data) {
		console.error(
			"Failed to start device flow:",
			error?.error_description ?? error?.error ?? "unknown"
		);
		process.exit(1);
	}

	const {
		device_code,
		user_code,
		verification_uri,
		verification_uri_complete,
		interval = 5,
	} = data;
	const urlToOpen = verification_uri_complete ?? `${verification_uri}?user_code=${user_code}`;

	console.log(`\nOpen this URL in your browser:\n  ${urlToOpen}`);
	console.log(`\nOr visit: ${verification_uri}`);
	console.log(`And enter code: ${user_code}\n`);

	// Open browser
	const opener = process.platform === "darwin" ? "open" : "xdg-open";
	try {
		const { execFileSync } = await import("node:child_process");
		execFileSync(opener, [urlToOpen], { stdio: "ignore" });
	} catch {
		/* ignore */
	}

	console.log("Waiting for authorization...");
	await pollForToken(device_code, interval);
}
```

Include `pollForToken` from archive pattern — polls `authClient.device.token()`, handles `authorization_pending`, `slow_down`, `expired_token`, `access_denied`.

On success: `saveConfig({ accessToken: data.access_token })`.

- [ ] **Step 2: Update `getToken` / `setToken` / `deleteToken`**

Change config field from `sessionToken` to `accessToken`:

```typescript
export async function getToken(): Promise<string | null> {
	const config = loadConfig();
	return (config as any).accessToken ?? null;
}

export async function setToken(token: string): Promise<void> {
	saveConfig({ accessToken: token } as any);
}

export async function deleteToken(): Promise<void> {
	saveConfig({ accessToken: undefined } as any);
}
```

- [ ] **Step 3: Update `config.ts`**

Add `accessToken` to `MCPConfig` interface:

```typescript
export interface MCPConfig {
	apiBaseUrl: string;
	accessToken?: string;
}
```

- [ ] **Step 4: Remove `open` dependency if present, remove local HTTP server imports**

The archive uses `execFileSync` with `open`/`xdg-open` instead of the `open` npm package. Remove `import("open")` usage.

- [ ] **Step 5: Build**

```bash
bun run build --filter @scorebrawl/mcp
```

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(mcp): rewrite CLI auth to use better-auth device flow"
```

---

### Task 4: Create `/device` verification page (frontend)

**Files:**

- Create: `apps/web/src/routes/device/index.tsx`

Reference: `~/Downloads/Archive/core/src/device-page.tsx` for flow, but use React + shadcn + Tailwind.

The `/device/approve` endpoint requires an authenticated session (cookie-based). The page must:

1. Read `user_code` from URL search params
2. Check if user is already logged in (use `authClient.useSession()`)
3. If not logged in → show login form (email + password), call `authClient.signIn.email()`
4. Once logged in → call `GET /api/auth/device?user_code=<CODE>` to verify code is valid
5. Show org picker — let user choose which league to scope the MCP session to
6. Call organization `setActive` endpoint to set the selected org on the session
7. Show approve button → call `POST /api/auth/device/approve` with `{ userCode }`
8. Show success message: "Device authorized! You can close this tab."

- [ ] **Step 1: Create route directory and file**

```bash
mkdir -p apps/web/src/routes/device
```

Build the component with:

- `authClient.useSession()` to check auth state
- Login form with email/password fields
- Org picker (fetch user's orgs via tRPC or auth client)
- Approve button
- Success state

- [ ] **Step 2: Run `bun dev` to generate route types**

- [ ] **Step 3: Verify page renders at `http://scorebrawl.localhost:1355/device?user_code=test`**

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(web): add /device page for MCP device authorization"
```

---

### Task 5: Update tests

**Files:**

- Delete: `apps/worker/src/test/lib/mcp-tokens.spec.ts`
- Modify: any test files referencing `scbr_` tokens or `/api/mcp-auth`

- [ ] **Step 1: Find all MCP test files**

```bash
rg -l "mcp\|scbr_" apps/worker/src/test/
```

- [ ] **Step 2: Delete `mcp-tokens.spec.ts`**

Tests `generateToken`, `generateAuthCode`, `hashToken` — all deleted utilities.

- [ ] **Step 3: Add integration test for MCP with bearer token**

Create test that:

1. Creates a session via test helper
2. Uses session token as bearer token
3. Calls `/api/mcp` with `tools/list`
4. Verifies response

- [ ] **Step 4: Run `bun run test`**

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "test(mcp): update tests for better-auth device flow"
```

---

### Task 6: End-to-end verification

- [ ] **Step 1: Start dev server — `bun dev`**

- [ ] **Step 2: Test device flow manually**

From MCP package directory:

```bash
node dist/index.js login
```

Verify:

1. CLI displays user code + verification URL
2. Browser opens to `/device?user_code=XXXX`
3. Login form works (use `seed@scorebrawl.com`)
4. Org picker shows user's leagues
5. Approve button grants access
6. CLI receives token and saves it to `~/.config/scorebrawl/mcp.json`

- [ ] **Step 3: Test MCP tools work**

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node dist/index.js
```

- [ ] **Step 4: Run full check**

```bash
bun check && bun run test
```

- [ ] **Step 5: Commit any final fixes**
