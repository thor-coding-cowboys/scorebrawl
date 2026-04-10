ALTER TABLE `game_session` ADD `mode_settings` text;--> statement-breakpoint
ALTER TABLE `game_session` ADD `randomizer_type` text DEFAULT 'fisher-yates' NOT NULL;