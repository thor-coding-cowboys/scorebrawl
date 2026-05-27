import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { and, eq, gt, isNull } from "drizzle-orm";

import { HTTPException } from "hono/http-exception";
import type { HonoEnv } from "../middleware/context";
import { enforceAuthMiddleware } from "../middleware/auth";
import { mcpAuthCode, mcpToken } from "../db/schema/mcp-schema";
import { generateAuthCode, generateToken, hashToken } from "../lib/mcp-tokens";
import { createId } from "../utils/id-util";

const AUTH_CODE_TTL_MS = 5 * 60 * 1000;
const TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000;

const authorizeSchema = z.object({
	organizationId: z.string().optional(),
});

const exchangeSchema = z.object({
	code: z.string().min(1),
});

export const mcpAuthRouter = new Hono<HonoEnv>()
	.post("/authorize", enforceAuthMiddleware, zValidator("json", authorizeSchema), async (c) => {
		const db = c.get("db");
		const auth = c.get("authentication");
		const { organizationId: bodyOrgId } = c.req.valid("json");
		const organizationId = bodyOrgId ?? auth.session.activeOrganizationId;
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
	.post("/exchange", zValidator("json", exchangeSchema), async (c) => {
		const db = c.get("db");
		const { code } = c.req.valid("json");

		const now = new Date();
		const [consumed] = await db
			.update(mcpAuthCode)
			.set({ consumedAt: now })
			.where(
				and(
					eq(mcpAuthCode.code, code),
					isNull(mcpAuthCode.consumedAt),
					gt(mcpAuthCode.expiresAt, now)
				)
			)
			.returning({
				userId: mcpAuthCode.userId,
				organizationId: mcpAuthCode.organizationId,
			});

		if (!consumed) {
			throw new HTTPException(400, { message: "Invalid or expired code." });
		}

		const token = generateToken();
		const tokenHash = await hashToken(token);
		await db.insert(mcpToken).values({
			id: createId(),
			tokenHash,
			userId: consumed.userId,
			organizationId: consumed.organizationId,
			expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
		});

		return c.json({ token, organizationId: consumed.organizationId });
	});
