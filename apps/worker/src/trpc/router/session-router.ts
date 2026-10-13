import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { leagueMemberProcedure } from "../trpc";
import { matchScoreSchema } from "../../lib/match-score";
import * as sessionRepository from "../../repositories/session";
import * as seasonRepository from "../../repositories/season-repository";
import * as sessionActions from "../../services/session/session-actions";
import type { SessionActionContext } from "../../services/session/session-actions";

type SessionDb = Parameters<typeof sessionRepository.getActiveSession>[0]["db"];

async function getSeasonBySlug(db: SessionDb, seasonSlug: string, organizationId: string) {
	try {
		return await seasonRepository.getBySlug({ db, seasonSlug, leagueId: organizationId });
	} catch (error) {
		if (error instanceof Error && error.message === "Season not found") {
			throw new TRPCError({ code: "NOT_FOUND", message: "Season not found" });
		}
		throw error;
	}
}

async function getSessionForOrg(db: SessionDb, sessionId: string, organizationId: string) {
	const info = await sessionRepository.getSessionWithSeason({ db, sessionId });
	if (!info) {
		throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
	}
	if (info.leagueId !== organizationId) {
		throw new TRPCError({ code: "FORBIDDEN", message: "Session not in your league" });
	}
	return info;
}

function toActionContext(ctx: {
	db: SessionDb;
	env: SessionActionContext["env"];
	organization: { id: string; slug: string; name: string };
	authentication: { user: { id: string; name: string } };
	waitUntil: SessionActionContext["waitUntil"];
}): SessionActionContext {
	return {
		db: ctx.db,
		env: ctx.env,
		organization: {
			id: ctx.organization.id,
			slug: ctx.organization.slug,
			name: ctx.organization.name,
		},
		user: { id: ctx.authentication.user.id, name: ctx.authentication.user.name },
		waitUntil: ctx.waitUntil,
	};
}

