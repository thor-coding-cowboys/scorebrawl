import { Hono } from "hono";
import type { HonoEnv } from "../middleware/context";

type SSEEnv = {
	Bindings: HonoEnv["Bindings"] & {
		SEASON_SSE: DurableObjectNamespace;
	};
	Variables: HonoEnv["Variables"];
};

export const sseRouter = new Hono<SSEEnv>().get("/:leagueSlug/:seasonSlug", async (c) => {
	const { leagueSlug, seasonSlug } = c.req.param();

	// Create a unique ID for this league/season combination
	const doId = c.env.SEASON_SSE.idFromName(`${leagueSlug}/${seasonSlug}`);
	const stub = c.env.SEASON_SSE.get(doId);

	// Forward the request to the Durable Object
	const url = new URL(c.req.url);
	url.pathname = "/connect";

	return stub.fetch(new Request(url.toString(), { headers: c.req.raw.headers }));
});

export async function broadcastSeasonEvent(
	env: { SEASON_SSE: DurableObjectNamespace },
	leagueSlug: string,
	seasonSlug: string,
	event: { type: string; data: unknown; user?: { id: string; name: string } }
) {
	const doId = env.SEASON_SSE.idFromName(`${leagueSlug}/${seasonSlug}`);
	const stub = env.SEASON_SSE.get(doId);

	await stub.fetch(
		new Request("https://internal/broadcast", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(event),
		})
	);
}
