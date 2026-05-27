import { Hono } from "hono";
import type { HonoEnv } from "../middleware/context";
import { mcpAuthMiddleware } from "../middleware/mcp-auth";
import { tools } from "../services/mcp-tools/tool-registry";
import {
	getPlayers,
	getMatches,
	getSeasonStandings,
	getSeasons,
	getPlayerStats,
	getHeadToHead,
	getScoringStats,
	getStreaks,
	getEloProgression,
	getFormGuide,
	getTeamChemistry,
	getSessionStats,
	getBiggestMargins,
	getClosestMatches,
	getUpsets,
	getRecentMatches,
	getMatchById,
	getFixtures,
	getSeasonProgress,
	getAchievements,
	getUnbeatenRuns,
	getMostImproved,
	getPlayerActivity,
	getPlayerPeak,
	getTeamStandings,
	getTeamStats,
	getComparison,
	getWinProbability,
	getRivalries,
	getLeagueRecords,
	getSeasonHighlights,
	getFairnessIndex,
	getBusiestPeriods,
	getActiveSessions,
	getSessionLineup,
} from "../services/mcp-tools/tool-executors";
import { executeQuery } from "../services/mcp-tools/query-builder";

const CLIENT_ONLY_TOOLS = new Set(["render_chart"]);

const toolExecutors: Record<string, (ctx: any, args: any) => Promise<unknown>> = {
	get_players: getPlayers,
	get_matches: getMatches,
	get_season_standings: getSeasonStandings,
	get_seasons: getSeasons,
	get_player_stats: getPlayerStats,
	get_head_to_head: getHeadToHead,
	get_scoring_stats: getScoringStats,
	get_streaks: getStreaks,
	get_elo_progression: getEloProgression,
	get_form_guide: getFormGuide,
	get_team_chemistry: getTeamChemistry,
	get_session_stats: getSessionStats,
	get_biggest_margins: getBiggestMargins,
	get_closest_matches: getClosestMatches,
	get_upsets: getUpsets,
	get_recent_matches: getRecentMatches,
	get_match_by_id: getMatchById,
	get_fixtures: getFixtures,
	get_season_progress: getSeasonProgress,
	get_achievements: getAchievements,
	get_unbeaten_runs: getUnbeatenRuns,
	get_most_improved: getMostImproved,
	get_player_activity: getPlayerActivity,
	get_player_peak: getPlayerPeak,
	get_team_standings: getTeamStandings,
	get_team_stats: getTeamStats,
	get_comparison: getComparison,
	get_win_probability: getWinProbability,
	get_rivalries: getRivalries,
	get_league_records: getLeagueRecords,
	get_season_highlights: getSeasonHighlights,
	get_fairness_index: getFairnessIndex,
	get_busiest_periods: getBusiestPeriods,
	get_active_sessions: getActiveSessions,
	get_session_lineup: getSessionLineup,
	query_database: executeQuery,
};

interface MCPRequest {
	jsonrpc: "2.0";
	id: string | number | null;
	method: string;
	params?: Record<string, unknown>;
}

interface MCPError {
	code: number;
	message: string;
	data?: unknown;
}

function createResponse(id: string | number | null, result: unknown) {
	return { jsonrpc: "2.0" as const, id, result };
}

function createError(id: string | number | null, error: MCPError) {
	return { jsonrpc: "2.0" as const, id, error };
}

export const mcpRouter = new Hono<HonoEnv>().use("*", mcpAuthMiddleware).post("/", async (c) => {
	const auth = c.get("authentication")!;
	const db = c.get("db");
	const env = c.env;
	const userAssets = c.get("userAssets");

	const activeOrganizationId = auth.session.activeOrganizationId;
	if (!activeOrganizationId) {
		return c.json(
			createError(null, {
				code: -32001,
				message: "No active league selected. Set an active league in the Scorebrawl web app.",
			}),
			400
		);
	}

	let body: MCPRequest;
	try {
		body = await c.req.json<MCPRequest>();
	} catch {
		return c.json(createError(null, { code: -32700, message: "Parse error: invalid JSON" }), 400);
	}
	const { id, method, params = {} } = body;

	if (method === "initialize") {
		return c.json(
			createResponse(id, {
				protocolVersion: "2024-11-05",
				capabilities: { tools: {} },
				serverInfo: { name: "scorebrawl-mcp", version: "0.1.0" },
			})
		);
	}

	if (method === "tools/list") {
		const mcpTools = tools
			.filter((tool) => !CLIENT_ONLY_TOOLS.has(tool.name))
			.map((tool) => ({
				name: tool.name,
				description: tool.description,
				inputSchema: tool.parameters,
			}));
		return c.json(createResponse(id, { tools: mcpTools }));
	}

	if (method === "tools/call") {
		const { name, arguments: args } = params as {
			name: string;
			arguments: Record<string, unknown>;
		};
		const executor = toolExecutors[name];
		if (!executor) {
			return c.json(
				createError(id, {
					code: -32601,
					message: `Tool "${name}" not found`,
				}),
				404
			);
		}

		try {
			const toolCtx = {
				db,
				organizationId: activeOrganizationId,
				userAssets,
				env,
			};
			const result = await executor(toolCtx, { leagueId: activeOrganizationId, ...args });
			return c.json(
				createResponse(id, { content: [{ type: "text", text: JSON.stringify(result) }] })
			);
		} catch (err) {
			console.error(`[MCP] Tool "${name}" failed:`, err);
			return c.json(
				createError(id, {
					code: -32603,
					message: err instanceof Error ? err.message : "Tool execution failed",
				}),
				500
			);
		}
	}

	return c.json(
		createError(id, {
			code: -32601,
			message: `Method "${method}" not found`,
		}),
		404
	);
});
