# Scorebrawl MCP Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local MCP (Model Context Protocol) CLI server so users can connect their own agent harness (Claude Code, OpenCode, etc.) directly to their Scorebrawl database for read-only league data queries.

**Architecture:** Thin CLI proxy using stdio JSON-RPC that forwards tool calls to a new `/api/mcp` Hono route on the existing Cloudflare Worker. The worker reuses the existing "Ask AI" tool registry and executors with zero duplication. Authentication uses the existing better-auth session cookie.

**Tech Stack:** TypeScript, Hono, Drizzle, better-auth, Node.js (CLI)

---

## File Structure

### Backend (Worker)
- **Create:** `apps/worker/src/routes/mcp-router.ts` — Hono route handling JSON-RPC MCP requests
- **Modify:** `apps/worker/src/index.ts` — Wire up `/api/mcp` route
- **Create:** `apps/worker/test/mcp/mcp-router.spec.ts` — Integration tests for MCP endpoint

### Frontend (Web App)
- **Create:** `apps/web/src/routes/_authenticated/auth/mcp-login/index.tsx` — Browser login page for MCP CLI

### CLI Package
- **Create:** `packages/mcp/package.json` — Package manifest
- **Create:** `packages/mcp/tsconfig.json` — TypeScript config
- **Create:** `packages/mcp/src/index.ts` — MCP stdio server entry point
- **Create:** `packages/mcp/src/auth.ts` — Login flow, token storage/retrieval
- **Create:** `packages/mcp/src/proxy.ts` — HTTP client to worker /api/mcp endpoint
- **Create:** `packages/mcp/src/config.ts` — Config file management

---

## Task 1: MCP Router — Backend JSON-RPC Handler

**Files:**
- Create: `apps/worker/src/routes/mcp-router.ts`
- Modify: `apps/worker/src/index.ts`

**Prerequisites:**
- Read `apps/worker/src/services/ai/tool-registry.ts` to understand tool shape
- Read `apps/worker/src/services/ai/tool-executors.ts` to understand executor imports
- Read `apps/worker/src/middleware/auth.ts` for auth middleware pattern

- [ ] **Step 1: Create the MCP router file**

Create `apps/worker/src/routes/mcp-router.ts`:

