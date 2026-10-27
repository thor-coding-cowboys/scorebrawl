import { Hono } from "hono";
import type {
	SeasonRealtimeEvent,
	SeasonRealtimeUser,
	SeasonStandingsUpdateData,
} from "@coding-cowboys/scorebrawl-core/realtime";
import type { HonoEnv } from "../middleware/context";

export const sseRouter = new Hono<HonoEnv>().get("/:leagueSlug/:seasonSlug", async (c) => {
	const upgradeHeader = c.req.header("Upgrade");
	if (upgradeHeader !== "websocket") {
		return c.text("Expected WebSocket upgrade", 426);
	}

	const { leagueSlug, seasonSlug } = c.req.param();
	const doId = c.env.SEASON_SSE.idFromName(`${leagueSlug}/${seasonSlug}`);
	const stub = c.env.SEASON_SSE.get(doId);

	// Pass the original request directly for WebSocket upgrade to work properly
	return stub.fetch(c.req.raw);
});

export function broadcastSeasonEvent(
	env: Pick<Env, "SEASON_SSE">,
	leagueSlug: string,
	seasonSlug: string,
	event: SeasonRealtimeEvent
): Promise<void> {
	const doId = env.SEASON_SSE.idFromName(`${leagueSlug}/${seasonSlug}`);
	const stub = env.SEASON_SSE.get(doId);

	return stub
		.fetch(
			new Request("https://internal/broadcast", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(event),
			})
		)
		.then((res) => {
			res.body?.cancel().catch(() => {});
		})
		.then(() => {});
}

export function broadcastStandingsUpdate(
	env: Pick<Env, "SEASON_SSE">,
	leagueSlug: string,
	seasonSlug: string,
	data: SeasonStandingsUpdateData,
	user?: SeasonRealtimeUser
): Promise<void> {
	return broadcastSeasonEvent(env, leagueSlug, seasonSlug, {
		type: "standings:update",
		data,
		...(user ? { user } : {}),
	});
}
