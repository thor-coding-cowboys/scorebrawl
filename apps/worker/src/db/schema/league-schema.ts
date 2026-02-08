import { sqliteTable, text, integer, real, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { user, league } from "./auth-schema";
import { timestampAuditFields } from "./common";

export const achievementType = [
	"5_win_streak",
	"10_win_streak",
	"15_win_streak",
	"3_win_loss_redemption",
	"5_win_loss_redemption",
	"8_win_loss_redemption",
	"5_clean_sheet_streak",
	"10_clean_sheet_streak",
	"15_clean_sheet_streak",
	"3_goals_5_games",
	"5_goals_5_games",
	"8_goals_5_games",
	"season_winner",
] as const;

export const scoreType = ["elo", "3-1-0", "elo-individual-vs-team"] as const;

export const matchResult = ["W", "L", "D"] as const;

export const player = sqliteTable(
	"player",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		leagueId: text("league_id")
			.notNull()
			.references(() => league.id, { onDelete: "cascade" }),
		disabled: integer("disabled", { mode: "boolean" }).default(false).notNull(),
		...timestampAuditFields,
	},
	(table) => [
		uniqueIndex("player_organization_user_uidx").on(table.leagueId, table.userId),
		index("player_user_id_idx").on(table.userId),
	]
);

export const leagueTeam = sqliteTable(
	"league_team",
	{
		id: text("id").primaryKey(),
		name: text("name").notNull(),
		leagueId: text("league_id")
			.notNull()
			.references(() => league.id, { onDelete: "cascade" }),
		...timestampAuditFields,
	},
	(table) => [index("league_team_league_id_idx").on(table.leagueId)]
);

export const leagueTeamPlayer = sqliteTable(
	"league_team_player",
	{
		id: text("id").primaryKey(),
		playerId: text("player_id")
			.notNull()
			.references(() => player.id, { onDelete: "cascade" }),
		leagueTeamId: text("league_team_id")
			.notNull()
			.references(() => leagueTeam.id, { onDelete: "cascade" }),
		...timestampAuditFields,
	},
	(table) => [
		uniqueIndex("league_team_player_team_player_uidx").on(table.leagueTeamId, table.playerId),
		index("league_team_player_player_id_idx").on(table.playerId),
	]
);

export const season = sqliteTable(
	"season",
	{
		id: text("id").primaryKey(),
		name: text("name").notNull(),
		slug: text("slug").notNull(),
		initialScore: integer("initial_score").notNull(),
		scoreType: text("score_type", { enum: scoreType }).notNull(),
		kFactor: integer("k_factor").notNull(),
		startDate: integer("start_date", { mode: "timestamp" }).notNull(),
		endDate: integer("end_date", { mode: "timestamp" }),
		rounds: integer("rounds"),
		leagueId: text("league_id")
			.notNull()
			.references(() => league.id, { onDelete: "cascade" }),
		archived: integer("archived", { mode: "boolean" }).default(false).notNull(),
		closed: integer("closed", { mode: "boolean" }).default(false).notNull(),
		createdBy: text("created_by").notNull(),
		updatedBy: text("updated_by").notNull(),
		...timestampAuditFields,
	},
	(table) => [uniqueIndex("season_slug_uidx").on(table.leagueId, table.slug)]
);

export const seasonPlayer = sqliteTable(
	"season_player",
	{
		id: text("id").primaryKey(),
		seasonId: text("season_id")
			.notNull()
			.references(() => season.id, { onDelete: "cascade" }),
		playerId: text("player_id")
			.notNull()
			.references(() => player.id, { onDelete: "cascade" }),
		score: integer("score").notNull(),
		disabled: integer("disabled", { mode: "boolean" }).default(false).notNull(),
		...timestampAuditFields,
	},
	(table) => [
		uniqueIndex("season_player_season_player_uidx").on(table.seasonId, table.playerId),
		index("season_player_player_id_idx").on(table.playerId),
	]
);