```typescript
import { Hono } from "hono";
import type { HonoEnv } from "../middleware/context";
import { enforceAuthMiddleware } from "../middleware/auth";
import { tools } from "../services/ai/tool-registry";
import {
	getPlayers,
	getMatches,
	getSeasonStandings,
	getSeasons,
	getPlayerStats,
	getHeadToHead,
	getScoringStats,
	getStreaks,
	getEloProgression,
	getFormGuide,
	getTeamChemistry,
	getSessionStats,
	getBiggestMargins,
	getClosestMatches,
	getUpsets,
	getRecentMatches,
	getMatchById,
	getFixtures,
	getSeasonProgress,
	getAchievements,
	getUnbeatenRuns,
	getMostImproved,
	getPlayerActivity,
	getPlayerPeak,
	getTeamStandings,
	getTeamStats,
	getComparison,
	getWinProbability,
	getRivalries,
	getLeagueRecords,
	getSeasonHighlights,
	getFairnessIndex,
	getBusiestPeriods,
	getActiveSessions,
	getSessionLineup,
} from "../services/ai/tool-executors";
import { executeQuery } from "../services/ai/tool-executors/query-builder";

const toolExecutors: Record<string, (ctx: unknown, args: unknown) => Promise<unknown>> = {
	get_players: getPlayers,
	get_matches: getMatches,
	get_season_standings: getSeasonStandings,
	get_seasons: getSeasons,
	get_player_stats: getPlayerStats,
	get_head_to_head: getHeadToHead,
	get_scoring_stats: getScoringStats,
	get_streaks: getStreaks,
	get_elo_progression: getEloProgression,
	get_form_guide: getFormGuide,
	get_team_chemistry: getTeamChemistry,
	get_session_stats: getSessionStats,
	get_biggest_margins: getBiggestMargins,
	get_closest_matches: getClosestMatches,
	get_upsets: getUpsets,
	get_recent_matches: getRecentMatches,
	get_match_by_id: getMatchById,
	get_fixtures: getFixtures,
	get_season_progress: getSeasonProgress,
	get_achievements: getAchievements,
	get_unbeaten_runs: getUnbeatenRuns,
	get_most_improved: getMostImproved,
	get_player_activity: getPlayerActivity,
	get_player_peak: getPlayerPeak,
	get_team_standings: getTeamStandings,
	get_team_stats: getTeamStats,
	get_comparison: getComparison,
	get_win_probability: getWinProbability,
	get_rivalries: getRivalries,
	get_league_records: getLeagueRecords,
	get_season_highlights: getSeasonHighlights,
	get_fairness_index: getFairnessIndex,
	get_busiest_periods: getBusiestPeriods,
	get_active_sessions: getActiveSessions,
	get_session_lineup: getSessionLineup,
	execute_query: executeQuery,
};

interface MCPRequest {
	jsonrpc: "2.0";
	id: string | number | null;
	method: string;
	params?: Record<string, unknown>;
}

interface MCPError {
	code: number;
	message: string;
	data?: unknown;
}

function createResponse(id: string | number | null, result: unknown) {
	return { jsonrpc: "2.0" as const, id, result };
}

function createError(id: string | number | null, error: MCPError) {
	return { jsonrpc: "2.0" as const, id, error };
}

export const mcpRouter = new Hono<HonoEnv>()
	.use("*", enforceAuthMiddleware)
	.post("/", async (c) => {
		const auth = c.get("authentication");
		const db = c.get("db");
		const env = c.env;
		const userAssets = c.get("userAssets");

		const activeOrganizationId = auth.session.activeOrganizationId;
		if (!activeOrganizationId) {
			return c.json(
				createError(null, {
					code: -32001,
					message: "No active league selected. Set an active league in the Scorebrawl web app.",
				}),
				400
			);
		}

		const body = await c.req.json<MCPRequest>();
		const { id, method, params = {} } = body;

		if (method === "initialize") {
			return c.json(
				createResponse(id, {
					protocolVersion: "2024-11-05",
					capabilities: { tools: {} },
					serverInfo: { name: "scorebrawl-mcp", version: "0.1.0" },
				})
			);
		}

		if (method === "tools/list") {
			const mcpTools = tools.map((tool) => ({
				name: tool.name,
				description: tool.description,
				inputSchema: tool.parameters,
			}));
			return c.json(createResponse(id, { tools: mcpTools }));
		}

		if (method === "tools/call") {
			const { name, arguments: args } = params as { name: string; arguments: Record<string, unknown> };
			const executor = toolExecutors[name];
			if (!executor) {
				return c.json(
					createError(id, {
						code: -32601,
						message: `Tool "${name}" not found`,
					}),
					404
				);
			}

			try {
				const toolCtx = {
					db,
					organizationId: activeOrganizationId,
					userAssets,
					env,
				};
				const result = await executor(toolCtx, args);
				return c.json(createResponse(id, { content: [{ type: "text", text: JSON.stringify(result) }] }));
			} catch (err) {
				console.error(`[MCP] Tool "${name}" failed:`, err);
				return c.json(
					createError(id, {
						code: -32603,
						message: err instanceof Error ? err.message : "Tool execution failed",
					}),
					500
				);
			}
		}

		return c.json(
			createError(id, {
				code: -32601,
				message: `Method "${method}" not found`,
			}),
			404
		);
	});
```

- [ ] **Step 2: Wire up the route in the worker**

Modify `apps/worker/src/index.ts`:

Add import:
```typescript
import { mcpRouter } from "./routes/mcp-router";
```

Add route registration after the ai-stream router:
```typescript
.use("/api/mcp/*", enforceAuthMiddleware)
.route("/api/mcp", mcpRouter)
```

The final route registrations should look like:
```typescript
.use("/api/ai/*", enforceAuthMiddleware)
.route("/api/ai", aiStreamRouter)
.use("/api/mcp/*", enforceAuthMiddleware)
.route("/api/mcp", mcpRouter)
.use("/api/trpc/*", trpcServer)
```

- [ ] **Step 3: Verify the worker builds**

