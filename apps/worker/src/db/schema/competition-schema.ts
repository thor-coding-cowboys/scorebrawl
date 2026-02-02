import { sqliteTable, text, integer, real, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { user, organization } from "./auth-schema";
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
		organizationId: text("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		disabled: integer("disabled", { mode: "boolean" }).default(false).notNull(),
		...timestampAuditFields,
	},
	(table) => [
		uniqueIndex("player_organization_user_uidx").on(table.organizationId, table.userId),
		index("player_organization_id_idx").on(table.organizationId),
		index("player_user_id_idx").on(table.userId),
	]
);

export const orgTeam = sqliteTable(
	"org_team",
	{
		id: text("id").primaryKey(),
		name: text("name").notNull(),
		organizationId: text("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		...timestampAuditFields,
	},
	(table) => [index("org_team_organization_id_idx").on(table.organizationId)]
);

export const orgTeamPlayer = sqliteTable(
	"org_team_player",
	{
		id: text("id").primaryKey(),
		playerId: text("player_id")
			.notNull()
			.references(() => player.id, { onDelete: "cascade" }),
		orgTeamId: text("org_team_id")
			.notNull()
			.references(() => orgTeam.id, { onDelete: "cascade" }),
		...timestampAuditFields,
	},
	(table) => [
		uniqueIndex("org_team_player_team_player_uidx").on(table.orgTeamId, table.playerId),
		index("org_team_player_team_id_idx").on(table.orgTeamId),
		index("org_team_player_player_id_idx").on(table.playerId),
	]
);

export const competition = sqliteTable(
	"competition",
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
		organizationId: text("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		archived: integer("archived", { mode: "boolean" }).default(false).notNull(),
		closed: integer("closed", { mode: "boolean" }).default(false).notNull(),
		createdBy: text("created_by").notNull(),
		updatedBy: text("updated_by").notNull(),
		...timestampAuditFields,
	},
	(table) => [
		uniqueIndex("competition_slug_uidx").on(table.slug),
		index("competition_organization_id_idx").on(table.organizationId),
	]
);

export const competitionPlayer = sqliteTable(
	"competition_player",
	{
		id: text("id").primaryKey(),
		competitionId: text("competition_id")
			.notNull()
			.references(() => competition.id, { onDelete: "cascade" }),
		playerId: text("player_id")
			.notNull()
			.references(() => player.id, { onDelete: "cascade" }),
		score: integer("score").notNull(),
		disabled: integer("disabled", { mode: "boolean" }).default(false).notNull(),
		...timestampAuditFields,
	},
	(table) => [
		uniqueIndex("competition_player_competition_player_uidx").on(
			table.competitionId,
			table.playerId
		),
		index("competition_player_competition_id_idx").on(table.competitionId),
		index("competition_player_player_id_idx").on(table.playerId),
	]
);

export const competitionTeam = sqliteTable(
	"competition_team",
	{
		id: text("id").primaryKey(),
		competitionId: text("competition_id")
			.notNull()
			.references(() => competition.id, { onDelete: "cascade" }),
		orgTeamId: text("org_team_id")
			.notNull()
			.references(() => orgTeam.id, { onDelete: "cascade" }),
		score: integer("score").notNull(),
		...timestampAuditFields,
	},
	(table) => [
		uniqueIndex("competition_team_competition_team_uidx").on(table.competitionId, table.orgTeamId),
		index("competition_team_competition_id_idx").on(table.competitionId),
		index("competition_team_org_team_id_idx").on(table.orgTeamId),
	]
);

export const match = sqliteTable(
	"match",
	{
		id: text("id").primaryKey(),
		competitionId: text("competition_id")
			.notNull()
			.references(() => competition.id, { onDelete: "cascade" }),
		homeScore: integer("home_score").notNull(),
		awayScore: integer("away_score").notNull(),
		homeExpectedElo: real("home_expected_elo"),
		awayExpectedElo: real("away_expected_elo"),
		createdBy: text("created_by").notNull(),
		updatedBy: text("updated_by").notNull(),
		...timestampAuditFields,
	},
	(table) => [
		index("match_competition_id_idx").on(table.competitionId),
		index("match_created_at_idx").on(table.createdAt),
	]
);

export const matchPlayer = sqliteTable(
	"match_player",
	{
		id: text("id").primaryKey(),
		competitionPlayerId: text("competition_player_id")
			.notNull()
			.references(() => competitionPlayer.id, { onDelete: "cascade" }),
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
		index("match_player_competition_player_id_idx").on(table.competitionPlayerId),
		index("match_player_match_id_idx").on(table.matchId),
	]
);

export const matchTeam = sqliteTable(
	"match_team",
	{
		id: text("id").primaryKey(),
		competitionTeamId: text("competition_team_id")
			.notNull()
			.references(() => competitionTeam.id, { onDelete: "cascade" }),
		matchId: text("match_id")
			.notNull()
			.references(() => match.id, { onDelete: "cascade" }),
		scoreBefore: integer("score_before").notNull().default(-1),
		scoreAfter: integer("score_after").notNull().default(-1),
		result: text("result", { enum: matchResult }).notNull(),
		...timestampAuditFields,
	},
	(table) => [
		index("match_team_competition_team_id_idx").on(table.competitionTeamId),
		index("match_team_match_id_idx").on(table.matchId),
		index("match_team_created_at_idx").on(table.createdAt),
	]
);

export const fixture = sqliteTable(
	"fixture",
	{
		id: text("id").primaryKey(),
		round: integer("round").notNull(),
		competitionId: text("competition_id")
			.notNull()
			.references(() => competition.id, { onDelete: "cascade" }),
		matchId: text("match_id").references(() => match.id, { onDelete: "set null" }),
		homePlayerId: text("home_player_id")
			.notNull()
			.references(() => competitionPlayer.id, { onDelete: "cascade" }),
		awayPlayerId: text("away_player_id")
			.notNull()
			.references(() => competitionPlayer.id, { onDelete: "cascade" }),
		...timestampAuditFields,
	},
	(table) => [
		index("fixture_competition_id_idx").on(table.competitionId),
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
	(table) => [
		uniqueIndex("player_achievement_player_type_uidx").on(table.playerId, table.type),
		index("player_achievement_player_id_idx").on(table.playerId),
	]
);
