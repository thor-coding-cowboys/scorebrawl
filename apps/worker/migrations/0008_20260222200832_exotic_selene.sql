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
	CONSTRAINT "player_user_or_guest_check" CHECK((user_id IS NOT NULL OR guest_id IS NOT NULL))
);
--> statement-breakpoint
INSERT INTO `__new_player`(`id`, `user_id`, `guest_id`, `league_id`, `disabled`, `created_at`, `updated_at`, `deleted_at`) SELECT `id`, `user_id`, `guest_id`, `league_id`, `disabled`, `created_at`, `updated_at`, `deleted_at` FROM `player`;--> statement-breakpoint
CREATE TABLE `__backup_match_player` AS SELECT * FROM `match_player`;--> statement-breakpoint
CREATE TABLE `__backup_fixture` AS SELECT * FROM `fixture`;--> statement-breakpoint
CREATE TABLE `__backup_season_player` AS SELECT * FROM `season_player`;--> statement-breakpoint
CREATE TABLE `__backup_league_team_player` AS SELECT * FROM `league_team_player`;--> statement-breakpoint
CREATE TABLE `__backup_player_achievement` AS SELECT * FROM `player_achievement`;--> statement-breakpoint
DROP TABLE `player`;--> statement-breakpoint
ALTER TABLE `__new_player` RENAME TO `player`;--> statement-breakpoint
INSERT OR IGNORE INTO `league_team_player` SELECT * FROM `__backup_league_team_player`;--> statement-breakpoint
INSERT OR IGNORE INTO `player_achievement` SELECT * FROM `__backup_player_achievement`;--> statement-breakpoint
INSERT OR IGNORE INTO `season_player` SELECT * FROM `__backup_season_player`;--> statement-breakpoint
INSERT OR IGNORE INTO `fixture` SELECT * FROM `__backup_fixture`;--> statement-breakpoint
INSERT OR IGNORE INTO `match_player` SELECT * FROM `__backup_match_player`;--> statement-breakpoint
DROP TABLE `__backup_match_player`;--> statement-breakpoint
DROP TABLE `__backup_fixture`;--> statement-breakpoint
DROP TABLE `__backup_season_player`;--> statement-breakpoint
DROP TABLE `__backup_league_team_player`;--> statement-breakpoint
DROP TABLE `__backup_player_achievement`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `player_organization_user_uidx` ON `player` (`league_id`,`user_id`) WHERE "player"."user_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `player_organization_guest_uidx` ON `player` (`league_id`,`guest_id`) WHERE "player"."guest_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX `player_user_id_idx` ON `player` (`user_id`);--> statement-breakpoint
CREATE INDEX `player_guest_id_idx` ON `player` (`guest_id`);
