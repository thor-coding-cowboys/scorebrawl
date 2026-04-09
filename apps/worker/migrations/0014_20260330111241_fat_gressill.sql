ALTER TABLE `game_session` ADD `winners_take_priority` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `game_session` ADD `max_consecutive_enabled` integer DEFAULT 0 NOT NULL;