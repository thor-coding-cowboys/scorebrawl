CREATE TABLE `league_setting` (
	`league_id` text PRIMARY KEY,
	`allow_public_shares` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer,
	CONSTRAINT `fk_league_setting_league_id_league_id_fk` FOREIGN KEY (`league_id`) REFERENCES `league`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `share_link` (
	`id` text PRIMARY KEY,
	`token_hash` text NOT NULL UNIQUE,
	`league_id` text NOT NULL,
	`season_id` text NOT NULL,
	`created_by` text,
	`expires_at` integer,
	`revoked_at` integer,
	`revoked_by` text,
	`view_count` integer DEFAULT 0 NOT NULL,
	`last_viewed_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer,
	CONSTRAINT `fk_share_link_league_id_league_id_fk` FOREIGN KEY (`league_id`) REFERENCES `league`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_share_link_season_id_season_id_fk` FOREIGN KEY (`season_id`) REFERENCES `season`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_share_link_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_share_link_revoked_by_user_id_fk` FOREIGN KEY (`revoked_by`) REFERENCES `user`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE INDEX `share_link_season_created_idx` ON `share_link` (`season_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `share_link_league_idx` ON `share_link` (`league_id`);