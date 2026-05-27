import { Hono } from "hono";
import { and, eq, gt, isNull } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type { HonoEnv } from "../middleware/context";
import { enforceAuthMiddleware } from "../middleware/auth";
import { mcpAuthCode, mcpToken } from "../db/schema/mcp-schema";
import { generateAuthCode, generateToken, hashToken } from "../lib/mcp-tokens";
import { createId } from "../utils/id-util";

const AUTH_CODE_TTL_MS = 5 * 60 * 1000;

export const mcpAuthRouter = new Hono<HonoEnv>()
	.post("/authorize", enforceAuthMiddleware, async (c) => {
		const db = c.get("db");
		const auth = c.get("authentication");
		const body = (await c.req.json().catch(() => ({}))) as { organizationId?: string };
		const organizationId = body.organizationId ?? auth.session.activeOrganizationId;
		if (!organizationId) {
			throw new HTTPException(400, { message: "No active league selected." });
		}

		const code = generateAuthCode();
		await db.insert(mcpAuthCode).values({
			code,
			userId: auth.user.id,
			organizationId,
			expiresAt: new Date(Date.now() + AUTH_CODE_TTL_MS),
		});

		return c.json({ code, organizationId });
	})
	.post("/exchange", async (c) => {
		const db = c.get("db");
		const { code } = (await c.req.json().catch(() => ({}))) as { code?: string };
		if (!code || typeof code !== "string") {
			throw new HTTPException(400, { message: "Missing code." });
		}

		const now = new Date();
		const [row] = await db
			.select()
			.from(mcpAuthCode)
			.where(
				and(
					eq(mcpAuthCode.code, code),
					isNull(mcpAuthCode.consumedAt),
					gt(mcpAuthCode.expiresAt, now)
				)
			)
			.limit(1);

		if (!row) {
			throw new HTTPException(400, { message: "Invalid or expired code." });
		}

		await db.update(mcpAuthCode).set({ consumedAt: now }).where(eq(mcpAuthCode.code, code));

		const token = generateToken();
		const tokenHash = await hashToken(token);
		await db.insert(mcpToken).values({
			id: createId(),
			tokenHash,
			userId: row.userId,
			organizationId: row.organizationId,
		});

		return c.json({ token, organizationId: row.organizationId });
	});
