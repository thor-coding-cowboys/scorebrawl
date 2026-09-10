import { Hono } from "hono";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { requestToResourceInput, verifyAccessTokenRequest } from "better-auth/oauth2";
import type { JSONWebKeySet } from "jose";
import type { HonoEnv } from "../middleware/context";
import { member as memberTable, league as organization } from "../db/schema/auth-schema";
import { season as seasonTable } from "../db/schema/league-schema";
import { jwks as jwksTable } from "../db/schema/auth-schema";
import { createOneVnMatch, type MatchCreationContext } from "../services/match-creation";
import {
	resolveParticipantsToSeasonPlayers,
	UnresolvedParticipantsError,
	type MatchParticipant,
} from "../services/external-identity";
import * as matchRepository from "../repositories/match-repository";
import { TRPCError } from "@trpc/server";

const memberRoles = ["owner", "editor", "member"];

const participantSchema = z
	.object({
		externalUserId: z.string().min(1).optional(),
		email: z.string().email().optional(),
		name: z.string().min(1).optional(),
	})
	.refine((p) => p.externalUserId || p.email, {
		message: "participant must have externalUserId or email",
	});

const createMatchSchema = z.object({
	gameId: z.string().min(1),
	gameType: z.literal("1-v-n").default("1-v-n"),
	playedAt: z.string().datetime().optional(),
	winner: participantSchema,
	losers: z.array(participantSchema).min(1),
});

type OAuthTokenPayload = {
	sub?: string | undefined;
	scope?: string | undefined;
};

async function getJwksSet(db: HonoEnv["Variables"]["db"]): Promise<JSONWebKeySet> {
	const keys = await db
		.select({ id: jwksTable.id, publicKey: jwksTable.publicKey })
		.from(jwksTable);
	return {
		keys: keys.map((k) => ({
			kid: k.id,
			...JSON.parse(k.publicKey),
		})),
	};
}

function mapTrpcError(error: unknown): HTTPException {
	if (error instanceof UnresolvedParticipantsError) {
		return new HTTPException(400, { message: error.message });
	}
	if (error instanceof TRPCError) {
		const codeMap: Record<string, 400 | 401 | 403 | 404 | 409 | 500> = {
			BAD_REQUEST: 400,
			UNAUTHORIZED: 401,
			FORBIDDEN: 403,
			NOT_FOUND: 404,
			CONFLICT: 409,
			INTERNAL_SERVER_ERROR: 500,
		};
		return new HTTPException(codeMap[error.code] ?? 400, { message: error.message });
	}
	if (error instanceof Error) {
		return new HTTPException(500, { message: error.message });
	}
	return new HTTPException(500, { message: "Internal server error" });
}

type MatchContext = Context<HonoEnv>;

async function resolveTarget(c: MatchContext) {
	const db = c.get("db");
	const leagueId = c.req.param("leagueId");
	const seasonId = c.req.param("seasonId");
	const userId = c.get("oauthToken")?.sub;
	if (!userId) {
		throw new HTTPException(401, { message: "Invalid token" });
	}

	const [org] = await db
		.select({ role: memberTable.role, slug: organization.slug })
		.from(organization)
		.innerJoin(memberTable, eq(memberTable.organizationId, organization.id))
		.where(and(eq(organization.id, leagueId), eq(memberTable.userId, userId)))
		.limit(1);
	if (!org || !memberRoles.includes(org.role)) {
		throw new HTTPException(403, {
			message: "The token owner is not a member of this league",
		});
	}

	const [season] = await db
		.select({
			id: seasonTable.id,
			slug: seasonTable.slug,
			closed: seasonTable.closed,
			scoreType: seasonTable.scoreType,
			initialScore: seasonTable.initialScore,
		})
		.from(seasonTable)
		.where(and(eq(seasonTable.id, seasonId), eq(seasonTable.leagueId, leagueId)))
		.limit(1);
	if (!season) {
		throw new HTTPException(404, { message: "Season not found" });
	}

	return { db, leagueId, seasonId, userId, org, season };
}

export const matchesV1Router = new Hono<HonoEnv>();

matchesV1Router.use("*", async (c, next) => {
	const auth = c.get("betterAuth");
	const requiredScope = c.req.method === "GET" ? "read:matches" : "create:matches";
	try {
		const baseUrl =
			(auth.options as { baseURL?: string }).baseURL ??
			(c.env as { BETTER_AUTH_URL?: string }).BETTER_AUTH_URL ??
			new URL(c.req.raw.url).origin;
		const basePath = (auth.options as { basePath?: string }).basePath ?? "/api/auth";
		const issuer = `${baseUrl}${basePath}`;
		const payload = (await verifyAccessTokenRequest(requestToResourceInput(c.req.raw), {
			verifyOptions: {
				issuer,
				audience: c.env.OAUTH_RESOURCE,
			},
			requiredScopes: [requiredScope],
			jwksUrl: (() => getJwksSet(c.get("db"))) as unknown as string,
		})) as OAuthTokenPayload;
		c.set("oauthToken", payload);
		await next();
	} catch (error) {
		const apiError = error as { status?: string; body?: { error?: string; scope?: string } };
		if (apiError.status === "FORBIDDEN" || apiError.body?.error === "insufficient_scope") {
			const scope = apiError.body?.scope ?? requiredScope;
			return c.json(
				{
					error: "insufficient_scope",
					error_description: `The access token is missing the required scope: ${scope}`,
					scope,
				},
				403,
				{ "WWW-Authenticate": `Bearer error="insufficient_scope", scope="${scope}"` }
			);
		}
		return c.json(
			{
				error: "invalid_token",
				error_description: "The access token is missing, invalid or expired.",
			},
			401,
			{ "WWW-Authenticate": 'Bearer error="invalid_token"' }
		);
	}
});

matchesV1Router.post("/", zValidator("json", createMatchSchema), async (c) => {
	const target = await resolveTarget(c);
	const { db, leagueId, seasonId, season } = target;
	const input = c.req.valid("json");

	if (season.closed) {
		return c.json({ error: "This season is closed" }, 403);
	}
	if (season.scoreType !== "1-v-n-elo") {
		return c.json({ error: "1-v-n games can only be recorded in 1-v-n-elo seasons" }, 400);
	}

	const participants: MatchParticipant[] = [
		{ ...input.winner, role: "winner" },
		...input.losers.map((loser) => ({ ...loser, role: "loser" })),
	] as MatchParticipant[];

	try {
		const resolved = await resolveParticipantsToSeasonPlayers({
			db,
			leagueId,
			seasonId,
			initialScore: season.initialScore,
			participants,
		});

		const match = await createOneVnMatch({
			ctx: {
				db,
				env: c.env,
				waitUntil: c.executionCtx.waitUntil.bind(c.executionCtx),
				organization: { slug: target.org.slug },
				user: { id: target.userId, name: "OAuth API" },
			} satisfies MatchCreationContext,
			seasonSlug: season.slug,
			id: input.gameId,
			winnerId: resolved.winnerSeasonPlayerId,
			loserIds: resolved.loserSeasonPlayerIds,
		});

		return c.json({ match }, 201);
	} catch (error) {
		throw mapTrpcError(error);
	}
});

matchesV1Router.get("/", async (c) => {
	const target = await resolveTarget(c);
	const limit = Number(c.req.query("limit") ?? 30);
	const offset = Number(c.req.query("offset") ?? 0);

	const result = await matchRepository.getBySeasonId({
		db: target.db,
		seasonId: target.seasonId,
		limit: Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 30,
		offset: Number.isFinite(offset) && offset >= 0 ? offset : 0,
	});

	return c.json(result);
});
