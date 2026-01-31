ALTER TABLE "match" ALTER COLUMN "home_expected_elo" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "match" ALTER COLUMN "away_expected_elo" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "match_player" DROP COLUMN IF EXISTS "elo_before";--> statement-breakpoint
ALTER TABLE "match_player" DROP COLUMN IF EXISTS "elo_after";--> statement-breakpoint
ALTER TABLE "season_player" DROP COLUMN IF EXISTS "elo";--> statement-breakpoint
ALTER TABLE "season_team" DROP COLUMN IF EXISTS "elo";--> statement-breakpoint
ALTER TABLE "season" DROP COLUMN IF EXISTS "initial_elo";--> statement-breakpoint
ALTER TABLE "season_team_match" DROP COLUMN IF EXISTS "elo_before";--> statement-breakpoint
ALTER TABLE "season_team_match" DROP COLUMN IF EXISTS "elo_after";