export const sessionRouter = {
	create: leagueMemberProcedure
		.input(
			z.object({
				seasonSlug: z.string(),
				rotationMode: z.enum(["winner-stays", "manual"]),
				teamSize: z.number().int().min(1).max(6),
				maxConsecutiveGames: z.number().int().min(1).nullable(),
				seasonPlayerIds: z.array(z.string()).default([]),
				alwaysSplitConstraints: z.array(z.tuple([z.string(), z.string()])).default([]),
				autoCoinToss: z.boolean().default(false),
				winnersTakePriority: z.boolean().default(false),
				maxConsecutiveEnabled: z.boolean().default(false),
				randomizerType: z.enum(["off", "fisher-yates", "diversity"]).default("fisher-yates"),
			})
		)
		.mutation(async ({ ctx, input }) => {
			return sessionActions.startSession(toActionContext(ctx), input);
		}),

	getActive: leagueMemberProcedure
		.input(z.object({ seasonSlug: z.string() }))
		.query(async ({ ctx, input }) => {
			const s = await getSeasonBySlug(ctx.db, input.seasonSlug, ctx.organizationId);
			return sessionRepository.getActiveSession({ db: ctx.db, seasonId: s.id });
		}),

	getById: leagueMemberProcedure
		.input(z.object({ sessionId: z.string() }))
		.query(async ({ ctx, input }) => {
			await getSessionForOrg(ctx.db, input.sessionId, ctx.organizationId);

			const session = await sessionRepository.getSessionById({
				db: ctx.db,
				sessionId: input.sessionId,
			});

			if (!session) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
			}

			return session;
		}),

	joinSelf: leagueMemberProcedure
		.input(z.object({ sessionId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			return sessionActions.joinSelf(toActionContext(ctx), ctx.organizationId, input);
		}),

	addPlayer: leagueMemberProcedure
		.input(z.object({ sessionId: z.string(), seasonPlayerId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			return sessionActions.addPlayer(toActionContext(ctx), ctx.organizationId, input);
		}),

	removePlayer: leagueMemberProcedure
		.input(z.object({ sessionId: z.string(), sessionPlayerId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			return sessionActions.removePlayer(toActionContext(ctx), ctx.organizationId, input);
		}),

	startNextMatch: leagueMemberProcedure
		.input(
			z.object({
				sessionId: z.string(),
				homeSeasonPlayerIds: z.array(z.string()),
				awaySeasonPlayerIds: z.array(z.string()),
			})
		)
		.mutation(async ({ ctx, input }) => {
			return sessionActions.startNextMatch(toActionContext(ctx), ctx.organizationId, {
				sessionId: input.sessionId,
				home: input.homeSeasonPlayerIds,
				away: input.awaySeasonPlayerIds,
			});
		}),

	recordResult: leagueMemberProcedure
		.input(
			z.object({
				sessionId: z.string(),
				sessionMatchId: z.string(),
				homeScore: matchScoreSchema,
				awayScore: matchScoreSchema,
			})
		)
		.mutation(async ({ ctx, input }) => {
			return sessionActions.logMatch(toActionContext(ctx), ctx.organizationId, {
				sessionId: input.sessionId,
				sessionMatchId: input.sessionMatchId,
				home: input.homeScore,
				away: input.awayScore,
			});
		}),

	resolveCoinToss: leagueMemberProcedure
		.input(z.object({ coinTossId: z.string(), resolvedWinnerIds: z.array(z.string()) }))
		.mutation(async ({ ctx, input }) => {
			return sessionActions.resolveCoinToss(toActionContext(ctx), ctx.organizationId, input);
		}),

	end: leagueMemberProcedure
		.input(z.object({ sessionId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			return sessionActions.endSession(toActionContext(ctx), ctx.organizationId, {
				sessionId: input.sessionId,
			});
		}),

	listEnded: leagueMemberProcedure
		.input(z.object({ seasonSlug: z.string(), limit: z.number().min(1).max(50).optional() }))
		.query(async ({ ctx, input }) => {
			const s = await getSeasonBySlug(ctx.db, input.seasonSlug, ctx.organizationId);
			return sessionRepository.listEndedSessions({
				db: ctx.db,
				seasonId: s.id,
				limit: input.limit,
			});
		}),

	getSummary: leagueMemberProcedure
		.input(z.object({ sessionId: z.string() }))
		.query(async ({ ctx, input }) => {
			await getSessionForOrg(ctx.db, input.sessionId, ctx.organizationId);

			const summary = await sessionRepository.getSessionSummary({
				db: ctx.db,
				sessionId: input.sessionId,
			});

			if (!summary) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
			}

			return summary;
		}),

	cancelMatch: leagueMemberProcedure
		.input(z.object({ sessionId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			return sessionActions.cancelMatch(toActionContext(ctx), ctx.organizationId, input);
		}),

	deleteLastMatch: leagueMemberProcedure
		.input(z.object({ sessionId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			return sessionActions.deleteLastMatch(toActionContext(ctx), ctx.organizationId, input);
		}),

	updateMatchScore: leagueMemberProcedure
		.input(
			z.object({
				sessionId: z.string(),
				sessionMatchId: z.string(),
				homeScore: matchScoreSchema,
				awayScore: matchScoreSchema,
			})
		)
		.mutation(async ({ ctx, input }) => {
			return sessionActions.updateMatchScore(toActionContext(ctx), ctx.organizationId, input);
		}),

	updateTeamSelection: leagueMemberProcedure
		.input(
			z.object({
				sessionId: z.string(),
				sessionMatchId: z.string(),
				selectedHomePlayerIds: z.array(z.string()),
				selectedAwayPlayerIds: z.array(z.string()),
			})
		)
		.mutation(async ({ ctx, input }) => {
			return sessionActions.updateTeamSelection(toActionContext(ctx), ctx.organizationId, input);
		}),

	updateProposedLineup: leagueMemberProcedure
		.input(
			z.object({
				sessionId: z.string(),
				proposedLineup: z.object({
					homePlayerIds: z.array(z.string()),
					awayPlayerIds: z.array(z.string()),
					rotatedOut: z.array(z.string()),
					coinTossNeeded: z
						.object({
							conflictType: z.string(),
							candidates: z.array(z.string()),
						})
						.nullable(),
					selectedHomePlayerIds: z.array(z.string()),
					selectedAwayPlayerIds: z.array(z.string()),
				}),
			})
		)
		.mutation(async ({ ctx, input }) => {
			return sessionActions.updateProposedLineup(toActionContext(ctx), ctx.organizationId, input);
		}),

	updateSettings: leagueMemberProcedure
		.input(
			z.object({
				sessionId: z.string(),
				teamSize: z.number().int().min(1).max(6).optional(),
				maxConsecutiveGames: z.number().int().min(1).nullable().optional(),
				maxConsecutiveEnabled: z.boolean().optional(),
				winnersTakePriority: z.boolean().optional(),
				autoCoinToss: z.boolean().optional(),
				randomizerType: z.enum(["off", "fisher-yates", "diversity"]).optional(),
				alwaysSplitConstraints: z.array(z.tuple([z.string(), z.string()])).optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const { sessionId, ...settings } = input;
			return sessionActions.updateSettings(toActionContext(ctx), ctx.organizationId, {
				sessionId,
				settings,
			});
		}),
} satisfies TRPCRouterRecord;
