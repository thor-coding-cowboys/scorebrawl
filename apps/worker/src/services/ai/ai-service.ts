import { eq } from "drizzle-orm";
import type { getDb } from "../../db";
import { aiConversation, aiMessage } from "../../db/schema/ai-schema";
import { createId } from "../../utils/id-util";
import { decryptApiKey } from "./encryption";
import { createLLMClient, type LLMMessage } from "./llm-client";
import { tools } from "./tool-registry";
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
} from "./tool-executors";
import { executeQuery } from "./tool-executors/query-builder";

function summarizeToolResult(toolName: string, result: unknown): string {
	if (!result || typeof result !== "object") return JSON.stringify(result);
	if ("error" in (result as Record<string, unknown>)) return JSON.stringify(result);

	if (Array.isArray(result)) {
		const count = result.length;
		if (count === 0) return "[]";
		const sample = result.slice(0, 3);
		const keys = Object.keys(sample[0] ?? {}).join(", ");
		return JSON.stringify({
			_summary: `${count} items (fields: ${keys})`,
			_count: count,
			sample,
		});
	}

	const obj = result as Record<string, unknown>;
	if (toolName === "get_player_stats" && "opponents" in obj) {
		const opponents = obj.opponents as Array<Record<string, unknown>>;
		return JSON.stringify({
			...obj,
			opponents: opponents.slice(0, 5),
			_opponentCount: opponents.length,
		});
	}

	if (toolName === "get_head_to_head" && "matches" in obj) {
		const matches = obj.matches as Array<Record<string, unknown>>;
		return JSON.stringify({
			...obj,
			matches: matches.slice(0, 5),
			_matchCount: matches.length,
		});
	}

	return JSON.stringify(result);
}

function buildSystemPrompt(userName: string) {
	return `You are a helpful assistant for a sports league management app called Scorebrawl. You are scoped to the user's current league — all tool calls automatically target this league, so never ask the user for a league ID.

The current user is "${userName}". When they ask about "my" stats or performance, look up their data by name.

You can answer questions about league data including player stats, match history, season standings, and win rates. Always be concise and data-driven. When presenting data, format it clearly using markdown tables or lists. If you don't have access to requested data, say so clearly.

When the user asks for graphs, charts, or visual statistics, use the render_chart tool to display interactive charts. First fetch the necessary data using the data tools, then call render_chart with processed data. You can render multiple charts in one response. After rendering a chart, briefly describe what it shows.

Use the appropriate specialized tool for common questions:
- Goals, top scorers, scoring stats → get_scoring_stats
- Streaks, consecutive wins/losses → get_streaks
- ELO trends, rating history → get_elo_progression
- Game sessions → get_session_stats
- Teammate performance, chemistry → get_team_chemistry
- Recent form, trends → get_form_guide
- Biggest blowouts, largest margins → get_biggest_margins
- Close games, tight matches → get_closest_matches
- Upsets, unexpected results → get_upsets
- Recent matches, this week → get_recent_matches
- Specific match details → get_match_by_id
- Fixtures, schedule, who still needs to play → get_fixtures
- Season progress, completion → get_season_progress
- Achievements, badges → get_achievements
- Unbeaten runs → get_unbeaten_runs
- Most improved players → get_most_improved
- Player activity, last played → get_player_activity
- Player peak, best stretch → get_player_peak
- Team standings → get_team_standings
- Team stats → get_team_stats
- Player comparisons → get_comparison
- Win probability, predictions → get_win_probability
- Rivalries, frequent opponents → get_rivalries
- League records, all-time bests → get_league_records
- Season highlights, notable moments → get_season_highlights
- Fairness, balance → get_fairness_index
- Busiest periods, most active times → get_busiest_periods
- Active sessions, who's playing now → get_active_sessions
- Session lineup, queue → get_session_lineup
- Complex database queries not covered above → query_database

Do NOT attempt to compute aggregations from raw match data returned by get_matches. The specialized tools return pre-computed results.`;
}

export interface ChatStreamOptions {
	db: ReturnType<typeof getDb>;
	conversationId: string;
	encryptionKey: string;
	provider: "openai" | "opencode";
	model: string;
	encryptedApiKey: string;
	leagueId: string;
	userName: string;
}

export interface ChatStreamEvent {
	type: "text" | "tool_call" | "tool_result" | "chart" | "error" | "done";
	content?: string;
	toolName?: string;
	toolArgs?: string;
	error?: string;
	chart?: {
		type: "bar" | "line" | "pie";
		title: string;
		data: Array<Record<string, unknown>>;
		xKey?: string;
		yKeys?: string[];
	};
}

