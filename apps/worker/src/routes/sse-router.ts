import { Hono } from "hono";
import type { HonoEnv } from "../middleware/context";

export const sseRouter = new Hono<HonoEnv>().get("/:leagueSlug/:seasonSlug", async (c) => {
	const { leagueSlug, seasonSlug } = c.req.param();

	const doId = c.env.SEASON_SSE.idFromName(`${leagueSlug}/${seasonSlug}`);
	const stub = c.env.SEASON_SSE.get(doId);

	const url = new URL(c.req.url);
	url.pathname = "/connect";

	return stub.fetch(new Request(url.toString(), { headers: c.req.raw.headers }));
});

export function broadcastSeasonEvent(
	env: Pick<Env, "SEASON_SSE">,
	leagueSlug: string,
	seasonSlug: string,
	event: { type: string; data: unknown; user?: { id: string; name: string } }
): void {
	const doId = env.SEASON_SSE.idFromName(`${leagueSlug}/${seasonSlug}`);
	const stub = env.SEASON_SSE.get(doId);

	// Fire-and-forget: don't await the response to avoid blocking HTTP requests
	void stub
		.fetch(
			new Request("https://internal/broadcast", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(event),
			})
		)
		.catch(() => {
			// Silently ignore errors - SSE is best-effort
		});
}
