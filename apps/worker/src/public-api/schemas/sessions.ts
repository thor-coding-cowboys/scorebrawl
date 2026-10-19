import { z } from "zod";
import { scorePairSchema } from "../../lib/match-score";
import type {
	cancelMatch,
	endSession,
	logMatch,
	setLineup,
	startNextMatch,
	startSession,
	updateLiveScore,
} from "../../services/session/session-actions";

const timestamp = z.coerce.date();

export const startSchema = z
	.object({
		seasonSlug: z.string().min(1),
		teamSize: z.number().int().min(1).max(6).optional(),
		rotationMode: z.enum(["winner-stays", "manual"]).optional(),
	})
	.meta({ ref: "StartSessionRequest" });

export const startMatchSchema = z
	.object({
		home: z.array(z.string()).optional(),
		away: z.array(z.string()).optional(),
	})
	.meta({ ref: "StartMatchRequest" });

export const lineupSchema = z
	.object({ home: z.array(z.string()), away: z.array(z.string()) })
	.meta({ ref: "LineupRequest" });

export const scorePairRequestSchema = scorePairSchema.meta({ ref: "ScorePairRequest" });

export type StartSessionInput = z.infer<typeof startSchema>;
export type StartMatchInput = z.infer<typeof startMatchSchema>;
export type LineupInput = z.infer<typeof lineupSchema>;
export type ScorePairInput = z.infer<typeof scorePairRequestSchema>;

export const sessionPlayerSchema = z
	.object({
		id: z.string(),
		sessionId: z.string(),
		seasonPlayerId: z.string(),
		status: z.enum(["waiting", "playing", "out"]),
		queuePosition: z.number(),
		gamesPlayedThisSession: z.number(),
		consecutiveGames: z.number(),
		joinedAt: timestamp,
		createdAt: timestamp,
		updatedAt: timestamp,
		deletedAt: timestamp.nullable(),
	})
	.meta({ ref: "SessionPlayer" });

export const sessionSchema = z
	.object({
		id: z.string(),
		seasonId: z.string(),
		createdBy: z.string(),
		status: z.enum(["active", "ended"]),
		rotationMode: z.enum(["winner-stays", "manual"]),
		teamSize: z.number(),
		maxConsecutiveGames: z.number().nullable(),
		alwaysSplitConstraints: z.string().nullable(),
		autoCoinToss: z.boolean(),
		randomizerType: z.enum(["off", "fisher-yates", "diversity"]),
		winnersTakePriority: z.boolean(),
		maxConsecutiveEnabled: z.boolean(),
		proposedLineup: z.string().nullable(),
		modeSettings: z.string().nullable(),
		endedAt: timestamp.nullable(),
		createdAt: timestamp,
		updatedAt: timestamp,
		deletedAt: timestamp.nullable(),
	})
	.meta({ ref: "Session" });

export const matchSchema = z
	.object({
		id: z.string(),
		sessionId: z.string(),
		matchId: z.string().nullable(),
		matchNumber: z.number(),
		homePlayerIds: z.string(),
		awayPlayerIds: z.string(),
		result: z.enum(["home", "away", "draw"]).nullable(),
		homeSessionScore: z.number(),
		awaySessionScore: z.number(),
		selectedHomePlayerIds: z.string().nullable(),
		selectedAwayPlayerIds: z.string().nullable(),
		createdAt: timestamp,
		updatedAt: timestamp,
		deletedAt: timestamp.nullable(),
	})
	.meta({ ref: "Match" });

export const proposedLineupSchema = z
	.object({
		homePlayerIds: z.array(z.string()),
		awayPlayerIds: z.array(z.string()),
		rotatedOut: z.array(z.string()),
		coinTossNeeded: z
			.object({
				conflictType: z.enum(["loser-rotation", "max-consecutive-exceeded", "draw-tiebreak"]),
				candidates: z.array(z.string()),
			})
			.nullable(),
	})
	.meta({ ref: "ProposedLineup" });

export const startSessionResponseSchema = z
	.object({ session: sessionSchema.extend({ players: z.array(sessionPlayerSchema) }) })
	.meta({ ref: "StartSessionResponse" }) satisfies z.ZodType<{
	session: Awaited<ReturnType<typeof startSession>>;
}>;

export const endSessionResponseSchema = z
	.object({ session: sessionSchema })
	.meta({ ref: "EndSessionResponse" }) satisfies z.ZodType<{
	session: Awaited<ReturnType<typeof endSession>>;
}>;

export const startMatchResponseSchema = z
	.object({ match: matchSchema })
	.meta({ ref: "StartMatchResponse" }) satisfies z.ZodType<{
	match: Awaited<ReturnType<typeof startNextMatch>>;
}>;

export const logMatchResponseSchema = z
	.object({
		match: matchSchema,
		players: z.array(sessionPlayerSchema),
		proposedLineup: proposedLineupSchema.nullable(),
		coinTossId: z.string().nullable(),
		autoResolvedCoinToss: z
			.object({ winnerNames: z.array(z.string()), conflictType: z.string() })
			.nullable(),
	})
	.meta({ ref: "LogMatchResponse" }) satisfies z.ZodType<Awaited<ReturnType<typeof logMatch>>>;

export const lineupResponseSchema = z
	.object({
		teamSelection: z.object({
			id: z.string(),
			selectedHomePlayerIds: z.string().nullable(),
			selectedAwayPlayerIds: z.string().nullable(),
		}),
	})
	.meta({ ref: "LineupResponse" }) satisfies z.ZodType<{
	teamSelection: NonNullable<Awaited<ReturnType<typeof setLineup>>>;
}>;

export const scoreResponseSchema = z
	.object({
		match: z.object({
			id: z.string(),
			homeSessionScore: z.number(),
			awaySessionScore: z.number(),
		}),
	})
	.meta({ ref: "ScoreResponse" }) satisfies z.ZodType<{
	match: NonNullable<Awaited<ReturnType<typeof updateLiveScore>>>;
}>;

export const cancelMatchResponseSchema = z
	.object({
		deletedMatch: matchSchema,
		players: z.array(sessionPlayerSchema),
		restoredProposedLineup: z.object({
			homePlayerIds: z.array(z.string()),
			awayPlayerIds: z.array(z.string()),
			rotatedOut: z.array(z.string()),
			coinTossNeeded: z.null(),
		}),
	})
	.meta({ ref: "CancelMatchResponse" }) satisfies z.ZodType<
	Awaited<ReturnType<typeof cancelMatch>>
>;