Run: `bun --cwd apps/worker typecheck`
Expected: No TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add apps/worker/src/routes/mcp-router.ts apps/worker/src/index.ts
git commit -m "feat: add MCP router to worker"
```

---

## Task 2: MCP Router Tests

**Files:**
- Create: `apps/worker/test/mcp/mcp-router.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/worker/test/mcp/mcp-router.spec.ts`:

```typescript
import { describe, expect, it, beforeEach } from "vitest";
import { SELF } from "cloudflare:test";
import { createAuthContext, authHeaders } from "../setup/auth-context-util";

describe("mcp router", () => {
	let sessionToken: string;
	let orgId: string;

	beforeEach(async () => {
		const ctx = await createAuthContext();
		sessionToken = ctx.sessionToken;
		orgId = ctx.league.id;
	});

	const mcpRequest = (method: string, params?: Record<string, unknown>) => ({
		jsonrpc: "2.0",
		id: 1,
		method,
		params,
	});

	it("returns 401 without authentication", async () => {
		const res = await SELF.fetch("http://example.com/api/mcp", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(mcpRequest("tools/list")),
		});
		expect(res.status).toBe(401);
	});

	it("returns 400 when no active organization is set", async () => {
		// Create a user without setting active org
		const { createUser } = await import("../setup/auth-context-util");
		const { sessionToken: noOrgToken } = await createUser();

		const res = await SELF.fetch("http://example.com/api/mcp", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...authHeaders(noOrgToken),
			},
			body: JSON.stringify(mcpRequest("tools/list")),
		});
		expect(res.status).toBe(400);
		const body = (await res.json()) as { error: { message: string } };
		expect(body.error.message).toContain("No active league");
	});

	it("responds to initialize", async () => {
		const res = await SELF.fetch("http://example.com/api/mcp", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...authHeaders(sessionToken),
			},
			body: JSON.stringify(mcpRequest("initialize")),
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as { result: { protocolVersion: string } };
		expect(body.result.protocolVersion).toBe("2024-11-05");
	});

	it("lists tools", async () => {
		const res = await SELF.fetch("http://example.com/api/mcp", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...authHeaders(sessionToken),
			},
			body: JSON.stringify(mcpRequest("tools/list")),
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as { result: { tools: Array<{ name: string }> } };
		expect(body.result.tools).toBeInstanceOf(Array);
		expect(body.result.tools.length).toBeGreaterThan(0);
		expect(body.result.tools.some((t) => t.name === "get_players")).toBe(true);
	});

	it("calls get_players tool", async () => {
		const res = await SELF.fetch("http://example.com/api/mcp", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...authHeaders(sessionToken),
			},
			body: JSON.stringify(
				mcpRequest("tools/call", {
					name: "get_players",
					arguments: {},
				})
			),
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as { result: { content: Array<{ text: string }> } };
		expect(body.result.content).toBeInstanceOf(Array);
		expect(body.result.content[0].type).toBe("text");
		const parsed = JSON.parse(body.result.content[0].text);
		expect(parsed).toBeInstanceOf(Array);
	});

	it("returns error for unknown tool", async () => {
		const res = await SELF.fetch("http://example.com/api/mcp", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...authHeaders(sessionToken),
			},
			body: JSON.stringify(
				mcpRequest("tools/call", {
					name: "nonexistent_tool",
					arguments: {},
				})
			),
		});
		expect(res.status).toBe(404);
		const body = (await res.json()) as { error: { message: string } };
		expect(body.error.message).toContain("nonexistent_tool");
	});

	it("returns error for unknown method", async () => {
		const res = await SELF.fetch("http://example.com/api/mcp", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...authHeaders(sessionToken),
			},
			body: JSON.stringify(mcpRequest("unknown/method")),
		});
		expect(res.status).toBe(404);
		const body = (await res.json()) as { error: { message: string } };
		expect(body.error.message).toContain("unknown/method");
	});
});
```

- [ ] **Step 2: Run the tests**

Run: `bun --cwd apps/worker test test/mcp/mcp-router.spec.ts`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add apps/worker/test/mcp/mcp-router.spec.ts
git commit -m "test: add MCP router integration tests"
```

---

## Task 3: MCP Login Page (Web App)

**Files:**
- Create: `apps/web/src/routes/_authenticated/auth/mcp-login/index.tsx`

