import { executeQuery } from "../../../services/mcp-tools/query-builder";
import * as executors from "../../../services/mcp-tools/tool-executors";
import { tools as registry } from "../../../services/mcp-tools/tool-registry";
import type { McpTool } from "../tool";
import { defineTool, jsonResult } from "../tool";
import { leagueFieldSchema, resolveLeagueId } from "./with-league";

/** Registry name → executor. Values are loosely typed, matching the old `mcp-router` map. */
const executorByName: Record<string, (ctx: any, args: any) => Promise<unknown>> = {
	get_players: executors.getPlayers,
	get_matches: executors.getMatches,
	get_season_standings: executors.getSeasonStandings,
	get_seasons: executors.getSeasons,
	get_player_stats: executors.getPlayerStats,
	get_head_to_head: executors.getHeadToHead,
	get_scoring_stats: executors.getScoringStats,
	get_streaks: executors.getStreaks,
	get_elo_progression: executors.getEloProgression,
	get_form_guide: executors.getFormGuide,
	get_team_chemistry: executors.getTeamChemistry,
	get_session_stats: executors.getSessionStats,
	get_biggest_margins: executors.getBiggestMargins,
	get_closest_matches: executors.getClosestMatches,
	get_upsets: executors.getUpsets,
	get_recent_matches: executors.getRecentMatches,
	get_match_by_id: executors.getMatchById,
	get_fixtures: executors.getFixtures,
	get_season_progress: executors.getSeasonProgress,
	get_achievements: executors.getAchievements,
	get_unbeaten_runs: executors.getUnbeatenRuns,
	get_most_improved: executors.getMostImproved,
	get_player_activity: executors.getPlayerActivity,
	get_player_peak: executors.getPlayerPeak,
	get_team_standings: executors.getTeamStandings,
	get_team_stats: executors.getTeamStats,
	get_comparison: executors.getComparison,
	get_win_probability: executors.getWinProbability,
	get_rivalries: executors.getRivalries,
	get_league_records: executors.getLeagueRecords,
	get_season_highlights: executors.getSeasonHighlights,
	get_fairness_index: executors.getFairnessIndex,
	get_busiest_periods: executors.getBusiestPeriods,
	get_active_sessions: executors.getActiveSessions,
	get_session_lineup: executors.getSessionLineup,
	query_database: executeQuery,
};

/**
 * Builds MCP tools from the registry. Each data tool gains an optional `league`
 * argument; the resolved `leagueId` is injected into the executor args.
 */
export function buildDataTools(): McpTool[] {
	return registry
		.filter((tool) => tool.name !== "render_chart")
		.map((tool) => {
			const executor = executorByName[tool.name];
			if (!executor) throw new Error(`No executor registered for tool "${tool.name}"`);
			const inputSchema = tool.inputSchema.extend(leagueFieldSchema);
			return defineTool({
				name: tool.name,
				description: tool.description,
				inputSchema,
				async execute(input, ctx) {
					const { league, ...args } = input as { league?: string } & Record<string, unknown>;
					const resolved = await resolveLeagueId(ctx, league);
					if ("error" in resolved)
						return { content: [{ type: "text", text: resolved.error }], isError: true };
					const result = await executor({ db: ctx.db }, { leagueId: resolved.leagueId, ...args });
					return jsonResult(result);
				},
			});
		});
}
