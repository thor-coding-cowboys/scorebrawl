CREATE TABLE `account` (
	`id` text PRIMARY KEY,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_account_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `invitation` (
	`id` text PRIMARY KEY,
	`organization_id` text NOT NULL,
	`email` text NOT NULL,
	`role` text,
	`team_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`inviter_id` text NOT NULL,
	CONSTRAINT `fk_invitation_organization_id_league_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `league`(`id`) ON DELETE cascade,
	CONSTRAINT `fk_invitation_inviter_id_user_id_fk` FOREIGN KEY (`inviter_id`) REFERENCES `user`(`id`) ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `league` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`logo` text,
	`created_at` integer NOT NULL,
	`metadata` text
);
--> statement-breakpoint
CREATE TABLE `member` (
	`id` text PRIMARY KEY,
	`organization_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT `fk_member_organization_id_league_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `league`(`id`) ON DELETE cascade,
	CONSTRAINT `fk_member_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `passkey` (
	`id` text PRIMARY KEY,
	`name` text,
	`public_key` text NOT NULL,
	`user_id` text NOT NULL,
	`credential_id` text NOT NULL,
	`counter` integer NOT NULL,
	`device_type` text NOT NULL,
	`backed_up` integer NOT NULL,
	`transports` text,
	`created_at` integer,
	`aaguid` text,
	CONSTRAINT `fk_passkey_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL UNIQUE,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	`active_organization_id` text,
	`active_team_id` text,
	CONSTRAINT `fk_session_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `team` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`organization_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	CONSTRAINT `fk_team_organization_id_league_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `league`(`id`) ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `team_member` (
	`id` text PRIMARY KEY,
	`team_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer,
	CONSTRAINT `fk_team_member_team_id_team_id_fk` FOREIGN KEY (`team_id`) REFERENCES `team`(`id`) ON DELETE cascade,
	CONSTRAINT `fk_team_member_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`email` text NOT NULL UNIQUE,
	`email_verified` integer DEFAULT 0 NOT NULL,
	`image` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user_preference` (
	`user_id` text PRIMARY KEY,
	`default_organization_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer,
	CONSTRAINT `fk_user_preference_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `fixture` (
	`id` text PRIMARY KEY,
	`round` integer NOT NULL,
	`season_id` text NOT NULL,
	`match_id` text,
	`home_player_id` text NOT NULL,
	`away_player_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer,
	CONSTRAINT `fk_fixture_season_id_season_id_fk` FOREIGN KEY (`season_id`) REFERENCES `season`(`id`) ON DELETE cascade,
	CONSTRAINT `fk_fixture_match_id_match_id_fk` FOREIGN KEY (`match_id`) REFERENCES `match`(`id`) ON DELETE set null,
	CONSTRAINT `fk_fixture_home_player_id_season_player_id_fk` FOREIGN KEY (`home_player_id`) REFERENCES `season_player`(`id`) ON DELETE cascade,
	CONSTRAINT `fk_fixture_away_player_id_season_player_id_fk` FOREIGN KEY (`away_player_id`) REFERENCES `season_player`(`id`) ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `match` (
	`id` text PRIMARY KEY,
	`season_id` text NOT NULL,
	`home_score` integer NOT NULL,
	`away_score` integer NOT NULL,
	`home_expected_elo` real,
	`away_expected_elo` real,
	`created_by` text NOT NULL,
	`updated_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer,
	CONSTRAINT `fk_match_season_id_season_id_fk` FOREIGN KEY (`season_id`) REFERENCES `season`(`id`) ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `match_player` (
	`id` text PRIMARY KEY,
	`season_player_id` text NOT NULL,
	`home_team` integer NOT NULL,
	`match_id` text NOT NULL,
	`score_before` integer DEFAULT -1 NOT NULL,
	`score_after` integer DEFAULT -1 NOT NULL,
	`result` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer,
	CONSTRAINT `fk_match_player_season_player_id_season_player_id_fk` FOREIGN KEY (`season_player_id`) REFERENCES `season_player`(`id`) ON DELETE cascade,
	CONSTRAINT `fk_match_player_match_id_match_id_fk` FOREIGN KEY (`match_id`) REFERENCES `match`(`id`) ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `match_team` (
	`id` text PRIMARY KEY,
	`season_team_id` text NOT NULL,
	`match_id` text NOT NULL,
	`score_before` integer DEFAULT -1 NOT NULL,
	`score_after` integer DEFAULT -1 NOT NULL,
	`result` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer,
	CONSTRAINT `fk_match_team_season_team_id_season_team_id_fk` FOREIGN KEY (`season_team_id`) REFERENCES `season_team`(`id`) ON DELETE cascade,
	CONSTRAINT `fk_match_team_match_id_match_id_fk` FOREIGN KEY (`match_id`) REFERENCES `match`(`id`) ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `org_team` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`league_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer,
	CONSTRAINT `fk_org_team_league_id_league_id_fk` FOREIGN KEY (`league_id`) REFERENCES `league`(`id`) ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `org_team_player` (
	`id` text PRIMARY KEY,
	`player_id` text NOT NULL,
	`org_team_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer,
	CONSTRAINT `fk_org_team_player_player_id_player_id_fk` FOREIGN KEY (`player_id`) REFERENCES `player`(`id`) ON DELETE cascade,
	CONSTRAINT `fk_org_team_player_org_team_id_org_team_id_fk` FOREIGN KEY (`org_team_id`) REFERENCES `org_team`(`id`) ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `player` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`league_id` text NOT NULL,
	`disabled` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer,
	CONSTRAINT `fk_player_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade,
	CONSTRAINT `fk_player_league_id_league_id_fk` FOREIGN KEY (`league_id`) REFERENCES `league`(`id`) ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `player_achievement` (
	`id` text PRIMARY KEY,
	`player_id` text NOT NULL,
	`type` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer,
	CONSTRAINT `fk_player_achievement_player_id_player_id_fk` FOREIGN KEY (`player_id`) REFERENCES `player`(`id`) ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `season` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`initial_score` integer NOT NULL,
	`score_type` text NOT NULL,
	`k_factor` integer NOT NULL,
	`start_date` integer NOT NULL,
	`end_date` integer,
	`rounds` integer,
	`league_id` text NOT NULL,
	`archived` integer DEFAULT 0 NOT NULL,
	`closed` integer DEFAULT 0 NOT NULL,
	`created_by` text NOT NULL,
	`updated_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer,
	CONSTRAINT `fk_season_league_id_league_id_fk` FOREIGN KEY (`league_id`) REFERENCES `league`(`id`) ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `season_player` (
	`id` text PRIMARY KEY,
	`season_id` text NOT NULL,
	`player_id` text NOT NULL,
	`score` integer NOT NULL,
	`disabled` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer,
	CONSTRAINT `fk_season_player_season_id_season_id_fk` FOREIGN KEY (`season_id`) REFERENCES `season`(`id`) ON DELETE cascade,
	CONSTRAINT `fk_season_player_player_id_player_id_fk` FOREIGN KEY (`player_id`) REFERENCES `player`(`id`) ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `season_team` (
	`id` text PRIMARY KEY,
	`season_id` text NOT NULL,
	`org_team_id` text NOT NULL,
	`score` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer,
	CONSTRAINT `fk_season_team_season_id_season_id_fk` FOREIGN KEY (`season_id`) REFERENCES `season`(`id`) ON DELETE cascade,
	CONSTRAINT `fk_season_team_org_team_id_org_team_id_fk` FOREIGN KEY (`org_team_id`) REFERENCES `org_team`(`id`) ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE INDEX `invitation_organizationId_idx` ON `invitation` (`organization_id`);--> statement-breakpoint
CREATE INDEX `invitation_email_idx` ON `invitation` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `league_slug_uidx` ON `league` (`slug`);--> statement-breakpoint
CREATE INDEX `member_organizationId_idx` ON `member` (`organization_id`);--> statement-breakpoint
CREATE INDEX `member_userId_idx` ON `member` (`user_id`);--> statement-breakpoint
CREATE INDEX `passkey_userId_idx` ON `passkey` (`user_id`);--> statement-breakpoint
CREATE INDEX `passkey_credentialID_idx` ON `passkey` (`credential_id`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE INDEX `team_organizationId_idx` ON `team` (`organization_id`);--> statement-breakpoint
CREATE INDEX `teamMember_teamId_idx` ON `team_member` (`team_id`);--> statement-breakpoint
CREATE INDEX `teamMember_userId_idx` ON `team_member` (`user_id`);--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);--> statement-breakpoint
CREATE INDEX `fixture_season_id_idx` ON `fixture` (`season_id`);--> statement-breakpoint
CREATE INDEX `fixture_match_id_idx` ON `fixture` (`match_id`);--> statement-breakpoint
CREATE INDEX `match_season_id_idx` ON `match` (`season_id`);--> statement-breakpoint
CREATE INDEX `match_created_at_idx` ON `match` (`created_at`);--> statement-breakpoint
CREATE INDEX `match_player_season_player_id_idx` ON `match_player` (`season_player_id`);--> statement-breakpoint
CREATE INDEX `match_player_match_id_idx` ON `match_player` (`match_id`);--> statement-breakpoint
CREATE INDEX `match_team_season_team_id_idx` ON `match_team` (`season_team_id`);--> statement-breakpoint
CREATE INDEX `match_team_match_id_idx` ON `match_team` (`match_id`);--> statement-breakpoint
CREATE INDEX `match_team_created_at_idx` ON `match_team` (`created_at`);--> statement-breakpoint
CREATE INDEX `org_team_organization_id_idx` ON `org_team` (`league_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `org_team_player_team_player_uidx` ON `org_team_player` (`org_team_id`,`player_id`);--> statement-breakpoint
CREATE INDEX `org_team_player_team_id_idx` ON `org_team_player` (`org_team_id`);--> statement-breakpoint
CREATE INDEX `org_team_player_player_id_idx` ON `org_team_player` (`player_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `player_organization_user_uidx` ON `player` (`league_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `player_organization_id_idx` ON `player` (`league_id`);--> statement-breakpoint
CREATE INDEX `player_user_id_idx` ON `player` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `player_achievement_player_type_uidx` ON `player_achievement` (`player_id`,`type`);--> statement-breakpoint
CREATE INDEX `player_achievement_player_id_idx` ON `player_achievement` (`player_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `season_slug_uidx` ON `season` (`league_id`,`slug`);--> statement-breakpoint
CREATE INDEX `season_organization_id_idx` ON `season` (`league_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `season_player_season_player_uidx` ON `season_player` (`season_id`,`player_id`);--> statement-breakpoint
CREATE INDEX `season_player_season_id_idx` ON `season_player` (`season_id`);--> statement-breakpoint
CREATE INDEX `season_player_player_id_idx` ON `season_player` (`player_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `season_team_season_team_uidx` ON `season_team` (`season_id`,`org_team_id`);--> statement-breakpoint
CREATE INDEX `season_team_season_id_idx` ON `season_team` (`season_id`);--> statement-breakpoint
CREATE INDEX `season_team_org_team_id_idx` ON `season_team` (`org_team_id`);