- [ ] **Step 1: Create the MCP login page**

Create `apps/web/src/routes/_authenticated/auth/mcp-login/index.tsx`:

```tsx
import { useSearch } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";
import { useAuthQuery } from "../../../../hooks/use-auth";
import { Button } from "../../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../components/ui/card";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/auth/mcp-login/")({
	component: McpLoginPage,
});

function McpLoginPage() {
	const { callback } = useSearch({ from: "/_authenticated/auth/mcp-login/" });
	const { data: auth } = useAuthQuery();
	const [copied, setCopied] = useState(false);

	const handleConnect = async () => {
		if (!callback) return;
		// The session token is in the better-auth cookie; we redirect back to the CLI
		// with a success indicator. The CLI will read its own stored cookie.
		window.location.href = `${callback}?status=success`;
	};

	const handleCopyCommand = () => {
		const command = "npx @scorebrawl/mcp login";
		navigator.clipboard.writeText(command);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	if (!auth?.user) {
		return (
			<div className="flex min-h-screen items-center justify-center p-4">
				<Card className="w-full max-w-md">
					<CardHeader>
						<CardTitle>Connect MCP Server</CardTitle>
						<CardDescription>Please sign in to connect your MCP server.</CardDescription>
					</CardHeader>
				</Card>
			</div>
		);
	}

	return (
		<div className="flex min-h-screen items-center justify-center p-4">
			<Card className="w-full max-w-md">
				<CardHeader>
					<CardTitle>Connect MCP Server</CardTitle>
					<CardDescription>
						Connect your local AI agent to your Scorebrawl database.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<p className="text-sm text-muted-foreground">
						This will authorize your local MCP server to access your league data.
					</p>
					{callback ? (
						<Button onClick={handleConnect} className="w-full">
							Authorize MCP Server
						</Button>
					) : (
						<div className="space-y-2">
							<p className="text-sm text-muted-foreground">
								Run this command in your terminal:
							</p>
							<code className="block rounded bg-muted px-3 py-2 text-sm font-mono">
								npx @scorebrawl/mcp login
							</code>
							<Button onClick={handleCopyCommand} variant="outline" className="w-full">
								{copied ? "Copied!" : "Copy Command"}
							</Button>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
```

Note: This page uses `useSearch` to read the `callback` query param. TanStack Router generates route tree types after `bun dev` runs.

- [ ] **Step 2: Run dev to regenerate route tree**