export const seasonTeam = sqliteTable(
	"season_team",
	{
		id: text("id").primaryKey(),
		seasonId: text("season_id")
			.notNull()
			.references(() => season.id, { onDelete: "cascade" }),
		leagueTeamId: text("league_team_id")
			.notNull()
			.references(() => leagueTeam.id, { onDelete: "cascade" }),
		score: integer("score").notNull(),
		...timestampAuditFields,
	},
	(table) => [
		uniqueIndex("season_team_season_team_uidx").on(table.seasonId, table.leagueTeamId),
		index("season_team_league_team_id_idx").on(table.leagueTeamId),
	]
);

export const match = sqliteTable(
	"match",
	{
		id: text("id").primaryKey(),
		seasonId: text("season_id")
			.notNull()
			.references(() => season.id, { onDelete: "cascade" }),
		homeScore: integer("home_score").notNull(),
		awayScore: integer("away_score").notNull(),
		homeExpectedElo: real("home_expected_elo"),
		awayExpectedElo: real("away_expected_elo"),
		createdBy: text("created_by").notNull(),
		updatedBy: text("updated_by").notNull(),
		...timestampAuditFields,
	},
	(table) => [index("match_season_created_idx").on(table.seasonId, table.createdAt)]
);

export const matchPlayer = sqliteTable(
	"match_player",
	{
		id: text("id").primaryKey(),
		seasonPlayerId: text("season_player_id")
			.notNull()
			.references(() => seasonPlayer.id, { onDelete: "cascade" }),
		homeTeam: integer("home_team", { mode: "boolean" }).notNull(),
		matchId: text("match_id")
			.notNull()
			.references(() => match.id, { onDelete: "cascade" }),
		scoreBefore: integer("score_before").notNull().default(-1),
		scoreAfter: integer("score_after").notNull().default(-1),
		result: text("result", { enum: matchResult }).notNull(),
		...timestampAuditFields,
	},
	(table) => [
		index("match_player_match_id_idx").on(table.matchId),
		index("match_player_season_player_result_idx").on(table.seasonPlayerId, table.result),
		index("match_player_season_player_created_idx").on(table.seasonPlayerId, table.createdAt),
	]
);

export const matchTeam = sqliteTable(
	"match_team",
	{
		id: text("id").primaryKey(),
		seasonTeamId: text("season_team_id")
			.notNull()
			.references(() => seasonTeam.id, { onDelete: "cascade" }),
		matchId: text("match_id")
			.notNull()
			.references(() => match.id, { onDelete: "cascade" }),
		scoreBefore: integer("score_before").notNull().default(-1),
		scoreAfter: integer("score_after").notNull().default(-1),
		result: text("result", { enum: matchResult }).notNull(),
		...timestampAuditFields,
	},
	(table) => [
		index("match_team_season_team_id_idx").on(table.seasonTeamId),
		index("match_team_match_id_idx").on(table.matchId),
		index("match_team_created_at_idx").on(table.createdAt),
	]
);

export const fixture = sqliteTable(
	"fixture",
	{
		id: text("id").primaryKey(),
		round: integer("round").notNull(),
		seasonId: text("season_id")
			.notNull()
			.references(() => season.id, { onDelete: "cascade" }),
		matchId: text("match_id").references(() => match.id, { onDelete: "set null" }),
		homePlayerId: text("home_player_id")
			.notNull()
			.references(() => seasonPlayer.id, { onDelete: "cascade" }),
		awayPlayerId: text("away_player_id")
			.notNull()
			.references(() => seasonPlayer.id, { onDelete: "cascade" }),
		...timestampAuditFields,
	},
	(table) => [
		index("fixture_season_id_idx").on(table.seasonId),
		index("fixture_match_id_idx").on(table.matchId),
	]
);

export const playerAchievement = sqliteTable(
	"player_achievement",
	{
		id: text("id").primaryKey(),
		playerId: text("player_id")
			.notNull()
			.references(() => player.id, { onDelete: "cascade" }),
		type: text("type", { enum: achievementType }).notNull(),
		...timestampAuditFields,
	},
	(table) => [uniqueIndex("player_achievement_player_type_uidx").on(table.playerId, table.type)]
);
