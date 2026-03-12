ALTER TABLE `game_session` ADD `proposed_lineup` text;--> statement-breakpoint
ALTER TABLE `session_match` ADD `home_session_score` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `session_match` ADD `away_session_score` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `session_match` ADD `selected_home_player_ids` text;--> statement-breakpoint
ALTER TABLE `session_match` ADD `selected_away_player_ids` text;