export async function* createChatStream(
	options: ChatStreamOptions
): AsyncGenerator<ChatStreamEvent> {
	const {
		db,
		conversationId,
		encryptionKey,
		provider,
		model,
		encryptedApiKey,
		leagueId,
		userName,
	} = options;

	let apiKey: string;
	try {
		apiKey = await decryptApiKey(encryptedApiKey, encryptionKey);
	} catch {
		yield { type: "error", error: "Failed to decrypt API key" };
		return;
	}

	const llm = createLLMClient({ provider, model, apiKey });

	// Load conversation history
	const history = await db
		.select({
			role: aiMessage.role,
			content: aiMessage.content,
			toolName: aiMessage.toolName,
			toolArgs: aiMessage.toolArgs,
			toolResult: aiMessage.toolResult,
			toolCallId: aiMessage.toolCallId,
			reasoningContent: aiMessage.reasoningContent,
		})
		.from(aiMessage)
		.where(eq(aiMessage.conversationId, conversationId))
		.orderBy(aiMessage.createdAt);

	const messages: LLMMessage[] = [{ role: "system", content: buildSystemPrompt(userName) }];

	for (const h of history) {
		if (h.role === "tool") {
			messages.push({
				role: "tool",
				content: h.toolResult ?? "",
				tool_call_id: h.toolCallId ?? "",
			});
		} else if (h.role === "assistant" && h.toolArgs) {
			try {
				const toolCalls = JSON.parse(h.toolArgs) as LLMMessage["tool_calls"];
				messages.push({
					role: "assistant",
					content: h.content,
					tool_calls: toolCalls,
					reasoning_content: h.reasoningContent ?? undefined,
				});
			} catch {
				messages.push({ role: "assistant", content: h.content });
			}
		} else {
			messages.push({ role: h.role as "user" | "assistant", content: h.content });
		}
	}

	// The last message should be the user message that was just added
	const assistantContent: string[] = [];
	let toolCallCount = 0;
	const maxToolCalls = 5;

	while (toolCallCount < maxToolCalls) {
		const stream = llm.streamChat(messages, tools);
		const currentToolCalls: Array<{ id: string; name: string; arguments: string }> = [];
		let currentReasoningContent: string | undefined;

		for await (const chunk of stream) {
			if (chunk.type === "text") {
				assistantContent.push(chunk.content);
				yield { type: "text", content: chunk.content };
			} else if (chunk.type === "tool_call") {
				currentToolCalls.push({
					id: chunk.id,
					name: chunk.name,
					arguments: chunk.arguments,
				});
				yield {
					type: "tool_call",
					toolName: chunk.name,
					toolArgs: chunk.arguments,
				};
			} else if (chunk.type === "done") {
				currentReasoningContent = chunk.reasoningContent;
			}
		}

		if (currentToolCalls.length === 0) {
			break;
		}

		toolCallCount += currentToolCalls.length;

		// Add assistant message with tool calls
		const toolCallsData = currentToolCalls.map((tc) => ({
			id: tc.id,
			type: "function" as const,
			function: { name: tc.name, arguments: tc.arguments },
		}));

		messages.push({
			role: "assistant",
			content: assistantContent.join("") || "",
			tool_calls: toolCallsData,
			reasoning_content: currentReasoningContent,
		});

		// Save intermediate assistant message with tool calls
		await db.insert(aiMessage).values({
			id: createId(),
			conversationId,
			role: "assistant",
			content: assistantContent.join("") || "",
			toolArgs: JSON.stringify(toolCallsData),
			reasoningContent: currentReasoningContent ?? null,
		});

		// Execute tools
		for (const tc of currentToolCalls) {
			let result: unknown;
			try {
				const args = JSON.parse(tc.arguments) as Record<string, unknown>;
				const ctx = { db };

				if (tc.name === "render_chart") {
					yield {
						type: "chart",
						chart: {
							type: args.type as "bar" | "line" | "pie",
							title: args.title as string,
							data: args.data as Array<Record<string, unknown>>,
							xKey: args.xKey as string | undefined,
							yKeys: args.yKeys as string[] | undefined,
						},
					};
					result = { rendered: true };
				} else {
					switch (tc.name) {
						case "get_players":
							result = await getPlayers(ctx, { leagueId });
							break;
						case "get_seasons":
							result = await getSeasons(ctx, { leagueId });
							break;
						case "get_matches":
							result = await getMatches(ctx, {
								leagueId,
								seasonSlug: args.seasonSlug as string | undefined,
								playerName: args.playerName as string | undefined,
								limit: args.limit as number | undefined,
							});
							break;
						case "get_season_standings":
							result = await getSeasonStandings(ctx, {
								seasonSlug: args.seasonSlug as string,
							});
							break;
						case "get_player_stats":
							result = await getPlayerStats(ctx, {
								leagueId,
								playerName: args.playerName as string,
								seasonSlug: args.seasonSlug as string | undefined,
							});
							break;
						case "get_head_to_head":
							result = await getHeadToHead(ctx, {
								leagueId,
								player1Name: args.player1Name as string,
								player2Name: args.player2Name as string,
								seasonSlug: args.seasonSlug as string | undefined,
							});
							break;
						case "get_scoring_stats":
							result = await getScoringStats(ctx, {
								leagueId,
								seasonSlug: args.seasonSlug as string | undefined,
								playerName: args.playerName as string | undefined,
							});
							break;
						case "get_streaks":
							result = await getStreaks(ctx, {
								leagueId,
								playerName: args.playerName as string,
								seasonSlug: args.seasonSlug as string | undefined,
							});
							break;
						case "get_elo_progression":
							result = await getEloProgression(ctx, {
								leagueId,
								playerName: args.playerName as string | undefined,
								seasonSlug: args.seasonSlug as string | undefined,
								limit: args.limit as number | undefined,
							});
							break;
						case "get_form_guide":
							result = await getFormGuide(ctx, {
								leagueId,
								playerName: args.playerName as string | undefined,
								seasonSlug: args.seasonSlug as string | undefined,
								matches: args.matches as number | undefined,
							});
							break;
						case "get_team_chemistry":
							result = await getTeamChemistry(ctx, {
								leagueId,
								playerName: args.playerName as string,
								seasonSlug: args.seasonSlug as string | undefined,
							});
							break;
						case "get_session_stats":
							result = await getSessionStats(ctx, {
								leagueId,
								playerName: args.playerName as string | undefined,
								seasonSlug: args.seasonSlug as string | undefined,
							});
							break;
						case "query_database":
							result = await executeQuery(ctx, {
								leagueId,
								description: args.description as string,
								table: args.table as string,
								select: args.select as string[] | undefined,
								joins: args.joins as
									| Array<{
											table: string;
											type?: "left" | "inner";
											on: { left: string; right: string };
									  }>
									| undefined,
								where: args.where as
									| Array<{
											column: string;
											op: "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "like" | "in";
											value: string | number | string[] | number[];
									  }>
									| undefined,
								groupBy: args.groupBy as string[] | undefined,
								orderBy: args.orderBy as { column: string; direction?: "asc" | "desc" } | undefined,
								limit: args.limit as number | undefined,
							});
							break;
						case "get_biggest_margins":
							result = await getBiggestMargins(ctx, {
								leagueId,
								seasonSlug: args.seasonSlug as string | undefined,
								limit: args.limit as number | undefined,
							});
							break;
						case "get_closest_matches":
							result = await getClosestMatches(ctx, {
								leagueId,
								seasonSlug: args.seasonSlug as string | undefined,
								limit: args.limit as number | undefined,
							});
							break;
						case "get_upsets":
							result = await getUpsets(ctx, {
								leagueId,
								seasonSlug: args.seasonSlug as string | undefined,
								limit: args.limit as number | undefined,
							});
							break;
						case "get_recent_matches":
							result = await getRecentMatches(ctx, {
								leagueId,
								days: args.days as number | undefined,
								seasonSlug: args.seasonSlug as string | undefined,
								playerName: args.playerName as string | undefined,
								limit: args.limit as number | undefined,
							});
							break;
						case "get_match_by_id":
							result = await getMatchById(ctx, {
								matchId: args.matchId as string,
							});
							break;
						case "get_fixtures":
							result = await getFixtures(ctx, {
								seasonSlug: args.seasonSlug as string,
								playerName: args.playerName as string | undefined,
							});
							break;
						case "get_season_progress":
							result = await getSeasonProgress(ctx, {
								seasonSlug: args.seasonSlug as string,
							});
							break;
						case "get_achievements":
							result = await getAchievements(ctx, {
								leagueId,
								playerName: args.playerName as string | undefined,
								seasonSlug: args.seasonSlug as string | undefined,
							});
							break;
						case "get_unbeaten_runs":
							result = await getUnbeatenRuns(ctx, {
								leagueId,
								playerName: args.playerName as string | undefined,
								seasonSlug: args.seasonSlug as string | undefined,
								limit: args.limit as number | undefined,
							});
							break;
						case "get_most_improved":
							result = await getMostImproved(ctx, {
								leagueId,
								seasonSlug: args.seasonSlug as string | undefined,
								days: args.days as number | undefined,
								limit: args.limit as number | undefined,
							});
							break;
						case "get_player_activity":
							result = await getPlayerActivity(ctx, {
								leagueId,
								playerName: args.playerName as string,
								seasonSlug: args.seasonSlug as string | undefined,
							});
							break;
						case "get_player_peak":
							result = await getPlayerPeak(ctx, {
								leagueId,
								playerName: args.playerName as string,
								seasonSlug: args.seasonSlug as string | undefined,
								windowSize: args.windowSize as number | undefined,
							});
							break;
						case "get_team_standings":
							result = await getTeamStandings(ctx, {
								seasonSlug: args.seasonSlug as string,
							});
							break;
						case "get_team_stats":
							result = await getTeamStats(ctx, {
								seasonSlug: args.seasonSlug as string | undefined,
								teamName: args.teamName as string | undefined,
							});
							break;
						case "get_comparison":
							result = await getComparison(ctx, {
								leagueId,
								player1Name: args.player1Name as string,
								player2Name: args.player2Name as string,
								seasonSlug: args.seasonSlug as string | undefined,
							});
							break;
						case "get_win_probability":
							result = await getWinProbability(ctx, {
								leagueId,
								player1Name: args.player1Name as string,
								player2Name: args.player2Name as string,
								seasonSlug: args.seasonSlug as string | undefined,
							});
							break;
						case "get_rivalries":
							result = await getRivalries(ctx, {
								leagueId,
								seasonSlug: args.seasonSlug as string | undefined,
								limit: args.limit as number | undefined,
							});
							break;
						case "get_league_records":
							result = await getLeagueRecords(ctx, {
								leagueId,
								recordType: args.recordType as string | undefined,
							});
							break;
						case "get_season_highlights":
							result = await getSeasonHighlights(ctx, {
								seasonSlug: args.seasonSlug as string,
							});
							break;
						case "get_fairness_index":
							result = await getFairnessIndex(ctx, {
								leagueId,
								seasonSlug: args.seasonSlug as string | undefined,
							});
							break;
						case "get_busiest_periods":
							result = await getBusiestPeriods(ctx, {
								leagueId,
								seasonSlug: args.seasonSlug as string | undefined,
								granularity: args.granularity as string | undefined,
								limit: args.limit as number | undefined,
							});
							break;
						case "get_active_sessions":
							result = await getActiveSessions(ctx, {
								leagueId,
								seasonSlug: args.seasonSlug as string | undefined,
							});
							break;
						case "get_session_lineup":
							result = await getSessionLineup(ctx, {
								sessionId: args.sessionId as string,
							});
							break;
						default:
							result = { error: `Unknown tool: ${tc.name}` };
					}
				}
			} catch (err) {
				result = { error: err instanceof Error ? err.message : String(err) };
			}

			const resultStr = JSON.stringify(result);

			// Send full data to LLM for current processing
			messages.push({
				role: "tool",
				content: resultStr,
				tool_call_id: tc.id,
			});

			// Save a compact summary to DB for history replay
			const summaryStr = summarizeToolResult(tc.name, result);
			await db.insert(aiMessage).values({
				id: createId(),
				conversationId,
				role: "tool",
				content: summaryStr,
				toolName: tc.name,
				toolArgs: tc.arguments,
				toolResult: summaryStr,
				toolCallId: tc.id,
			});

			yield { type: "tool_result", toolName: tc.name };
		}

		assistantContent.length = 0;
	}

	// Save final assistant message
	const finalContent = assistantContent.join("");
	if (finalContent) {
		await db.insert(aiMessage).values({
			id: createId(),
			conversationId,
			role: "assistant",
			content: finalContent,
		});
	}

	// Update conversation title if it's still default
	const conv = await db
		.select({ title: aiConversation.title })
		.from(aiConversation)
		.where(eq(aiConversation.id, conversationId))
		.limit(1);

	if (conv[0]?.title === "New conversation") {
		const firstUserMsg = history.find((h) => h.role === "user");
		if (firstUserMsg) {
			const newTitle = firstUserMsg.content.slice(0, 50);
			await db
				.update(aiConversation)
				.set({ title: newTitle })
				.where(eq(aiConversation.id, conversationId));
		}
	}

	yield { type: "done" };
}
