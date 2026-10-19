import { z } from "zod";

export interface Tool {
	name: string;
	description: string;
	inputSchema: z.ZodObject;
}

export const tools: Tool[] = [
	{
		name: "get_players",
		description:
			"Get all players in the league with their aggregate stats: score, matches played, wins, losses.",
		inputSchema: z.object({}),
	},
	{
		name: "get_seasons",
		description:
			"List all seasons in the league with their name, slug, score type, and status (archived/closed).",
		inputSchema: z.object({}),
	},
	{
		name: "get_matches",
		description:
			"Get matches in the league. Can filter by season and/or player name. Returns matching matches with scores, players, and results. Limited to 50 by default.",
		inputSchema: z.object({
			seasonSlug: z.string().describe("Filter by season slug").optional(),
			playerName: z
				.string()
				.describe("Filter to only matches involving this player (partial name match)")
				.optional(),
			limit: z.number().describe("Maximum matches to return (default 50, max 100)").optional(),
		}),
	},
	{
		name: "get_season_standings",
		description:
			"Get the full standings for a season. Returns ranked list of all players with scores.",
		inputSchema: z.object({
			seasonSlug: z.string().describe("The season slug to get standings for"),
		}),
	},
	{
		name: "get_player_stats",
		description:
			"Get detailed stats for a specific player: win rate, match history summary, score progression, and per-opponent breakdown showing wins/losses against each opponent.",
		inputSchema: z.object({
			playerName: z.string().describe("Player name to look up (partial match supported)"),
			seasonSlug: z.string().describe("Optional season slug to scope stats to").optional(),
			includeForm: z.boolean().describe("Include recent form data (last 5 matches)").default(false),
		}),
	},
	{
		name: "get_head_to_head",
		description:
			"Get head-to-head record between two players. Shows all matches they played together/against each other, win/loss record, and score history.",
		inputSchema: z.object({
			player1Name: z.string().describe("First player name"),
			player2Name: z.string().describe("Second player name"),
			seasonSlug: z.string().describe("Optional season slug to scope to").optional(),
		}),
	},
	{
		name: "get_scoring_stats",
		description:
			"Get scoring statistics for all players or a specific player. Returns goals scored, goals conceded, goals per match average, best/worst scoring games, and net goal difference. Use this when asked about goals, top scorers, goal-related stats, or who scored the most. Since individual goals are not tracked, goals are attributed at the team level — each player on the scoring team gets credited with that team's goals.",
		inputSchema: z.object({
			seasonSlug: z.string().describe("Filter by season slug. Omit for all seasons.").optional(),
			playerName: z
				.string()
				.describe("Filter to a specific player. Omit for all players.")
				.optional(),
		}),
	},
	{
		name: "get_streaks",
		description:
			"Get win/loss streak information for a player. Returns current streak, longest win streak, longest loss streak, and last 5 match results. Use this when asked about streaks, runs, or consecutive wins/losses.",
		inputSchema: z.object({
			playerName: z.string().describe("The player name to analyze"),
			seasonSlug: z.string().describe("Filter by season slug. Omit for all seasons.").optional(),
		}),
	},
	{
		name: "get_elo_progression",
		description:
			"Get ELO rating progression over time. Returns match-by-match score changes, biggest gains/drops, and current score. Use when asked about ELO trends, rating changes, or score history. If no player specified, returns top players for comparison.",
		inputSchema: z.object({
			playerName: z
				.string()
				.describe("Filter to a specific player. Omit for top players comparison.")
				.optional(),
			seasonSlug: z.string().describe("Filter by season slug. Omit for all seasons.").optional(),
			limit: z.number().describe("Number of matches to return (default 20, max 50)").optional(),
		}),
	},
	{
		name: "get_session_stats",
		description:
			"Get game session statistics. Returns sessions played, games per session, longest winner-stays streak, and session win rate. Use when asked about sessions or game session performance.",
		inputSchema: z.object({
			playerName: z
				.string()
				.describe("Filter to a specific player. Omit for all players.")
				.optional(),
			seasonSlug: z.string().describe("Filter by season slug. Omit for all seasons.").optional(),
		}),
	},
	{
		name: "get_team_chemistry",
		description:
			"Analyze how well a player performs with each teammate. Returns win rate when paired together, matches played together, best and worst teammates. Use when asked about teammate performance, chemistry, or partnership stats.",
		inputSchema: z.object({
			playerName: z.string().describe("The player name to analyze"),
			seasonSlug: z.string().describe("Filter by season slug. Omit for all seasons.").optional(),
		}),
	},
	{
		name: "get_form_guide",
		description:
			"Get recent form analysis. Returns last N match results, trend direction (improving/declining/stable), and win rate. Use when asked about recent performance, form, or how someone is doing lately.",
		inputSchema: z.object({
			playerName: z
				.string()
				.describe("Filter to a specific player. Omit for all players.")
				.optional(),
			seasonSlug: z.string().describe("Filter by season slug. Omit for all seasons.").optional(),
			matches: z
				.number()
				.describe("Number of recent matches to analyze (default 10, max 20)")
				.optional(),
		}),
	},
	{
		name: "query_database",
		description:
			"Execute a read-only database query described as JSON. Use ONLY when no specialized tool covers the question. The query is validated, limited to 100 rows, and always filtered by the current league. Returns raw query results.",
		inputSchema: z.object({
			description: z.string().describe("What you want to find (for logging/debugging)"),
			table: z
				.string()
				.describe("Primary table to query (e.g., 'match', 'player', 'seasonPlayer')"),
			select: z.array(z.string()).describe("Columns to select. Omit for all.").optional(),
			joins: z
				.array(
					z.object({
						table: z.string().optional(),
						type: z.enum(["left", "inner"]).default("left"),
						on: z
							.object({
								left: z.string().optional(),
								right: z.string().optional(),
							})
							.optional(),
					})
				)
				.describe("Joins to other tables")
				.optional(),
			where: z
				.array(
					z.object({
						column: z.string().optional(),
						op: z.enum(["eq", "ne", "gt", "gte", "lt", "lte", "like", "in"]).optional(),
						value: z.unknown().optional(),
					})
				)
				.describe("Filter conditions")
				.optional(),
			groupBy: z.array(z.string()).describe("Group by columns").optional(),
			orderBy: z
				.object({
					column: z.string().optional(),
					direction: z.enum(["asc", "desc"]).default("desc"),
				})
				.describe("Sort order")
				.optional(),
			limit: z.number().describe("Max rows to return (max 100)").default(50),
		}),
	},
	{
		name: "get_biggest_margins",
		description:
			"Find matches with the largest goal differential. Returns the biggest blowouts and most one-sided games. Use when asked about biggest wins, blowouts, or largest margins.",
		inputSchema: z.object({
			seasonSlug: z.string().describe("Filter by season slug").optional(),
			limit: z.number().describe("Number of matches to return (default 5)").optional(),
		}),
	},
	{
		name: "get_closest_matches",
		description:
			"Find the tightest matches — 1-goal margins or draws. Use when asked about close games, tight matches, or nail-biters.",
		inputSchema: z.object({
			seasonSlug: z.string().describe("Filter by season slug").optional(),
			limit: z.number().describe("Number of matches to return (default 5)").optional(),
		}),
	},
	{
		name: "get_upsets",
		description:
			"Find matches where the underdog won based on ELO expected values. Use when asked about upsets, surprises, or unexpected results.",
		inputSchema: z.object({
			seasonSlug: z.string().describe("Filter by season slug").optional(),
			limit: z.number().describe("Number of matches to return (default 5)").optional(),
		}),
	},
	{
		name: "get_recent_matches",
		description:
			"Get matches from the last N days. Use when asked about recent activity, this week, or lately.",
		inputSchema: z.object({
			days: z.number().describe("Number of days to look back (default 7)").optional(),
			seasonSlug: z.string().describe("Filter by season slug").optional(),
			playerName: z.string().describe("Filter to matches involving this player").optional(),
			limit: z.number().describe("Maximum matches to return (default 20)").optional(),
		}),
	},
	{
		name: "get_match_by_id",
		description:
			"Get full details for a specific match by ID. Use when the user references a specific match.",
		inputSchema: z.object({
			matchId: z.string().describe("The match ID to look up"),
		}),
	},
	{
		name: "get_fixtures",
		description:
			"Get remaining/unplayed fixtures for a season. Use when asked about upcoming games, schedule, or who still needs to play whom.",
		inputSchema: z.object({
			seasonSlug: z.string().describe("Season to get fixtures for"),
			playerName: z
				.string()
				.describe("Filter to fixtures involving this player (partial match)")
				.optional(),
		}),
	},
	{
		name: "get_season_progress",
		description:
			"Get season completion stats — matches played vs total, active players, days remaining. Use when asked how far through the season we are.",
		inputSchema: z.object({
			seasonSlug: z.string().describe("The season slug"),
		}),
	},
	{
		name: "get_achievements",
		description:
			"Get player achievements/badges. Use when asked about achievements, badges, milestones, or accomplishments.",
		inputSchema: z.object({
			playerName: z.string().describe("Filter to a specific player").optional(),
			seasonSlug: z.string().describe("Filter by season slug").optional(),
		}),
	},
	{
		name: "get_unbeaten_runs",
		description:
			"Find longest streaks without a loss for each player. Use when asked about unbeaten runs or who hasn't lost in a while.",
		inputSchema: z.object({
			playerName: z.string().describe("Filter to a specific player").optional(),
			seasonSlug: z.string().describe("Filter by season slug").optional(),
			limit: z.number().describe("Number of players to return (default 5)").optional(),
		}),
	},
	{
		name: "get_most_improved",
		description:
			"Find players who gained the most ELO/score over a time window. Use when asked about most improved or biggest climbers.",
		inputSchema: z.object({
			seasonSlug: z.string().describe("Filter by season slug").optional(),
			days: z.number().describe("Number of days to look back (default 30)").optional(),
			limit: z.number().describe("Number of players to return (default 5)").optional(),
		}),
	},
	{
		name: "get_player_activity",
		description:
			"Get activity stats for a player — last played, games per week, active weeks. Use when asked about activity, how often someone plays, or when they last played.",
		inputSchema: z.object({
			playerName: z.string().describe("Player name to look up"),
			seasonSlug: z.string().describe("Filter by season slug").optional(),
		}),
	},
	{
		name: "get_player_peak",
		description:
			"Find a player's best N-match window by win rate or ELO gain. Use when asked about best stretch, peak performance, or hot streak.",
		inputSchema: z.object({
			playerName: z.string().describe("Player name to analyze"),
			seasonSlug: z.string().describe("Filter by season slug").optional(),
			windowSize: z.number().describe("Window size in matches (default 5)").optional(),
		}),
	},
	{
		name: "get_team_standings",
		description:
			"Get season standings by team instead of individual player. Use when asked about team rankings or team standings.",
		inputSchema: z.object({
			seasonSlug: z.string().describe("The season slug"),
		}),
	},
	{
		name: "get_team_stats",
		description:
			"Get per-team aggregate stats including goals for/against and win rate. Use when asked about team performance or team stats.",
		inputSchema: z.object({
			seasonSlug: z.string().describe("Filter by season slug").optional(),
			teamName: z.string().describe("Filter to a specific team").optional(),
		}),
	},
	{
		name: "get_comparison",
		description:
			"Side-by-side comparison of two players across all key stats. Use when asked to compare players, who's better, or player vs player.",
		inputSchema: z.object({
			player1Name: z.string().describe("First player"),
			player2Name: z.string().describe("Second player"),
			seasonSlug: z.string().describe("Filter by season slug").optional(),
		}),
	},
	{
		name: "get_win_probability",
		description:
			"Predict win probability between two players based on current ELO/score. Use when asked who should win, predictions, or odds.",
		inputSchema: z.object({
			player1Name: z.string().describe("First player"),
			player2Name: z.string().describe("Second player"),
			seasonSlug: z.string().describe("Filter by season slug").optional(),
		}),
	},
	{
		name: "get_rivalries",
		description:
			"Find the most frequent head-to-head pairings in the league. Use when asked about rivalries, frequent opponents, or who plays whom the most.",
		inputSchema: z.object({
			seasonSlug: z.string().describe("Filter by season slug").optional(),
			limit: z.number().describe("Number of rivalries to return (default 5)").optional(),
		}),
	},
	{
		name: "get_league_records",
		description:
			"Get all-time records across all seasons — highest score, longest streak, biggest win, etc. Use when asked about records, all-time bests, or league history.",
		inputSchema: z.object({
			recordType: z
				.enum([
					"highest_score",
					"lowest_score",
					"longest_win_streak",
					"most_matches",
					"biggest_margin",
					"most_goals_game",
				])
				.describe("Specific record type to fetch. Omit for all records.")
				.optional(),
		}),
	},
	{
		name: "get_season_highlights",
		description:
			"Get auto-generated notable moments for a season — biggest upset, longest streak, most improved, etc. Use when asked about season highlights, interesting moments, or notable events.",
		inputSchema: z.object({
			seasonSlug: z.string().describe("The season slug"),
		}),
	},
	{
		name: "get_fairness_index",
		description:
			"Get league-wide balance metric — how often did the ELO-favored side actually win? Use when asked about fairness, balance, or match competitiveness.",
		inputSchema: z.object({
			seasonSlug: z.string().describe("Filter by season slug").optional(),
		}),
	},
	{
		name: "get_busiest_periods",
		description:
			"Find the days/weeks with the most matches played. Use when asked about busiest times, most active periods, or when most games happen.",
		inputSchema: z.object({
			seasonSlug: z.string().describe("Filter by season slug").optional(),
			granularity: z
				.enum(["day", "week"])
				.describe("Group by day or week (default week)")
				.optional(),
			limit: z.number().describe("Number of periods to return (default 5)").optional(),
		}),
	},
	{
		name: "get_active_sessions",
		description:
			"List currently active game sessions. Use when asked who's playing right now or about active sessions.",
		inputSchema: z.object({
			seasonSlug: z.string().describe("Filter by season slug").optional(),
		}),
	},
	{
		name: "get_session_lineup",
		description:
			"Get current queue/lineup for an active session. Use when asked about who's up next, the queue, or session rotation.",
		inputSchema: z.object({
			sessionId: z.string().describe("The session ID"),
		}),
	},
	{
		name: "render_chart",
		description:
			"Render an interactive chart for the user. Use this whenever the user asks for graphs, charts, or visual data. First fetch the data using other tools, then call render_chart with the processed data. Supports bar, line, and pie charts.",
		inputSchema: z.object({
			type: z.enum(["bar", "line", "pie"]).describe("Chart type"),
			title: z.string().describe("Chart title"),
			data: z
				.array(z.object({}))
				.describe(
					"Array of data objects. For bar/line: each object should have a label key and one or more numeric value keys. For pie: each object should have 'name' and 'value' keys."
				),
			xKey: z
				.string()
				.describe("Key in data objects to use for X axis labels (bar/line charts)")
				.optional(),
			yKeys: z
				.array(z.string())
				.describe(
					"Keys in data objects to use for Y axis values (bar/line charts). Multiple keys create grouped bars or multiple lines."
				)
				.optional(),
		}),
	},
];
