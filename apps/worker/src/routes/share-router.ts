import { Hono, type Context } from "hono";
import type { HonoEnv } from "../middleware/context";
import { hashShareToken, isShareExpired, SHARE_LINK_KEY_PATTERN } from "../lib/share-links";
import { hashRateLimitKey } from "../public-api/rate-limit";
import * as matchRepository from "../repositories/match-repository";
import * as seasonPlayerRepository from "../repositories/season-player-repository";
import * as shareLinkRepository from "../repositories/share-link-repository";
import { sortStandings, winPct } from "@coding-cowboys/scorebrawl-core/presentation";

const RECENT_MATCH_LIMIT = 5;

type ShareErrorCode = "not_found" | "expired" | "revoked" | "sharing_disabled" | "rate_limited";

function errorResponse(
	c: Context<HonoEnv>,
	status: 403 | 404 | 410 | 429,
	code: ShareErrorCode,
	message: string,
	extra: { expiresAt?: Date | null; revokedAt?: Date | null } = {}
) {
	const body = {
		error: { code, message },
		...(extra.expiresAt !== undefined ? { expiresAt: extra.expiresAt } : {}),
		...(extra.revokedAt !== undefined ? { revokedAt: extra.revokedAt } : {}),
	};

	return c.json(body, status);
}

function playerLabel(team: { name: string | null; players: { name: string }[] }): string {
	if (team.name) return team.name;
	const names = team.players.map((player) => player.name);
	if (names.length === 0) return "Unknown";
	if (names.length <= 2) return names.join(" & ");
	return `${names.slice(0, 2).join(" & ")} +${names.length - 2}`;
}

export const sharePublicRouter = new Hono<HonoEnv>()
	.use("*", async (c, next) => {
		c.header("Cache-Control", "no-store");
		c.header("X-Robots-Tag", "noindex");
		c.header("Referrer-Policy", "no-referrer");
		await next();
	})
	.get("/links/:key", async (c) => {
		const key = c.req.param("key");
		if (!SHARE_LINK_KEY_PATTERN.test(key)) {
			return errorResponse(c, 404, "not_found", "This link doesn't exist");
		}

		const clientIp =
			c.req.header("cf-connecting-ip") ?? c.req.header("x-forwarded-for") ?? "unknown";
		const { success: withinLimit } = await c.env.PUBLIC_API_RATE_LIMITER.limit({
			key: `share:ip:${await hashRateLimitKey(clientIp)}`,
		});
		if (!withinLimit) {
			c.header("Retry-After", "60");
			return errorResponse(c, 429, "rate_limited", "Too many requests");
		}

		const tokenHash = await hashShareToken(key);
		const link = await shareLinkRepository.resolveShareLink({ db: c.var.db, tokenHash });

		if (!link) return errorResponse(c, 404, "not_found", "This link doesn't exist");
		if (!link.allowPublicShares) {
			return errorResponse(c, 403, "sharing_disabled", "Sharing was disabled for this league");
		}
		if (link.revokedAt) {
			return errorResponse(c, 410, "revoked", "This link was revoked", {
				revokedAt: link.revokedAt,
			});
		}
		if (isShareExpired(link.expiresAt)) {
			return errorResponse(c, 410, "expired", "This link expired", {
				expiresAt: link.expiresAt,
			});
		}

		const [standingRows, recentMatches] = await Promise.all([
			seasonPlayerRepository.getStanding({ db: c.var.db, seasonId: link.seasonId }),
			matchRepository.getBySeasonId({
				db: c.var.db,
				seasonId: link.seasonId,
				limit: RECENT_MATCH_LIMIT,
				offset: 0,
			}),
		]);

		const standings = sortStandings(standingRows).map((row, index) => ({
			id: row.id,
			rank: index + 1,
			name: row.name,
			image: row.image,
			score: row.score,
			matchCount: row.matchCount,
			winCount: row.winCount,
			lossCount: row.lossCount,
			drawCount: row.drawCount,
			winPct: winPct(row),
			pointDiff: row.pointDiff,
			form: row.form,
		}));

		// Await the counter so the write never outlives the request context, which
		// the Workers test runner treats as cross-request I/O.
		try {
			await shareLinkRepository.recordShareLinkView({ db: c.var.db, id: link.id });
		} catch (error) {
			console.error("[Share] Failed to record view", error);
		}

		return c.json({
			link: { createdAt: link.createdAt, expiresAt: link.expiresAt },
			league: { id: link.leagueId, name: link.leagueName, logo: link.leagueLogo },
			season: {
				id: link.seasonId,
				name: link.seasonName,
				startDate: link.seasonStartDate,
				closed: link.seasonClosed,
				archived: link.seasonArchived,
			},
			standings,
			recentMatches: recentMatches.matches.map((match) => ({
				id: match.id,
				playedAt: match.createdAt,
				home: { label: playerLabel(match.homeTeam), score: match.homeScore },
				away: { label: playerLabel(match.awayTeam), score: match.awayScore },
			})),
			generatedAt: new Date(),
		});
	});
