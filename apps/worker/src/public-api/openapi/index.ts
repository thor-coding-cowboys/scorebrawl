import { Hono } from "hono";
import { generateSpecs, type GenerateSpecOptions } from "hono-openapi";
import type { HonoEnv } from "../../middleware/context";
import { leagueRouter } from "../../routes/league-router";
import { v1Router } from "../../routes/v1";

export * from "./responses";

export const publicApiSpecOptions: Partial<GenerateSpecOptions> = {
	documentation: {
		info: {
			title: "ScoreBrawl Public API",
			version: "1.0.0",
			description: [
				"REST API for ScoreBrawl leagues and seasons.",
				"",
				"Two key types exist and are not interchangeable:",
				"- Personal keys (`sbp_`) on `https://api.scorebrawl.com/v1` act as the user and carry `profile:read` / `league:read`.",
				"- League keys (`sbk_`) on `https://api.scorebrawl.com/leagues/v1/...` act as the league owner and carry `session:*` / `match:*` actions.",
				"",
				"Every operation states the key type and scope it requires.",
			].join("\n"),
		},
		servers: [{ url: "https://api.scorebrawl.com" }],
		components: {
			securitySchemes: {
				apiKey: { type: "apiKey", in: "header", name: "x-api-key" },
			},
		},
	},
	exclude: ["/v1/openapi.json"],
};

/**
 * Spec-only app: mounts the public routers exactly as `src/index.ts` does so the
 * document never includes tRPC, better-auth, MCP, or OAuth routes.
 */
export const publicApiSpecApp = new Hono<HonoEnv>()
	.route("/v1", v1Router)
	.route("/leagues/v1", leagueRouter);

export function generatePublicApiSpec() {
	return generateSpecs(publicApiSpecApp, publicApiSpecOptions);
}
