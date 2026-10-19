import { Hono } from "hono";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { describeRoute } from "hono-openapi";
import { zValidator } from "@hono/zod-validator";
import { TRPCError } from "@trpc/server";
import type { HonoEnv } from "../middleware/context";
import { requireApiKeyScope } from "./api-key-auth";
import {
	apiKeySecurity,
	apiResponses,
	jsonRequest,
	jsonResponse,
	respond,
} from "../public-api/openapi/responses";
import {
	cancelMatchResponseSchema,
	endSessionResponseSchema,
	lineupResponseSchema,
	logMatchResponseSchema,
	lineupSchema,
	scorePairRequestSchema,
	scoreResponseSchema,
	startMatchResponseSchema,
	startMatchSchema,
	startSchema,
	startSessionResponseSchema,
} from "../public-api/schemas/sessions";
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

export const sessionsV1Router = new Hono<HonoEnv>()
	.post(
		"/",
		describeRoute({
			summary: "Start a session",
			description: "Starts a session for a season. Requires a league API key with `session:start`.",
			tags: ["Sessions"],
			security: apiKeySecurity,
			requestBody: jsonRequest(startSchema),
			responses: apiResponses(
				{ 201: jsonResponse("The started session", startSessionResponseSchema) },
				{ auth: "league" }
			),
		}),
		requireApiKeyScope({ session: ["start"] }),
		zValidator("json", startSchema),
		async (c) => {
			try {
				const session = await startSession(actionCtx(c), c.req.valid("json"));
				return respond(c, startSessionResponseSchema, { session }, 201);
			} catch (error) {
				throw mapError(error);
			}
		}
	)
	.post(
		"/active/end",
		describeRoute({
			summary: "End the active session",
			description:
				"Ends the active session for the league. Requires a league API key with `session:stop`.",
			tags: ["Sessions"],
			security: apiKeySecurity,
			responses: apiResponses(
				{ 200: jsonResponse("The ended session", endSessionResponseSchema) },
				{ auth: "league" }
			),
		}),
		requireApiKeyScope({ session: ["stop"] }),
		async (c) => {
			try {
				const session = await endSession(actionCtx(c), leagueId(c));
				return respond(c, endSessionResponseSchema, { session });
			} catch (error) {
				throw mapError(error);
			}
		}
	)
	.post(
		"/active/match/start",
		describeRoute({
			summary: "Start the next match",
			description:
				"Starts the next match in the active session. Requires a league API key with `match:start`.",
			tags: ["Sessions"],
			security: apiKeySecurity,
			requestBody: jsonRequest(startMatchSchema),
			responses: apiResponses(
				{ 201: jsonResponse("The started match", startMatchResponseSchema) },
				{ auth: "league" }
			),
		}),
		requireApiKeyScope({ match: ["start"] }),
		zValidator("json", startMatchSchema),
		async (c) => {
			try {
				const match = await startNextMatch(actionCtx(c), leagueId(c), c.req.valid("json"));
				return respond(c, startMatchResponseSchema, { match }, 201);
			} catch (error) {
				throw mapError(error);
			}
		}
	)
	.post(
		"/active/match/log",
		describeRoute({
			summary: "Log the current match result",
			description:
				"Records the final score, completes the current match, and returns the next lineup. Requires a league API key with `match:log`.",
			tags: ["Sessions"],
			security: apiKeySecurity,
			requestBody: jsonRequest(scorePairRequestSchema),
			responses: apiResponses(
				{ 200: jsonResponse("The recorded result and next lineup", logMatchResponseSchema) },
				{ auth: "league" }
			),
		}),
		requireApiKeyScope({ match: ["log"] }),
		zValidator("json", scorePairRequestSchema),
		async (c) => {
			try {
				const result = await logMatch(actionCtx(c), leagueId(c), c.req.valid("json"));
				return respond(c, logMatchResponseSchema, result);
			} catch (error) {
				throw mapError(error);
			}
		}
	)
	.put(
		"/active/match/lineup",
		describeRoute({
			summary: "Set the current match lineup",
			description:
				"Updates the team selection for the current match. Requires a league API key with `match:lineup`.",
			tags: ["Sessions"],
			security: apiKeySecurity,
			requestBody: jsonRequest(lineupSchema),
			responses: apiResponses(
				{ 200: jsonResponse("The updated team selection", lineupResponseSchema) },
				{ auth: "league" }
			),
		}),
		requireApiKeyScope({ match: ["lineup"] }),
		zValidator("json", lineupSchema),
		async (c) => {
			try {
				const teamSelection = await setLineup(actionCtx(c), leagueId(c), c.req.valid("json"));
				return respond(c, lineupResponseSchema, { teamSelection });
			} catch (error) {
				throw mapError(error);
			}
		}
	)
	.put(
		"/active/match/score",
		describeRoute({
			summary: "Update the live match score",
			description:
				"Updates the live score of the current match without completing it. Requires a league API key with `match:score`.",
			tags: ["Sessions"],
			security: apiKeySecurity,
			requestBody: jsonRequest(scorePairRequestSchema),
			responses: apiResponses(
				{ 200: jsonResponse("The updated match score", scoreResponseSchema) },
				{ auth: "league" }
			),
		}),
		requireApiKeyScope({ match: ["score"] }),
		zValidator("json", scorePairRequestSchema),
		async (c) => {
			try {
				const match = await updateLiveScore(actionCtx(c), leagueId(c), c.req.valid("json"));
				return respond(c, scoreResponseSchema, { match });
			} catch (error) {
				throw mapError(error);
			}
		}
	)
	.delete(
		"/active/match",
		describeRoute({
			summary: "Cancel the current match",
			description:
				"Cancels the current match and restores the previous lineup. Requires a league API key with `match:cancel`.",
			tags: ["Sessions"],
			security: apiKeySecurity,
			responses: apiResponses(
				{ 200: jsonResponse("The cancelled match and restored lineup", cancelMatchResponseSchema) },
				{ auth: "league" }
			),
		}),
		requireApiKeyScope({ match: ["cancel"] }),
		async (c) => {
			try {
				const result = await cancelMatch(actionCtx(c), leagueId(c));
				return respond(c, cancelMatchResponseSchema, result);
			} catch (error) {
				throw mapError(error);
			}
		}
	);
