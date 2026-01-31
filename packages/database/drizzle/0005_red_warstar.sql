CREATE INDEX IF NOT EXISTS "match_player_season_player_id_idx" ON "match_player" USING btree ("season_player_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "match_player_match_id_idx" ON "match_player" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "match_created_at_idx" ON "match" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "season_player_season_id_idx" ON "season_player" USING btree ("season_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "season_team_season_id_idx" ON "season_team" USING btree ("season_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "team_matches_season_team_id_idx" ON "season_team_match" USING btree ("season_team_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "team_matches_match_id_idx" ON "season_team_match" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "team_matches_created_at_idx" ON "season_team_match" USING btree ("created_at");