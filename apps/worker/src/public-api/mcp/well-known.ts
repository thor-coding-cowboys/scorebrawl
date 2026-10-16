import { Hono } from "hono";
import { cors } from "hono/cors";
import type { HonoEnv } from "../../middleware/context";

/**
 * RFC 9728 protected-resource metadata (`/.well-known/oauth-protected-resource[/mcp]`)
 * and the RFC 8414 authorization-server aliases live outside `/api/auth`, so they
 * are forwarded to the Better Auth handler where the MCP plugin serves them. CORS
 * stays open so browser-based clients (MCP Inspector) can read discovery.
 */
export const mcpWellKnownRouter = new Hono<HonoEnv>()
	.use("*", cors({ origin: "*", allowMethods: ["GET", "HEAD", "OPTIONS"] }))
	.on(["GET", "HEAD"], "*", async (c) => c.get("betterAuth").handler(c.req.raw));
