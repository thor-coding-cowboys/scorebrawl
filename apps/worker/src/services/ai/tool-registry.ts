import type { LLMTool } from "./llm-client";

export const tools: LLMTool[] = [
	{
		name: "get_players",
		description:
			"Get all players in the league with their aggregate stats: score, matches played, wins, losses.",
		parameters: {
			type: "object",
			properties: {},
		},
	},
	{
		name: "get_seasons",
		description:
			"List all seasons in the league with their name, slug, score type, and status (archived/closed).",
		parameters: {
			type: "object",
			properties: {},
		},
	},
	{
		name: "get_matches",
		description:
			"Get matches in the league. Can filter by season and/or player name. Returns matching matches with scores, players, and results. Limited to 50 by default.",
		parameters: {
			type: "object",
			properties: {
				seasonSlug: {
					type: "string",
					description: "Filter by season slug",
				},
				playerName: {
					type: "string",
					description: "Filter to only matches involving this player (partial name match)",
				},
				limit: {
					type: "number",
					description: "Maximum matches to return (default 50, max 100)",
				},
			},
		},
	},
	{
		name: "get_season_standings",
		description:
			"Get the full standings for a season. Returns ranked list of all players with scores.",
		parameters: {
			type: "object",
			properties: {
				seasonSlug: {
					type: "string",
					description: "The season slug to get standings for",
				},
			},
			required: ["seasonSlug"],
		},
	},
	{
		name: "get_player_stats",
		description:
			"Get detailed stats for a specific player: win rate, match history summary, score progression, and per-opponent breakdown showing wins/losses against each opponent.",
		parameters: {
			type: "object",
			properties: {
				playerName: {
					type: "string",
					description: "Player name to look up (partial match supported)",
				},
				seasonSlug: {
					type: "string",
					description: "Optional season slug to scope stats to",
				},
				includeForm: {
					type: "boolean",
					description: "Include recent form data (last 5 matches)",
					default: false,
				},
			},
			required: ["playerName"],
		},
	},
	{
		name: "get_head_to_head",
		description:
			"Get head-to-head record between two players. Shows all matches they played together/against each other, win/loss record, and score history.",
		parameters: {
			type: "object",
			properties: {
				player1Name: {
					type: "string",
					description: "First player name",
				},
				player2Name: {
					type: "string",
					description: "Second player name",
				},
				seasonSlug: {
					type: "string",
					description: "Optional season slug to scope to",
				},
			},
			required: ["player1Name", "player2Name"],
		},
	},
	{
		name: "get_scoring_stats",
		description:
			"Get scoring statistics for all players or a specific player. Returns goals scored, goals conceded, goals per match average, best/worst scoring games, and net goal difference. Use this when asked about goals, top scorers, goal-related stats, or who scored the most. Since individual goals are not tracked, goals are attributed at the team level — each player on the scoring team gets credited with that team's goals.",
		parameters: {
			type: "object",
			properties: {
				seasonSlug: {
					type: "string",
					description: "Filter by season slug. Omit for all seasons.",
				},
				playerName: {
					type: "string",
					description: "Filter to a specific player. Omit for all players.",
				},
			},
		},
	},
	{
		name: "get_streaks",
		description:
			"Get win/loss streak information for a player. Returns current streak, longest win streak, longest loss streak, and last 5 match results. Use this when asked about streaks, runs, or consecutive wins/losses.",
		parameters: {
			type: "object",
			properties: {
				playerName: {
					type: "string",
					description: "The player name to analyze",
				},
				seasonSlug: {
					type: "string",
					description: "Filter by season slug. Omit for all seasons.",
				},
			},
			required: ["playerName"],
		},
	},
	{
		name: "get_elo_progression",
		description:
			"Get ELO rating progression over time. Returns match-by-match score changes, biggest gains/drops, and current score. Use when asked about ELO trends, rating changes, or score history. If no player specified, returns top players for comparison.",
		parameters: {
			type: "object",
			properties: {
				playerName: {
					type: "string",
					description: "Filter to a specific player. Omit for top players comparison.",
				},
				seasonSlug: {
					type: "string",
					description: "Filter by season slug. Omit for all seasons.",
				},
				limit: {
					type: "number",
					description: "Number of matches to return (default 20, max 50)",
				},
			},
		},
	},
	{
		name: "get_session_stats",
		description:
			"Get game session statistics. Returns sessions played, games per session, longest winner-stays streak, and session win rate. Use when asked about sessions or game session performance.",
		parameters: {
			type: "object",
			properties: {
				playerName: {
					type: "string",
					description: "Filter to a specific player. Omit for all players.",
				},
				seasonSlug: {
					type: "string",
					description: "Filter by season slug. Omit for all seasons.",
				},
			},
		},
	},
	{
		name: "get_team_chemistry",
		description:
			"Analyze how well a player performs with each teammate. Returns win rate when paired together, matches played together, best and worst teammates. Use when asked about teammate performance, chemistry, or partnership stats.",
		parameters: {
			type: "object",
			properties: {
				playerName: {
					type: "string",
					description: "The player name to analyze",
				},
				seasonSlug: {
					type: "string",
					description: "Filter by season slug. Omit for all seasons.",
				},
			},
			required: ["playerName"],
		},
	},
	{
		name: "get_form_guide",
		description:
			"Get recent form analysis. Returns last N match results, trend direction (improving/declining/stable), and win rate. Use when asked about recent performance, form, or how someone is doing lately.",
		parameters: {
			type: "object",
			properties: {
				playerName: {
					type: "string",
					description: "Filter to a specific player. Omit for all players.",
				},
				seasonSlug: {
					type: "string",
					description: "Filter by season slug. Omit for all seasons.",
				},
				matches: {
					type: "number",
					description: "Number of recent matches to analyze (default 10, max 20)",
				},
			},
		},
	},
	{
		name: "query_database",
		description:
			"Execute a read-only database query described as JSON. Use ONLY when no specialized tool covers the question. The query is validated, limited to 100 rows, and always filtered by the current league. Returns raw query results.",
		parameters: {
			type: "object",
			properties: {
				description: {
					type: "string",
					description: "What you want to find (for logging/debugging)",
				},
				table: {
					type: "string",
					description: "Primary table to query (e.g., 'match', 'player', 'seasonPlayer')",
				},
				select: {
					type: "array",
					items: { type: "string" },
					description: "Columns to select. Omit for all.",
				},
				joins: {
					type: "array",
					items: {
						type: "object",
						properties: {
							table: { type: "string" },
							type: { type: "string", enum: ["left", "inner"], default: "left" },
							on: {
								type: "object",
								properties: {
									left: { type: "string" },
									right: { type: "string" },
								},
							},
						},
					},
					description: "Joins to other tables",
				},
				where: {
					type: "array",
					items: {
						type: "object",
						properties: {
							column: { type: "string" },
							op: {
								type: "string",
								enum: ["eq", "ne", "gt", "gte", "lt", "lte", "like", "in"],
							},
							value: {},
						},
					},
					description: "Filter conditions",
				},
				groupBy: {
					type: "array",
					items: { type: "string" },
					description: "Group by columns",
				},
				orderBy: {
					type: "object",
					properties: {
						column: { type: "string" },
						direction: { type: "string", enum: ["asc", "desc"], default: "desc" },
					},
					description: "Sort order",
				},
				limit: {
					type: "number",
					default: 50,
					description: "Max rows to return (max 100)",
				},
			},
			required: ["description", "table"],
		},
	},
	{
		name: "get_biggest_margins",
		description:
			"Find matches with the largest goal differential. Returns the biggest blowouts and most one-sided games. Use when asked about biggest wins, blowouts, or largest margins.",
		parameters: {
			type: "object",
			properties: {
				seasonSlug: {
					type: "string",
					description: "Filter by season slug",
				},
				limit: {
					type: "number",
					description: "Number of matches to return (default 5)",
				},
			},
		},
	},
	{
		name: "get_closest_matches",
		description:
			"Find the tightest matches — 1-goal margins or draws. Use when asked about close games, tight matches, or nail-biters.",
		parameters: {
			type: "object",
			properties: {
				seasonSlug: {
					type: "string",
					description: "Filter by season slug",
				},
				limit: {
					type: "number",
					description: "Number of matches to return (default 5)",
				},
			},
		},
	},
	{
		name: "get_upsets",
		description:
			"Find matches where the underdog won based on ELO expected values. Use when asked about upsets, surprises, or unexpected results.",
		parameters: {
			type: "object",
			properties: {
				seasonSlug: {
					type: "string",
					description: "Filter by season slug",
				},
				limit: {
					type: "number",
					description: "Number of matches to return (default 5)",
				},
			},
		},
	},
	{
		name: "get_recent_matches",
		description:
			"Get matches from the last N days. Use when asked about recent activity, this week, or lately.",
		parameters: {
			type: "object",
			properties: {
				days: {
					type: "number",
					description: "Number of days to look back (default 7)",
				},
				seasonSlug: {
					type: "string",
					description: "Filter by season slug",
				},
				playerName: {
					type: "string",
					description: "Filter to matches involving this player",
				},
				limit: {
					type: "number",
					description: "Maximum matches to return (default 20)",
				},
			},
		},
	},
	{
		name: "get_match_by_id",
		description:
			"Get full details for a specific match by ID. Use when the user references a specific match.",
		parameters: {
			type: "object",
			properties: {
				matchId: {
					type: "string",
					description: "The match ID to look up",
				},
			},
			required: ["matchId"],
		},
	},
	{
		name: "get_fixtures",
		description:
			"Get remaining/unplayed fixtures for a season. Use when asked about upcoming games, schedule, or who still needs to play whom.",
		parameters: {
			type: "object",
			properties: {
				seasonSlug: {
					type: "string",
					description: "Season to get fixtures for",
				},
				playerName: {
					type: "string",
					description: "Filter to fixtures involving this player (partial match)",
				},
			},
			required: ["seasonSlug"],
		},
	},
	{
		name: "get_season_progress",
		description:
			"Get season completion stats — matches played vs total, active players, days remaining. Use when asked how far through the season we are.",
		parameters: {
			type: "object",
			properties: {
				seasonSlug: {
					type: "string",
					description: "The season slug",
				},
			},
			required: ["seasonSlug"],
		},
	},
	{
		name: "get_achievements",
		description:
			"Get player achievements/badges. Use when asked about achievements, badges, milestones, or accomplishments.",
		parameters: {
			type: "object",
			properties: {
				playerName: {
					type: "string",
					description: "Filter to a specific player",
				},
				seasonSlug: {
					type: "string",
					description: "Filter by season slug",
				},
			},
		},
	},
	{
		name: "get_unbeaten_runs",
		description:
			"Find longest streaks without a loss for each player. Use when asked about unbeaten runs or who hasn't lost in a while.",
		parameters: {
			type: "object",
			properties: {
				playerName: {
					type: "string",
					description: "Filter to a specific player",
				},
				seasonSlug: {
					type: "string",
					description: "Filter by season slug",
				},
				limit: {
					type: "number",
					description: "Number of players to return (default 5)",
				},
			},
		},
	},
	{
		name: "get_most_improved",
		description:
			"Find players who gained the most ELO/score over a time window. Use when asked about most improved or biggest climbers.",
		parameters: {
			type: "object",
			properties: {
				seasonSlug: {
					type: "string",
					description: "Filter by season slug",
				},
				days: {
					type: "number",
					description: "Number of days to look back (default 30)",
				},
				limit: {
					type: "number",
					description: "Number of players to return (default 5)",
				},
			},
		},
	},
	{
		name: "get_player_activity",
		description:
			"Get activity stats for a player — last played, games per week, active weeks. Use when asked about activity, how often someone plays, or when they last played.",
		parameters: {
			type: "object",
			properties: {
				playerName: {
					type: "string",
					description: "Player name to look up",
				},
				seasonSlug: {
					type: "string",
					description: "Filter by season slug",
				},
			},
			required: ["playerName"],
		},
	},
	{
		name: "get_player_peak",
		description:
			"Find a player's best N-match window by win rate or ELO gain. Use when asked about best stretch, peak performance, or hot streak.",
		parameters: {
			type: "object",
			properties: {
				playerName: {
					type: "string",
					description: "Player name to analyze",
				},
				seasonSlug: {
					type: "string",
					description: "Filter by season slug",
				},
				windowSize: {
					type: "number",
					description: "Window size in matches (default 5)",
				},
			},
			required: ["playerName"],
		},
	},
	{
		name: "get_team_standings",
		description:
			"Get season standings by team instead of individual player. Use when asked about team rankings or team standings.",
		parameters: {
			type: "object",
			properties: {
				seasonSlug: {
					type: "string",
					description: "The season slug",
				},
			},
			required: ["seasonSlug"],
		},
	},
	{
		name: "get_team_stats",
		description:
			"Get per-team aggregate stats including goals for/against and win rate. Use when asked about team performance or team stats.",
		parameters: {
			type: "object",
			properties: {
				seasonSlug: {
					type: "string",
					description: "Filter by season slug",
				},
				teamName: {
					type: "string",
					description: "Filter to a specific team",
				},
			},
		},
	},
	{
		name: "get_comparison",
		description:
			"Side-by-side comparison of two players across all key stats. Use when asked to compare players, who's better, or player vs player.",
		parameters: {
			type: "object",
			properties: {
				player1Name: {
					type: "string",
					description: "First player",
				},
				player2Name: {
					type: "string",
					description: "Second player",
				},
				seasonSlug: {
					type: "string",
					description: "Filter by season slug",
				},
			},
			required: ["player1Name", "player2Name"],
		},
	},
	{
		name: "get_win_probability",
		description:
			"Predict win probability between two players based on current ELO/score. Use when asked who should win, predictions, or odds.",
		parameters: {
			type: "object",
			properties: {
				player1Name: {
					type: "string",
					description: "First player",
				},
				player2Name: {
					type: "string",
					description: "Second player",
				},
				seasonSlug: {
					type: "string",
					description: "Filter by season slug",
				},
			},
			required: ["player1Name", "player2Name"],
		},
	},
	{
		name: "get_rivalries",
		description:
			"Find the most frequent head-to-head pairings in the league. Use when asked about rivalries, frequent opponents, or who plays whom the most.",
		parameters: {
			type: "object",
			properties: {
				seasonSlug: {
					type: "string",
					description: "Filter by season slug",
				},
				limit: {
					type: "number",
					description: "Number of rivalries to return (default 5)",
				},
			},
		},
	},
	{
		name: "get_league_records",
		description:
			"Get all-time records across all seasons — highest score, longest streak, biggest win, etc. Use when asked about records, all-time bests, or league history.",
		parameters: {
			type: "object",
			properties: {
				recordType: {
					type: "string",
					enum: [
						"highest_score",
						"lowest_score",
						"longest_win_streak",
						"most_matches",
						"biggest_margin",
						"most_goals_game",
					],
					description: "Specific record type to fetch. Omit for all records.",
				},
			},
		},
	},
	{
		name: "get_season_highlights",
		description:
			"Get auto-generated notable moments for a season — biggest upset, longest streak, most improved, etc. Use when asked about season highlights, interesting moments, or notable events.",
		parameters: {
			type: "object",
			properties: {
				seasonSlug: {
					type: "string",
					description: "The season slug",
				},
			},
			required: ["seasonSlug"],
		},
	},
	{
		name: "get_fairness_index",
		description:
			"Get league-wide balance metric — how often did the ELO-favored side actually win? Use when asked about fairness, balance, or match competitiveness.",
		parameters: {
			type: "object",
			properties: {
				seasonSlug: {
					type: "string",
					description: "Filter by season slug",
				},
			},
		},
	},
	{
		name: "get_busiest_periods",
		description:
			"Find the days/weeks with the most matches played. Use when asked about busiest times, most active periods, or when most games happen.",
		parameters: {
			type: "object",
			properties: {
				seasonSlug: {
					type: "string",
					description: "Filter by season slug",
				},
				granularity: {
					type: "string",
					enum: ["day", "week"],
					description: "Group by day or week (default week)",
				},
				limit: {
					type: "number",
					description: "Number of periods to return (default 5)",
				},
			},
		},
	},
	{
		name: "get_active_sessions",
		description:
			"List currently active game sessions. Use when asked who's playing right now or about active sessions.",
		parameters: {
			type: "object",
			properties: {
				seasonSlug: {
					type: "string",
					description: "Filter by season slug",
				},
			},
		},
	},
	{
		name: "get_session_lineup",
		description:
			"Get current queue/lineup for an active session. Use when asked about who's up next, the queue, or session rotation.",
		parameters: {
			type: "object",
			properties: {
				sessionId: {
					type: "string",
					description: "The session ID",
				},
			},
			required: ["sessionId"],
		},
	},
	{
		name: "render_chart",
		description:
			"Render an interactive chart for the user. Use this whenever the user asks for graphs, charts, or visual data. First fetch the data using other tools, then call render_chart with the processed data. Supports bar, line, and pie charts.",
		parameters: {
			type: "object",
			properties: {
				type: {
					type: "string",
					enum: ["bar", "line", "pie"],
					description: "Chart type",
				},
				title: {
					type: "string",
					description: "Chart title",
				},
				data: {
					type: "array",
					items: { type: "object" },
					description:
						"Array of data objects. For bar/line: each object should have a label key and one or more numeric value keys. For pie: each object should have 'name' and 'value' keys.",
				},
				xKey: {
					type: "string",
					description: "Key in data objects to use for X axis labels (bar/line charts)",
				},
				yKeys: {
					type: "array",
					items: { type: "string" },
					description:
						"Keys in data objects to use for Y axis values (bar/line charts). Multiple keys create grouped bars or multiple lines.",
				},
			},
			required: ["type", "title", "data"],
		},
	},
];