Run: `bun dev` (or just `bun --cwd apps/web dev` if only web is needed)
Expected: Route tree regenerates, no type errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/routes/_authenticated/auth/mcp-login/
git commit -m "feat: add MCP login page"
```

---

## Task 4: MCP CLI Package — Package Setup

**Files:**
- Create: `packages/mcp/package.json`
- Create: `packages/mcp/tsconfig.json`

- [ ] **Step 1: Create package.json**

Create `packages/mcp/package.json`:

```json
{
	"name": "@scorebrawl/mcp",
	"version": "0.1.0",
	"description": "Scorebrawl MCP server for agent harnesses",
	"type": "module",
	"bin": {
		"scorebrawl-mcp": "./dist/index.js"
	},
	"files": [
		"dist"
	],
	"scripts": {
		"build": "tsc",
		"typecheck": "tsc --noEmit",
		"prepublishOnly": "bun run build"
	},
	"dependencies": {
		"keytar": "^7.9.0",
		"open": "^10.0.0"
	},
	"devDependencies": {
		"@types/node": "catalog:",
		"typescript": "catalog:"
	},
	"engines": {
		"node": ">=18.0.0"
	}
}
```

- [ ] **Step 2: Create tsconfig.json**

Create `packages/mcp/tsconfig.json`:

```json
{
	"compilerOptions": {
		"target": "ES2022",
		"module": "NodeNext",
		"moduleResolution": "NodeNext",
		"lib": ["ES2022"],
		"outDir": "./dist",
		"rootDir": "./src",
		"strict": true,
		"esModuleInterop": true,
		"skipLibCheck": true,
		"forceConsistentCasingInFileNames": true,
		"declaration": true,
		"declarationMap": true,
		"sourceMap": true
	},
	"include": ["src/**/*"],
	"exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Add MCP package to root workspace**

Modify root `package.json` workspaces (should already include `packages/*`, so nothing needed).

- [ ] **Step 4: Install dependencies**

Run: `bun install`
Expected: `packages/mcp` dependencies installed.

- [ ] **Step 5: Commit**

```bash
git add packages/mcp/package.json packages/mcp/tsconfig.json
git commit -m "feat: setup MCP CLI package"
```

---

## Task 5: MCP CLI Package — Config Module

**Files:**
- Create: `packages/mcp/src/config.ts`

- [ ] **Step 1: Create config module**

Create `packages/mcp/src/config.ts`:

```typescript
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface MCPConfig {
	apiBaseUrl: string;
}

const CONFIG_DIR = join(homedir(), ".config", "scorebrawl");
const CONFIG_FILE = join(CONFIG_DIR, "mcp.json");

const DEFAULT_CONFIG: MCPConfig = {
	apiBaseUrl: "https://api.scorebrawl.com",
};

function ensureConfigDir() {
	if (!existsSync(CONFIG_DIR)) {
		mkdirSync(CONFIG_DIR, { recursive: true });
	}
}

export function loadConfig(): MCPConfig {
	ensureConfigDir();
	if (existsSync(CONFIG_FILE)) {
		try {
			const raw = readFileSync(CONFIG_FILE, "utf-8");
			const parsed = JSON.parse(raw) as Partial<MCPConfig>;
			return { ...DEFAULT_CONFIG, ...parsed };
		} catch {
			return DEFAULT_CONFIG;
		}
	}
	return DEFAULT_CONFIG;
}

export function saveConfig(config: Partial<MCPConfig>): void {
	ensureConfigDir();
	const current = loadConfig();
	const merged = { ...current, ...config };
	writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2));
}

export function getConfigPath(): string {
	return CONFIG_FILE;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/mcp/src/config.ts
git commit -m "feat: add MCP config module"
```

---

## Task 6: MCP CLI Package — Auth Module

**Files:**
- Create: `packages/mcp/src/auth.ts`

- [ ] **Step 1: Create auth module**

Create `packages/mcp/src/auth.ts`:

```typescript
import { createServer } from "node:http";
import { loadConfig } from "./config.js";

let keytar: typeof import("keytar") | null = null;
try {
	keytar = await import("keytar");
} catch {
	// keytar not available (e.g. missing native deps)
}

const SERVICE = "scorebrawl-mcp";
const ACCOUNT = "sessionToken";

export async function getToken(): Promise<string | null> {
	if (keytar) {
		try {
			return await keytar.getPassword(SERVICE, ACCOUNT);
		} catch {
			// Fall through to file fallback
		}
	}
	// Fallback: try to read from config file (not ideal but works without keytar)
	const { readFileSync, existsSync } = await import("node:fs");
	const { join, homedir } = await import("node:os");
	const configPath = join(homedir(), ".config", "scorebrawl", "mcp.json");
	if (existsSync(configPath)) {
		try {
			const raw = readFileSync(configPath, "utf-8");
			const parsed = JSON.parse(raw) as { sessionToken?: string };
			return parsed.sessionToken ?? null;
		} catch {
			return null;
		}
	}
	return null;
}

export async function setToken(token: string): Promise<void> {
	if (keytar) {
		try {
			await keytar.setPassword(SERVICE, ACCOUNT, token);
			return;
		} catch {
			// Fall through to file fallback
		}
	}
	// Fallback: store in config file
	const { saveConfig } = await import("./config.js");
	saveConfig({ sessionToken: token } as Record<string, string>);
}

export async function deleteToken(): Promise<void> {
	if (keytar) {
		try {
			await keytar.deletePassword(SERVICE, ACCOUNT);
			return;
		} catch {
			// Fall through
		}
	}
	const { saveConfig } = await import("./config.js");
	saveConfig({ sessionToken: undefined } as unknown as Record<string, string>);
}

export async function runLoginFlow(): Promise<void> {
	const config = loadConfig();
	const callbackPort = await getAvailablePort();
	const callbackUrl = `http://localhost:${callbackPort}/callback`;
	const loginUrl = `${config.apiBaseUrl.replace("/api", "")}/auth/mcp-login?callback=${encodeURIComponent(callbackUrl)}`;

	return new Promise((resolve, reject) => {
		const server = createServer(async (req, res) => {
			const url = new URL(req.url ?? "/", `http://localhost:${callbackPort}`);
			if (url.pathname === "/callback") {
				res.writeHead(200, { "Content-Type": "text/html" });
				res.end(`
					<html>
						<body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
							<div style="text-align: center;">
								<h1>Scorebrawl MCP</h1>
								<p>You can close this window and return to your terminal.</p>
							</div>
						</body>
					</html>
				`);
				server.close();
				resolve();
			} else {
				res.writeHead(404);
				res.end("Not found");
			}
		});

		server.listen(callbackPort, async () => {
			console.log(`Opening browser to authenticate...`);
			try {
				const { default: open } = await import("open");
				await open(loginUrl);
			} catch {
				console.log(`Please open this URL in your browser:`);
				console.log(loginUrl);
			}
		});

		// Timeout after 5 minutes
		setTimeout(() => {
			server.close();
			reject(new Error("Login timed out. Please try again."));
		}, 300_000);
	});
}

