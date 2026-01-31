CREATE TABLE IF NOT EXISTS "league_event" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"league_id" varchar(32) NOT NULL,
	"type" varchar NOT NULL,
	"data" json,
	"created_by" varchar(100) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "league_member" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"user_id" varchar(100) NOT NULL,
	"league_id" varchar(32) NOT NULL,
	"role" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "league_player" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"user_id" varchar(100) NOT NULL,
	"league_id" varchar(32) NOT NULL,
	"disabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "league_team_player" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"league_player_id" varchar(32) NOT NULL,
	"team_id" varchar(32) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "league_team" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"league_id" varchar(32) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "league" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"name_slug" varchar(100) NOT NULL,
	"logo_url" varchar(100),
	"visibility" varchar DEFAULT 'public' NOT NULL,
	"code" varchar(32) NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_by" varchar NOT NULL,
	"updated_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "match_player" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"season_player_id" varchar(32) NOT NULL,
	"home_team" boolean NOT NULL,
	"match_id" varchar(32) NOT NULL,
	"score_before" integer DEFAULT -1 NOT NULL,
	"score_after" integer DEFAULT -1 NOT NULL,
	"elo_before" integer DEFAULT -1 NOT NULL,
	"elo_after" integer DEFAULT -1 NOT NULL,
	"result" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "match" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"season_id" varchar(32) NOT NULL,
	"home_score" integer NOT NULL,
	"away_score" integer NOT NULL,
	"home_expected_elo" real NOT NULL,
	"away_expected_elo" real NOT NULL,
	"created_by" varchar NOT NULL,
	"updated_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "season_player" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"season_id" varchar(32) NOT NULL,
	"league_player_id" varchar(32) NOT NULL,
	"elo" integer NOT NULL,
	"score" integer NOT NULL,
	"disabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "season_team" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"season_id" varchar(32) NOT NULL,
	"team_id" varchar(32) NOT NULL,
	"score" integer NOT NULL,
	"elo" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "season" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"name_slug" varchar(100) NOT NULL,
	"initial_score" integer NOT NULL,
	"initial_elo" integer NOT NULL,
	"score_type" varchar NOT NULL,
	"k_factor" integer NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp,
	"league_id" varchar(32) NOT NULL,
	"created_by" varchar NOT NULL,
	"updated_by" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "season_team_match" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"season_team_id" varchar(32) NOT NULL,
	"match_id" varchar(32) NOT NULL,
	"score_before" integer DEFAULT -1 NOT NULL,
	"score_after" integer DEFAULT -1 NOT NULL,
	"elo_before" integer DEFAULT -1 NOT NULL,
	"elo_after" integer DEFAULT -1 NOT NULL,
	"result" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user" (
	"id" varchar(100) PRIMARY KEY NOT NULL,
	"image_url" varchar(255) NOT NULL,
	"name" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "league_member_uq_idx" ON "league_member" USING btree ("league_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "league_player_uq_idx" ON "league_player" USING btree ("league_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "league_team_player_uq_idx" ON "league_team_player" USING btree ("team_id","league_player_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "league_name_slug_uq_idx" ON "league" USING btree ("name_slug");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "league_code_uq_idx" ON "league" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "season_player_uq_idx" ON "season_player" USING btree ("season_id","league_player_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "season_team_uq_idx" ON "season_team" USING btree ("season_id","team_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "season_name_slug_uq_idx" ON "season" USING btree ("name_slug");