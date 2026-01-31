CREATE TABLE "season_fixture" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"round" integer NOT NULL,
	"season_id" varchar(32) NOT NULL,
	"match_id" varchar(32),
	"home_player_id" varchar(32),
	"away_player_id" varchar(32),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "season" ADD COLUMN "rounds" integer;--> statement-breakpoint
ALTER TABLE "season_fixture" ADD CONSTRAINT "season_fixture_season_id_season_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."season"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "season_fixture" ADD CONSTRAINT "season_fixture_match_id_match_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."match"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "season_fixture" ADD CONSTRAINT "season_fixture_home_player_id_season_player_id_fk" FOREIGN KEY ("home_player_id") REFERENCES "public"."season_player"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "season_fixture" ADD CONSTRAINT "season_fixture_away_player_id_season_player_id_fk" FOREIGN KEY ("away_player_id") REFERENCES "public"."season_player"("id") ON DELETE no action ON UPDATE no action;