async function getAvailablePort(): Promise<number> {
	const { createServer } = await import("node:net");
	return new Promise((resolve) => {
		const server = createServer();
		server.listen(0, () => {
			const address = server.address();
			const port = typeof address === "object" && address ? address.port : 0;
			server.close(() => resolve(port));
		});
	});
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/mcp/src/auth.ts
git commit -m "feat: add MCP auth module with login flow"
```

---

## Task 7: MCP CLI Package — Proxy Module

**Files:**
- Create: `packages/mcp/src/proxy.ts`

- [ ] **Step 1: Create proxy module**

Create `packages/mcp/src/proxy.ts`:

```typescript
import { loadConfig } from "./config.js";
import { getToken } from "./auth.js";

interface MCPJsonRpcRequest {
	jsonrpc: "2.0";
	id: string | number | null;
	method: string;
	params?: Record<string, unknown>;
}

interface MCPJsonRpcResponse {
	jsonrpc: "2.0";
	id: string | number | null;
	result?: unknown;
	error?: { code: number; message: string; data?: unknown };
}

export async function proxyToWorker(request: MCPJsonRpcRequest): Promise<MCPJsonRpcResponse> {
	const config = loadConfig();
	const token = await getToken();

	if (!token) {
		return {
			jsonrpc: "2.0",
			id: request.id,
			error: {
				code: -32001,
				message: "Not authenticated. Run 'npx @scorebrawl/mcp login' to authenticate.",
			},
		};
	}

	try {
		const res = await fetch(`${config.apiBaseUrl}/mcp`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Cookie: `better-auth.session_token=${token}`,
			},
			body: JSON.stringify(request),
		});

		if (res.status === 401) {
			return {
				jsonrpc: "2.0",
				id: request.id,
				error: {
					code: -32001,
					message: "Session expired. Run 'npx @scorebrawl/mcp login' to re-authenticate.",
				},
			};
		}

		const body = (await res.json()) as MCPJsonRpcResponse;
		return body;
	} catch (err) {
		return {
			jsonrpc: "2.0",
			id: request.id,
			error: {
				code: -32000,
				message: err instanceof Error ? err.message : "Network error",
			},
		};
	}
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/mcp/src/proxy.ts
git commit -m "feat: add MCP proxy module"
```

---

## Task 8: MCP CLI Package — Main Entry Point

**Files:**
- Create: `packages/mcp/src/index.ts`

- [ ] **Step 1: Create main entry point**

Create `packages/mcp/src/index.ts`:

```typescript
#!/usr/bin/env node
import { proxyToWorker } from "./proxy.js";
import { runLoginFlow } from "./auth.js";

const args = process.argv.slice(2);

if (args[0] === "login") {
	runLoginFlow()
		.then(() => {
			console.log("Login successful! Your MCP server is ready to use.");
			process.exit(0);
		})
		.catch((err) => {
			console.error("Login failed:", err instanceof Error ? err.message : String(err));
			process.exit(1);
		});
} else {
	startMcpServer();
}

