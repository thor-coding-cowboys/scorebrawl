import { leagueAchievementType } from "@/model";
import { cuidConfig } from "@scorebrawl/utils/id";
import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

const defaultVarcharConfig = { length: 100 };

export const Leagues = pgTable(
  "league",
  {
    id: varchar("id", cuidConfig).primaryKey(),
    name: varchar("name", defaultVarcharConfig).notNull(),
    slug: varchar("name_slug", defaultVarcharConfig).notNull(),
    logoUrl: varchar("logo_url", defaultVarcharConfig),
    archived: boolean("archived").default(false).notNull(),
    createdBy: varchar("created_by").notNull(),
    updatedBy: varchar("updated_by").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (league) => [uniqueIndex("league_name_slug_uq_idx").on(league.slug)],
);

export const LeaguePlayers = pgTable(
  "league_player",
  {
    id: varchar("id", cuidConfig).primaryKey(),
    userId: varchar("user_id", defaultVarcharConfig)
      .notNull()
      .references(() => Users.id),
    leagueId: varchar("league_id", cuidConfig)
      .notNull()
      .references(() => Leagues.id),
    disabled: boolean("disabled").default(false).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (player) => [uniqueIndex("league_player_uq_idx").on(player.leagueId, player.userId)],
);

export const LeagueTeams = pgTable("league_team", {
  id: varchar("id", cuidConfig).primaryKey(),
  name: varchar("name", defaultVarcharConfig).notNull(),
  leagueId: varchar("league_id", cuidConfig)
    .notNull()
    .references(() => Leagues.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const LeagueTeamPlayers = pgTable(
  "league_team_player",
  {
    id: varchar("id", cuidConfig).primaryKey(),
    leaguePlayerId: varchar("league_player_id", cuidConfig)
      .notNull()
      .references(() => LeaguePlayers.id),
    teamId: varchar("team_id", cuidConfig)
      .notNull()
      .references(() => LeagueTeams.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (leagueTeamPlayer) => [
    uniqueIndex("league_team_player_uq_idx").on(
      leagueTeamPlayer.teamId,
      leagueTeamPlayer.leaguePlayerId,
    ),
  ],
);

export const leagueMemberRoles = ["viewer", "member", "editor", "owner"] as const;

export const LeagueMembers = pgTable(
  "league_member",
  {
    id: varchar("id", cuidConfig).primaryKey(),
    userId: varchar("user_id", defaultVarcharConfig).notNull(),
    leagueId: varchar("league_id", cuidConfig)
      .notNull()
      .references(() => Leagues.id),
    role: varchar("role", {
      enum: leagueMemberRoles,
    }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (player) => [uniqueIndex("league_member_uq_idx").on(player.leagueId, player.userId)],
);

const scoreType = ["elo", "3-1-0", "elo-individual-vs-team"] as const;

export const Seasons = pgTable(
  "season",
  {
    id: varchar("id", cuidConfig).primaryKey(),
    name: varchar("name", defaultVarcharConfig).notNull(),
    slug: varchar("name_slug", defaultVarcharConfig).notNull(),
    initialScore: integer("initial_score").notNull(),
    scoreType: varchar("score_type", { enum: scoreType }).notNull(),
    kFactor: integer("k_factor").notNull(),
    startDate: timestamp("start_date").notNull(),
    endDate: timestamp("end_date"),
    rounds: integer("rounds"),
    leagueId: varchar("league_id", cuidConfig)
      .notNull()
      .references(() => Leagues.id),
    closed: boolean("closed").default(false).notNull(),
    createdBy: varchar("created_by").notNull(),
    updatedBy: varchar("updated_by").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (season) => [uniqueIndex("season_name_slug_uq_idx").on(season.slug)],
);

export const SeasonFixtures = pgTable("season_fixture", {
  id: varchar("id", cuidConfig).primaryKey(),
  round: integer("round").notNull(),
  seasonId: varchar("season_id", cuidConfig)
    .notNull()
    .references(() => Seasons.id),
  matchId: varchar("match_id", cuidConfig).references(() => Matches.id),
  homePlayerId: varchar("home_player_id", cuidConfig)
    .notNull()
    .references(() => SeasonPlayers.id),
  awayPlayerId: varchar("away_player_id", cuidConfig)
    .notNull()
    .references(() => SeasonPlayers.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const SeasonTeams = pgTable(
  "season_team",
  {
    id: varchar("id", cuidConfig).primaryKey(),
    seasonId: varchar("season_id", cuidConfig)
      .notNull()
      .references(() => Seasons.id),
    teamId: varchar("team_id", cuidConfig)
      .notNull()
      .references(() => LeagueTeams.id),
    score: integer("score").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (seasonTeam) => [
    uniqueIndex("season_team_uq_idx").on(seasonTeam.seasonId, seasonTeam.teamId),
    index("season_team_season_id_idx").on(seasonTeam.seasonId),
  ],
);

const matchResult = ["W", "L", "D"] as const;

export const MatchTeams = pgTable(
  "season_team_match",
  {
    id: varchar("id", cuidConfig).primaryKey(),
    seasonTeamId: varchar("season_team_id", cuidConfig)
      .notNull()
      .references(() => SeasonTeams.id),
    matchId: varchar("match_id", cuidConfig)
      .notNull()
      .references(() => Matches.id),
    scoreBefore: integer("score_before").notNull().default(-1),
    scoreAfter: integer("score_after").notNull().default(-1),
    result: varchar("result", { enum: matchResult }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (teamMatch) => [
    index("team_matches_season_team_id_idx").on(teamMatch.seasonTeamId),
    index("team_matches_match_id_idx").on(teamMatch.matchId),
    index("team_matches_created_at_idx").on(teamMatch.createdAt),
  ],
);

export const SeasonPlayers = pgTable(
  "season_player",
  {
    id: varchar("id", cuidConfig).primaryKey(),
    seasonId: varchar("season_id", cuidConfig)
      .notNull()
      .references(() => Seasons.id),
    leaguePlayerId: varchar("league_player_id", cuidConfig)
      .notNull()
      .references(() => LeaguePlayers.id),
    score: integer("score").notNull(),
    disabled: boolean("disabled").default(false).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (season) => [
    uniqueIndex("season_player_uq_idx").on(season.seasonId, season.leaguePlayerId),
    index("season_player_season_id_idx").on(season.seasonId),
  ],
);

export const Matches = pgTable(
  "match",
  {
    id: varchar("id", cuidConfig).primaryKey(),
    seasonId: varchar("season_id", cuidConfig)
      .notNull()
      .references(() => Seasons.id),
    homeScore: integer("home_score").notNull(),
    awayScore: integer("away_score").notNull(),
    homeExpectedElo: real("home_expected_elo"),
    awayExpectedElo: real("away_expected_elo"),
    createdBy: varchar("created_by").notNull(),
    updatedBy: varchar("updated_by").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (match) => [index("match_created_at_idx").on(match.createdAt)],
);

export const MatchPlayers = pgTable(
  "match_player",
  {
    id: varchar("id", cuidConfig).primaryKey(),
    seasonPlayerId: varchar("season_player_id", cuidConfig)
      .notNull()
      .references(() => SeasonPlayers.id),
    homeTeam: boolean("home_team").notNull(),
    matchId: varchar("match_id", cuidConfig)
      .notNull()
      .references(() => Matches.id),
    scoreBefore: integer("score_before").notNull().default(-1),
    scoreAfter: integer("score_after").notNull().default(-1),
    result: varchar("result", { enum: matchResult }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (matchPlayer) => [
    index("match_player_season_player_id_idx").on(matchPlayer.seasonPlayerId),
    index("match_player_match_id_idx").on(matchPlayer.matchId),
  ],
);

export const LeagueInvites = pgTable(
  "league_invite",
  {
    id: varchar("id", cuidConfig).primaryKey(),
    leagueId: varchar("league_id")
      .references(() => Leagues.id)
      .notNull(),
    role: varchar("role", { enum: leagueMemberRoles }).notNull(),
    code: varchar("code", cuidConfig).notNull(),
    expiresAt: timestamp("expires_at"),
    createdBy: varchar("created_by").notNull(),
    updatedBy: varchar("updated_by").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (invite) => [uniqueIndex("league_invite_code_uq_idx").on(invite.code)],
);

export const Users = pgTable("user", {
  id: varchar("id", { length: 100 }).primaryKey(),
  image: varchar("image"),
  name: varchar("name").notNull(),
  email: text("email"),
  emailVerified: boolean("email_verified"),
  defaultLeagueId: varchar("default_league_id", cuidConfig).references(() => Leagues.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const Sessions = pgTable("session", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .references(() => Users.id)
    .notNull(),
  token: text("token"),
  expiresAt: timestamp("expires_at"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  updatedAt: timestamp("updated_at"),
  createdAt: timestamp("created_at"),
});

export const Accounts = pgTable("account", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .references(() => Users.id)
    .notNull(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  expiresAt: timestamp("expires_at"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  password: text("password"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const Verifications = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  updatedAt: timestamp("updated_at"),
  createdAt: timestamp("created_at"),
});

export const LeaguePlayerAchievement = pgTable(
  "league_player_achievement",
  {
    id: varchar("id", cuidConfig).primaryKey(),
    leaguePlayerId: varchar("league_player_id", cuidConfig)
      .notNull()
      .references(() => LeaguePlayers.id),
    type: varchar("type_id", { enum: leagueAchievementType }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (achievement) => [
    uniqueIndex("league_player_achievement_uq_idx").on(
      achievement.leaguePlayerId,
      achievement.type,
    ),
  ],
);

export const leaguesRelations = relations(Leagues, ({ many }) => ({
  seasons: many(Seasons),
  invites: many(LeagueInvites),
  leaguePlayers: many(LeaguePlayers),
  leagueTeams: many(LeagueTeams),
  members: many(LeagueMembers),
}));

export const leagueInvitesRelations = relations(LeagueInvites, ({ one }) => ({
  league: one(Leagues, {
    fields: [LeagueInvites.leagueId],
    references: [Leagues.id],
  }),
}));

export const seasonTeamRelations = relations(SeasonTeams, ({ one, many }) => ({
  leagueTeam: one(LeagueTeams, {
    fields: [SeasonTeams.teamId],
    references: [LeagueTeams.id],
  }),
  season: one(Seasons, {
    fields: [SeasonTeams.seasonId],
    references: [Seasons.id],
  }),
  matches: many(MatchTeams),
}));

export const userRelations = relations(Users, ({ many }) => ({
  leaguePlayers: many(LeaguePlayers),
}));

export const leaguePlayerRelations = relations(LeaguePlayers, ({ one, many }) => ({
  user: one(Users, {
    fields: [LeaguePlayers.userId],
    references: [Users.id],
  }),
  league: one(Leagues, {
    fields: [LeaguePlayers.leagueId],
    references: [Leagues.id],
  }),
  teamPlayer: many(LeagueTeamPlayers),
  seasonPlayers: many(SeasonPlayers),
}));

export const leagueTeamRelations = relations(LeagueTeams, ({ one, many }) => ({
  league: one(Leagues, {
    fields: [LeagueTeams.leagueId],
    references: [Leagues.id],
  }),
  players: many(LeagueTeamPlayers),
}));

export const leagueTeamPlayerRelations = relations(LeagueTeamPlayers, ({ one }) => ({
  team: one(LeagueTeams, {
    fields: [LeagueTeamPlayers.teamId],
    references: [LeagueTeams.id],
  }),
  leaguePlayer: one(LeaguePlayers, {
    fields: [LeagueTeamPlayers.leaguePlayerId],
    references: [LeaguePlayers.id],
  }),
}));

export const leagueMemberRelations = relations(LeagueMembers, ({ one }) => ({
  league: one(Leagues, {
    fields: [LeagueMembers.leagueId],
    references: [Leagues.id],
  }),
}));

export const seasonRelations = relations(Seasons, ({ one, many }) => ({
  seasonPlayers: many(SeasonPlayers),
  matches: many(Matches),
  seasonTeams: many(SeasonTeams),
  league: one(Leagues, {
    fields: [Seasons.leagueId],
    references: [Leagues.id],
  }),
}));

export const seasonPlayerRelations = relations(SeasonPlayers, ({ one, many }) => ({
  season: one(Seasons, {
    fields: [SeasonPlayers.seasonId],
    references: [Seasons.id],
  }),
  leaguePlayer: one(LeaguePlayers, {
    fields: [SeasonPlayers.leaguePlayerId],
    references: [LeaguePlayers.id],
  }),
  matches: many(MatchPlayers),
}));

export const seasonTeamMatchRelations = relations(MatchTeams, ({ one }) => ({
  match: one(Matches, {
    fields: [MatchTeams.matchId],
    references: [Matches.id],
  }),
  seasonTeam: one(SeasonTeams, {
    fields: [MatchTeams.seasonTeamId],
    references: [SeasonTeams.id],
  }),
}));

export const matchRelations = relations(Matches, ({ one, many }) => ({
  matchPlayers: many(MatchPlayers),
  season: one(Seasons, {
    fields: [Matches.seasonId],
    references: [Seasons.id],
  }),
  teamMatches: many(MatchTeams),
}));

export const matchPlayerRelations = relations(MatchPlayers, ({ one }) => ({
  match: one(Matches, {
    fields: [MatchPlayers.matchId],
    references: [Matches.id],
  }),
  seasonPlayer: one(SeasonPlayers, {
    fields: [MatchPlayers.seasonPlayerId],
    references: [SeasonPlayers.id],
  }),
}));
