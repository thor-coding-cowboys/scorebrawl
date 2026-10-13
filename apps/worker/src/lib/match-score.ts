import { z } from "zod";

/**
 * Upper bound for a single side's score in a match.
 *
 * Generous enough for any real game (well past basketball-range totals) while
 * rejecting absurd values from a misbehaving client.
 */
export const MAX_MATCH_SCORE = 999;

/** Non-negative integer match score, capped at {@link MAX_MATCH_SCORE}. */
export const matchScoreSchema = z
	.number()
	.int()
	.min(0)
	.max(MAX_MATCH_SCORE)
	.describe(`Non-negative integer score, at most ${MAX_MATCH_SCORE}`);

/** Home/away score pair accepted by match score-writing endpoints. */
export const scorePairSchema = z.object({
	home: matchScoreSchema,
	away: matchScoreSchema,
});
