CREATE TABLE `game_session` (
	`id` text PRIMARY KEY,
	`season_id` text NOT NULL,
	`created_by` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`rotation_mode` text NOT NULL,
	`team_size` integer NOT NULL,
	`max_consecutive_games` integer,
	`always_split_constraints` text,
	`auto_randomize` integer DEFAULT 0 NOT NULL,
	`ended_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer,
	CONSTRAINT `fk_game_session_season_id_season_id_fk` FOREIGN KEY (`season_id`) REFERENCES `season`(`id`) ON DELETE cascade,
	CONSTRAINT `fk_game_session_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `session_coin_toss` (
	`id` text PRIMARY KEY,
	`session_id` text NOT NULL,
	`session_match_id` text,
	`conflict_type` text NOT NULL,
	`candidates` text NOT NULL,
	`resolved` integer DEFAULT 0 NOT NULL,
	`resolved_winner_ids` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer,
	CONSTRAINT `fk_session_coin_toss_session_id_game_session_id_fk` FOREIGN KEY (`session_id`) REFERENCES `game_session`(`id`) ON DELETE cascade,
	CONSTRAINT `fk_session_coin_toss_session_match_id_session_match_id_fk` FOREIGN KEY (`session_match_id`) REFERENCES `session_match`(`id`) ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `session_match` (
	`id` text PRIMARY KEY,
	`session_id` text NOT NULL,
	`match_id` text,
	`match_number` integer NOT NULL,
	`home_player_ids` text NOT NULL,
	`away_player_ids` text NOT NULL,
	`result` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer,
	CONSTRAINT `fk_session_match_session_id_game_session_id_fk` FOREIGN KEY (`session_id`) REFERENCES `game_session`(`id`) ON DELETE cascade,
	CONSTRAINT `fk_session_match_match_id_match_id_fk` FOREIGN KEY (`match_id`) REFERENCES `match`(`id`) ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `session_player` (
	`id` text PRIMARY KEY,
	`session_id` text NOT NULL,
	`season_player_id` text NOT NULL,
	`status` text DEFAULT 'waiting' NOT NULL,
	`queue_position` integer NOT NULL,
	`games_played_this_session` integer DEFAULT 0 NOT NULL,
	`consecutive_games` integer DEFAULT 0 NOT NULL,
	`joined_at` integer DEFAULT (unixepoch()) NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer,
	CONSTRAINT `fk_session_player_session_id_game_session_id_fk` FOREIGN KEY (`session_id`) REFERENCES `game_session`(`id`) ON DELETE cascade,
	CONSTRAINT `fk_session_player_season_player_id_season_player_id_fk` FOREIGN KEY (`season_player_id`) REFERENCES `season_player`(`id`) ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `game_session_season_id_idx` ON `game_session` (`season_id`);--> statement-breakpoint
CREATE INDEX `game_session_season_status_idx` ON `game_session` (`season_id`,`status`);--> statement-breakpoint
CREATE INDEX `session_coin_toss_session_id_idx` ON `session_coin_toss` (`session_id`);--> statement-breakpoint
CREATE INDEX `session_match_session_id_idx` ON `session_match` (`session_id`);--> statement-breakpoint
CREATE INDEX `session_match_match_id_idx` ON `session_match` (`match_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `session_player_session_season_player_uidx` ON `session_player` (`session_id`,`season_player_id`);--> statement-breakpoint
CREATE INDEX `session_player_session_id_idx` ON `session_player` (`session_id`);