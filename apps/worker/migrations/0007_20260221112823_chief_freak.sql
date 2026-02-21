CREATE TABLE `guest` (
	`id` text PRIMARY KEY,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
ALTER TABLE `player` ADD `guest_id` text REFERENCES guest(id);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_player` (
	`id` text PRIMARY KEY,
	`user_id` text,
	`guest_id` text,
	`league_id` text NOT NULL,
	`disabled` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer,
	CONSTRAINT `fk_player_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade,
	CONSTRAINT `fk_player_guest_id_guest_id_fk` FOREIGN KEY (`guest_id`) REFERENCES `guest`(`id`) ON DELETE cascade,
	CONSTRAINT `fk_player_league_id_league_id_fk` FOREIGN KEY (`league_id`) REFERENCES `league`(`id`) ON DELETE cascade,
	CONSTRAINT "player_user_or_guest_check" CHECK(("user_id" IS NOT NULL AND "guest_id" IS NULL) OR ("user_id" IS NULL AND "guest_id" IS NOT NULL))
);
--> statement-breakpoint
INSERT INTO `__new_player`(`id`, `user_id`, `league_id`, `disabled`, `created_at`, `updated_at`, `deleted_at`) SELECT `id`, `user_id`, `league_id`, `disabled`, `created_at`, `updated_at`, `deleted_at` FROM `player`;--> statement-breakpoint
DROP TABLE `player`;--> statement-breakpoint
ALTER TABLE `__new_player` RENAME TO `player`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
DROP INDEX IF EXISTS `device_api_key_league_id_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `device_api_key_created_by_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `device_api_key_key_hash_idx`;--> statement-breakpoint
CREATE UNIQUE INDEX `player_organization_user_uidx` ON `player` (`league_id`,`user_id`) WHERE "player"."user_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `player_organization_guest_uidx` ON `player` (`league_id`,`guest_id`) WHERE "player"."guest_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX `player_user_id_idx` ON `player` (`user_id`);--> statement-breakpoint
CREATE INDEX `player_guest_id_idx` ON `player` (`guest_id`);--> statement-breakpoint
CREATE INDEX `guest_email_idx` ON `guest` (`email`);--> statement-breakpoint
DROP TABLE IF EXISTS `device_api_key`;