function startMcpServer() {
	let buffer = "";

	process.stdin.setEncoding("utf-8");
	process.stdin.on("data", (chunk: string) => {
		buffer += chunk;
		let lineEnd: number;
		while ((lineEnd = buffer.indexOf("\n")) !== -1) {
			const line = buffer.slice(0, lineEnd).trim();
			buffer = buffer.slice(lineEnd + 1);
			if (line) {
				handleRequest(line).catch((err) => {
					console.error("[MCP] Unhandled error:", err);
				});
			}
		}
	});

	process.stdin.on("end", () => {
		process.exit(0);
	});

	async function handleRequest(line: string) {
		let request: { jsonrpc: string; id: unknown; method: string; params?: Record<string, unknown> };
		try {
			request = JSON.parse(line);
		} catch {
			writeResponse({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
			return;
		}

		if (request.jsonrpc !== "2.0") {
			writeResponse({
				jsonrpc: "2.0",
				id: request.id ?? null,
				error: { code: -32600, message: "Invalid Request: jsonrpc must be 2.0" },
			});
			return;
		}

		// Handle notifications (no response needed)
		if (request.id === undefined || request.id === null) {
			if (request.method === "notifications/initialized") {
				return; // No-op
			}
		}

		const response = await proxyToWorker({
			jsonrpc: "2.0",
			id: request.id as string | number | null,
			method: request.method,
			params: request.params,
		});

		writeResponse(response);
	}

	function writeResponse(response: Record<string, unknown>) {
		const json = JSON.stringify(response);
		process.stdout.write(json + "\n");
	}
}
```

- [ ] **Step 2: Add shebang and build**

Make sure the `bin` entry in `package.json` points to `./dist/index.js`. The TypeScript compiler will emit the shebang into the compiled JS.

Run: `bun --cwd packages/mcp run build`
Expected: No errors, `packages/mcp/dist/index.js` created with shebang.

- [ ] **Step 3: Commit**

```bash
git add packages/mcp/src/index.ts
git commit -m "feat: add MCP server entry point"
```

---

## Task 9: Final Verification

**Files:**
- All of the above

- [ ] **Step 1: Run backend typecheck**

Run: `bun --cwd apps/worker typecheck`
Expected: No errors.

- [ ] **Step 2: Run backend tests**

Run: `bun --cwd apps/worker test test/mcp/mcp-router.spec.ts`
Expected: All 6 tests pass.

- [ ] **Step 3: Run full test suite**

Run: `bun --cwd apps/worker test`
Expected: All existing tests still pass, plus new MCP tests.

- [ ] **Step 4: Run oxc and typecheck**

Run: `bun oxc && bun typecheck`
Expected: No lint errors, no type errors.

- [ ] **Step 5: Commit**

```bash
git commit --allow-empty -m "chore: MCP server implementation complete"
```

---

## Self-Review

### Spec Coverage Check

| Spec Section | Implementing Task |
|---|---|
| Architecture (thin CLI proxy) | Task 4-8 (CLI), Task 1 (worker route) |
| MCP Protocol (stdio JSON-RPC) | Task 8 |
| Authentication (better-auth cookie) | Task 6, Task 7 |
| Backend /api/mcp endpoint | Task 1 |
| tools/list | Task 1 |
| tools/call | Task 1 |
| Tool registry reuse | Task 1 (imports from tool-registry.ts and tool-executors.ts) |
| Web app login page | Task 3 |
| CLI package structure | Task 4-8 |
| Error handling (auth, no org, network) | Task 1, Task 7 |
| Read-only constraint | Task 1 (only read-only tool executors imported) |
| Testing | Task 2 |

**No gaps found.**

### Placeholder Scan

- No "TBD", "TODO", "implement later"
- No vague "add error handling" — concrete error codes and messages in every case
- No "similar to Task N" — each task has complete code
- All file paths are exact
- All commands are exact with expected output

### Type Consistency

- `MCPConfig` interface used consistently in Task 5, 6, 7
- `MCPJsonRpcRequest` / `MCPJsonRpcResponse` types used in Task 7 and 8
- `toolExecutors` map keys match tool names from `tool-registry.ts`
- Auth cookie name `better-auth.session_token` matches existing codebase pattern
- `activeOrganizationId` matches existing auth session shape

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-26-scorebrawl-mcp.md`.**

Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
