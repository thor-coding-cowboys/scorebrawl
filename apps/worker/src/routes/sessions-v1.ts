import { Hono } from "hono";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { HonoEnv } from "../middleware/context";
import { requireApiKeyScope } from "./api-key-auth";
import {
	startSession,
	endSession,
	startNextMatch,
	logMatch,
	setLineup,
	updateLiveScore,
	cancelMatch,
	type SessionActionContext,
} from "../services/session/session-actions";

const startSchema = z.object({
	seasonSlug: z.string().min(1),
	teamSize: z.number().int().min(1).max(6).optional(),
	rotationMode: z.enum(["winner-stays", "manual"]).optional(),
});
const startMatchSchema = z.object({
	home: z.array(z.string()).optional(),
	away: z.array(z.string()).optional(),
});
const logSchema = z.object({ home: z.number().int().min(0), away: z.number().int().min(0) });
const lineupSchema = z.object({ home: z.array(z.string()), away: z.array(z.string()) });

function mapError(error: unknown): HTTPException {
	if (error instanceof HTTPException) return error;
	if (error instanceof TRPCError) {
		const codes: Record<string, 400 | 401 | 403 | 404 | 409 | 500> = {
			BAD_REQUEST: 400,
			UNAUTHORIZED: 401,
			FORBIDDEN: 403,
			NOT_FOUND: 404,
			CONFLICT: 409,
			INTERNAL_SERVER_ERROR: 500,
		};
		return new HTTPException(codes[error.code] ?? 400, { message: error.message });
	}
	console.error("[sessions-v1]", error);
	return new HTTPException(500, { message: "Internal server error" });
}

function actionCtx(c: Context<HonoEnv>): SessionActionContext {
	const apiKey = c.get("apiKey");
	if (!apiKey) throw new HTTPException(401, { message: "Invalid API key" });
	return {
		db: c.get("db"),
		env: c.env,
		organization: apiKey.organization,
		user: { id: apiKey.userId, name: apiKey.keyName },
		waitUntil: c.executionCtx.waitUntil.bind(c.executionCtx),
	};
}

function leagueId(c: Context<HonoEnv>): string {
	const apiKey = c.get("apiKey");
	if (!apiKey) throw new HTTPException(401, { message: "Invalid API key" });
	return apiKey.organizationId;
}

export const sessionsV1Router = new Hono<HonoEnv>();

sessionsV1Router.post(
	"/",
	requireApiKeyScope({ session: ["start"] }),
	zValidator("json", startSchema),
	async (c) => {
		try {
			const session = await startSession(actionCtx(c), c.req.valid("json"));
			return c.json({ session }, 201);
		} catch (error) {
			throw mapError(error);
		}
	}
);

sessionsV1Router.post("/active/end", requireApiKeyScope({ session: ["stop"] }), async (c) => {
	try {
		const session = await endSession(actionCtx(c), leagueId(c));
		return c.json({ session });
	} catch (error) {
		throw mapError(error);
	}
});

sessionsV1Router.post(
	"/active/match/start",
	requireApiKeyScope({ match: ["start"] }),
	zValidator("json", startMatchSchema),
	async (c) => {
		try {
			const match = await startNextMatch(actionCtx(c), leagueId(c), c.req.valid("json"));
			return c.json({ match }, 201);
		} catch (error) {
			throw mapError(error);
		}
	}
);

sessionsV1Router.post(
	"/active/match/log",
	requireApiKeyScope({ match: ["log"] }),
	zValidator("json", logSchema),
	async (c) => {
		try {
			const result = await logMatch(actionCtx(c), leagueId(c), c.req.valid("json"));
			return c.json(result);
		} catch (error) {
			throw mapError(error);
		}
	}
);

sessionsV1Router.put(
	"/active/match/lineup",
	requireApiKeyScope({ match: ["lineup"] }),
	zValidator("json", lineupSchema),
	async (c) => {
		try {
			const teamSelection = await setLineup(actionCtx(c), leagueId(c), c.req.valid("json"));
			return c.json({ teamSelection });
		} catch (error) {
			throw mapError(error);
		}
	}
);

sessionsV1Router.put(
	"/active/match/score",
	requireApiKeyScope({ match: ["score"] }),
	zValidator("json", logSchema),
	async (c) => {
		try {
			const match = await updateLiveScore(actionCtx(c), leagueId(c), c.req.valid("json"));
			return c.json({ match });
		} catch (error) {
			throw mapError(error);
		}
	}
);

sessionsV1Router.delete("/active/match", requireApiKeyScope({ match: ["cancel"] }), async (c) => {
	try {
		const result = await cancelMatch(actionCtx(c), leagueId(c));
		return c.json(result);
	} catch (error) {
		throw mapError(error);
	}
});
