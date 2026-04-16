import {
	sqliteTable,
	text,
	integer,
	real,
	index,
	uniqueIndex,
	check,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { user, league } from "./auth-schema";
import { timestampAuditFields } from "./common";

export const guest = sqliteTable(
	"guest",
	{
		id: text("id").primaryKey(),
		email: text("email").notNull().unique(),
		displayName: text("display_name").notNull(),
		...timestampAuditFields,
	},
	(table) => [index("guest_email_idx").on(table.email)]
);

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
		userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
		guestId: text("guest_id").references(() => guest.id, { onDelete: "cascade" }),
		leagueId: text("league_id")
			.notNull()
			.references(() => league.id, { onDelete: "cascade" }),
		disabled: integer("disabled", { mode: "boolean" }).default(false).notNull(),
		...timestampAuditFields,
	},
	(table) => [
		check("player_user_or_guest_check", sql`(user_id IS NOT NULL OR guest_id IS NOT NULL)`),
		uniqueIndex("player_organization_user_uidx")
			.on(table.leagueId, table.userId)
			.where(sql`${table.userId} IS NOT NULL`),
		uniqueIndex("player_organization_guest_uidx")
			.on(table.leagueId, table.guestId)
			.where(sql`${table.guestId} IS NOT NULL`),
		index("player_user_id_idx").on(table.userId),
		index("player_guest_id_idx").on(table.guestId),
	]
);

export const leagueTeam = sqliteTable(
	"league_team",
	{
		id: text("id").primaryKey(),
		name: text("name").notNull(),
		logo: text("logo"),
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

export const gameSession = sqliteTable(
	"game_session",
	{
		id: text("id").primaryKey(),
		seasonId: text("season_id")
			.notNull()
			.references(() => season.id, { onDelete: "cascade" }),
		createdBy: text("created_by")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		status: text("status", { enum: ["active", "ended"] })
			.notNull()
			.default("active"),
		rotationMode: text("rotation_mode", {
			enum: ["winner-stays", "manual"],
		}).notNull(),
		teamSize: integer("team_size").notNull(),
		maxConsecutiveGames: integer("max_consecutive_games"),
		alwaysSplitConstraints: text("always_split_constraints"),
		autoRandomize: integer("auto_randomize", { mode: "boolean" }).default(false).notNull(),
		autoCoinToss: integer("auto_coin_toss", { mode: "boolean" }).default(false).notNull(),
		randomizerType: text("randomizer_type", {
			enum: ["fisher-yates", "diversity"],
		})
			.default("fisher-yates")
			.notNull(),
		winnersTakePriority: integer("winners_take_priority", { mode: "boolean" })
			.default(false)
			.notNull(),
		maxConsecutiveEnabled: integer("max_consecutive_enabled", { mode: "boolean" })
			.default(false)
			.notNull(),
		proposedLineup: text("proposed_lineup"),
		modeSettings: text("mode_settings"),
		endedAt: integer("ended_at", { mode: "timestamp" }),
		...timestampAuditFields,
	},
	(table) => [
		index("game_session_season_id_idx").on(table.seasonId),
		index("game_session_season_status_idx").on(table.seasonId, table.status),
	]
);

export const sessionPlayer = sqliteTable(
	"session_player",
	{
		id: text("id").primaryKey(),
		sessionId: text("session_id")
			.notNull()
			.references(() => gameSession.id, { onDelete: "cascade" }),
		seasonPlayerId: text("season_player_id")
			.notNull()
			.references(() => seasonPlayer.id, { onDelete: "cascade" }),
		status: text("status", { enum: ["waiting", "playing", "out"] })
			.notNull()
			.default("waiting"),
		queuePosition: integer("queue_position").notNull(),
		gamesPlayedThisSession: integer("games_played_this_session").notNull().default(0),
		consecutiveGames: integer("consecutive_games").notNull().default(0),
		joinedAt: integer("joined_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
		...timestampAuditFields,
	},
	(table) => [
		uniqueIndex("session_player_session_season_player_uidx").on(
			table.sessionId,
			table.seasonPlayerId
		),
		index("session_player_session_id_idx").on(table.sessionId),
		index("session_player_session_status_idx").on(table.sessionId, table.status),
	]
);

export const sessionMatch = sqliteTable(
	"session_match",
	{
		id: text("id").primaryKey(),
		sessionId: text("session_id")
			.notNull()
			.references(() => gameSession.id, { onDelete: "cascade" }),
		// Note: This cascade doesn't fire in current code because deleteLastMatch deletes
		// the session_match row first, then deletes the match. The cascade would only
		// trigger if a match was deleted directly while session_match rows still reference it.
		matchId: text("match_id").references(() => match.id, { onDelete: "cascade" }),
		matchNumber: integer("match_number").notNull(),
		homePlayerIds: text("home_player_ids").notNull(),
		awayPlayerIds: text("away_player_ids").notNull(),
		result: text("result", { enum: ["home", "away", "draw"] }),
		homeSessionScore: integer("home_session_score").notNull().default(0),
		awaySessionScore: integer("away_session_score").notNull().default(0),
		selectedHomePlayerIds: text("selected_home_player_ids"),
		selectedAwayPlayerIds: text("selected_away_player_ids"),
		...timestampAuditFields,
	},
	(table) => [
		index("session_match_session_id_idx").on(table.sessionId),
		index("session_match_match_id_idx").on(table.matchId),
		index("session_match_session_result_idx").on(table.sessionId, table.result),
	]
);

export const sessionCoinToss = sqliteTable(
	"session_coin_toss",
	{
		id: text("id").primaryKey(),
		sessionId: text("session_id")
			.notNull()
			.references(() => gameSession.id, { onDelete: "cascade" }),
		sessionMatchId: text("session_match_id").references(() => sessionMatch.id, {
			onDelete: "cascade",
		}),
		conflictType: text("conflict_type", {
			enum: ["loser-rotation", "max-consecutive-exceeded", "draw-tiebreak"],
		}).notNull(),
		candidates: text("candidates").notNull(),
		resolved: integer("resolved", { mode: "boolean" }).notNull().default(false),
		resolvedWinnerIds: text("resolved_winner_ids"),
		...timestampAuditFields,
	},
	(table) => [index("session_coin_toss_session_id_idx").on(table.sessionId)]
);
