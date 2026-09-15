CREATE TABLE `push_token` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`token` text NOT NULL,
	`platform` text DEFAULT 'ios' NOT NULL,
	`device_name` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer,
	`last_seen_at` integer,
	CONSTRAINT `fk_push_token_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
ALTER TABLE `user_preference` ADD `push_enabled` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `user_preference` ADD `notify_session_started` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `user_preference` ADD `notify_match_recorded` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `user_preference` ADD `notify_achievement_unlocked` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `user_preference` ADD `notify_streak_reached` integer DEFAULT true NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `push_token_token_uidx` ON `push_token` (`token`);--> statement-breakpoint
CREATE INDEX `push_token_userId_idx` ON `push_token` (`user_id`);