import { getDb } from "../db";
import { createAuth } from "./better-auth";

/**
 * Config used only by `bun better-auth:generate`.
 *
 * The CLI derives the schema from the plugin definitions and needs to see the
 * drizzle adapter, so a placeholder D1 handle is enough. Loading this module
 * inits the plugins, and `mcp()` seeds its protected resource during init; that
 * seed fails harmlessly against the placeholder (a memory adapter is not an
 * option — the CLI's schema generator rejects `memory` as an adapter id). Keep
 * the plugin options in sync with `apps/worker/src/lib/better-auth.ts`.
 */
export const auth = createAuth({
	db: getDb(undefined as unknown as D1Database),
	betterAuthSecret: "",
	baseURL: "http://localhost",
	mcpResource: "http://localhost/mcp",
	oauthResource: "https://scorebrawl.com/api/v1",
});
