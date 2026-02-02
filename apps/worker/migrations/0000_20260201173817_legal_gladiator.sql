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
	CONSTRAINT `fk_invitation_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade,
	CONSTRAINT `fk_invitation_inviter_id_user_id_fk` FOREIGN KEY (`inviter_id`) REFERENCES `user`(`id`) ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `member` (
	`id` text PRIMARY KEY,
	`organization_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT `fk_member_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade,
	CONSTRAINT `fk_member_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `organization` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`logo` text,
	`created_at` integer NOT NULL,
	`metadata` text
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
	CONSTRAINT `fk_team_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade
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
CREATE TABLE `competition` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`initial_score` integer NOT NULL,
	`score_type` text NOT NULL,
	`k_factor` integer NOT NULL,
	`start_date` integer NOT NULL,
	`end_date` integer,
	`rounds` integer,
	`organization_id` text NOT NULL,
	`archived` integer DEFAULT 0 NOT NULL,
	`closed` integer DEFAULT 0 NOT NULL,
	`created_by` text NOT NULL,
	`updated_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer,
	CONSTRAINT `fk_competition_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `competition_player` (
	`id` text PRIMARY KEY,
	`competition_id` text NOT NULL,
	`player_id` text NOT NULL,
	`score` integer NOT NULL,
	`disabled` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer,
	CONSTRAINT `fk_competition_player_competition_id_competition_id_fk` FOREIGN KEY (`competition_id`) REFERENCES `competition`(`id`) ON DELETE cascade,
	CONSTRAINT `fk_competition_player_player_id_player_id_fk` FOREIGN KEY (`player_id`) REFERENCES `player`(`id`) ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `competition_team` (
	`id` text PRIMARY KEY,
	`competition_id` text NOT NULL,
	`org_team_id` text NOT NULL,
	`score` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer,
	CONSTRAINT `fk_competition_team_competition_id_competition_id_fk` FOREIGN KEY (`competition_id`) REFERENCES `competition`(`id`) ON DELETE cascade,
	CONSTRAINT `fk_competition_team_org_team_id_org_team_id_fk` FOREIGN KEY (`org_team_id`) REFERENCES `org_team`(`id`) ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `fixture` (
	`id` text PRIMARY KEY,
	`round` integer NOT NULL,
	`competition_id` text NOT NULL,
	`match_id` text,
	`home_player_id` text NOT NULL,
	`away_player_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer,
	CONSTRAINT `fk_fixture_competition_id_competition_id_fk` FOREIGN KEY (`competition_id`) REFERENCES `competition`(`id`) ON DELETE cascade,
	CONSTRAINT `fk_fixture_match_id_match_id_fk` FOREIGN KEY (`match_id`) REFERENCES `match`(`id`) ON DELETE set null,
	CONSTRAINT `fk_fixture_home_player_id_competition_player_id_fk` FOREIGN KEY (`home_player_id`) REFERENCES `competition_player`(`id`) ON DELETE cascade,
	CONSTRAINT `fk_fixture_away_player_id_competition_player_id_fk` FOREIGN KEY (`away_player_id`) REFERENCES `competition_player`(`id`) ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `match` (
	`id` text PRIMARY KEY,
	`competition_id` text NOT NULL,
	`home_score` integer NOT NULL,
	`away_score` integer NOT NULL,
	`home_expected_elo` real,
	`away_expected_elo` real,
	`created_by` text NOT NULL,
	`updated_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer,
	CONSTRAINT `fk_match_competition_id_competition_id_fk` FOREIGN KEY (`competition_id`) REFERENCES `competition`(`id`) ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `match_player` (
	`id` text PRIMARY KEY,
	`competition_player_id` text NOT NULL,
	`home_team` integer NOT NULL,
	`match_id` text NOT NULL,
	`score_before` integer DEFAULT -1 NOT NULL,
	`score_after` integer DEFAULT -1 NOT NULL,
	`result` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer,
	CONSTRAINT `fk_match_player_competition_player_id_competition_player_id_fk` FOREIGN KEY (`competition_player_id`) REFERENCES `competition_player`(`id`) ON DELETE cascade,
	CONSTRAINT `fk_match_player_match_id_match_id_fk` FOREIGN KEY (`match_id`) REFERENCES `match`(`id`) ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `match_team` (
	`id` text PRIMARY KEY,
	`competition_team_id` text NOT NULL,
	`match_id` text NOT NULL,
	`score_before` integer DEFAULT -1 NOT NULL,
	`score_after` integer DEFAULT -1 NOT NULL,
	`result` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer,
	CONSTRAINT `fk_match_team_competition_team_id_competition_team_id_fk` FOREIGN KEY (`competition_team_id`) REFERENCES `competition_team`(`id`) ON DELETE cascade,
	CONSTRAINT `fk_match_team_match_id_match_id_fk` FOREIGN KEY (`match_id`) REFERENCES `match`(`id`) ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `org_team` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`organization_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer,
	CONSTRAINT `fk_org_team_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade
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
	`organization_id` text NOT NULL,
	`disabled` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer,
	CONSTRAINT `fk_player_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade,
	CONSTRAINT `fk_player_organization_id_organization_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON DELETE cascade
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
CREATE INDEX `account_userId_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE INDEX `invitation_organizationId_idx` ON `invitation` (`organization_id`);--> statement-breakpoint
CREATE INDEX `invitation_email_idx` ON `invitation` (`email`);--> statement-breakpoint
CREATE INDEX `member_organizationId_idx` ON `member` (`organization_id`);--> statement-breakpoint
CREATE INDEX `member_userId_idx` ON `member` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `organization_slug_uidx` ON `organization` (`slug`);--> statement-breakpoint
CREATE INDEX `passkey_userId_idx` ON `passkey` (`user_id`);--> statement-breakpoint
CREATE INDEX `passkey_credentialID_idx` ON `passkey` (`credential_id`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE INDEX `team_organizationId_idx` ON `team` (`organization_id`);--> statement-breakpoint
CREATE INDEX `teamMember_teamId_idx` ON `team_member` (`team_id`);--> statement-breakpoint
CREATE INDEX `teamMember_userId_idx` ON `team_member` (`user_id`);--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);--> statement-breakpoint
CREATE UNIQUE INDEX `competition_slug_uidx` ON `competition` (`slug`);--> statement-breakpoint
CREATE INDEX `competition_organization_id_idx` ON `competition` (`organization_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `competition_player_competition_player_uidx` ON `competition_player` (`competition_id`,`player_id`);--> statement-breakpoint
CREATE INDEX `competition_player_competition_id_idx` ON `competition_player` (`competition_id`);--> statement-breakpoint
CREATE INDEX `competition_player_player_id_idx` ON `competition_player` (`player_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `competition_team_competition_team_uidx` ON `competition_team` (`competition_id`,`org_team_id`);--> statement-breakpoint
CREATE INDEX `competition_team_competition_id_idx` ON `competition_team` (`competition_id`);--> statement-breakpoint
CREATE INDEX `competition_team_org_team_id_idx` ON `competition_team` (`org_team_id`);--> statement-breakpoint
CREATE INDEX `fixture_competition_id_idx` ON `fixture` (`competition_id`);--> statement-breakpoint
CREATE INDEX `fixture_match_id_idx` ON `fixture` (`match_id`);--> statement-breakpoint
CREATE INDEX `match_competition_id_idx` ON `match` (`competition_id`);--> statement-breakpoint
CREATE INDEX `match_created_at_idx` ON `match` (`created_at`);--> statement-breakpoint
CREATE INDEX `match_player_competition_player_id_idx` ON `match_player` (`competition_player_id`);--> statement-breakpoint
CREATE INDEX `match_player_match_id_idx` ON `match_player` (`match_id`);--> statement-breakpoint
CREATE INDEX `match_team_competition_team_id_idx` ON `match_team` (`competition_team_id`);--> statement-breakpoint
CREATE INDEX `match_team_match_id_idx` ON `match_team` (`match_id`);--> statement-breakpoint
CREATE INDEX `match_team_created_at_idx` ON `match_team` (`created_at`);--> statement-breakpoint
CREATE INDEX `org_team_organization_id_idx` ON `org_team` (`organization_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `org_team_player_team_player_uidx` ON `org_team_player` (`org_team_id`,`player_id`);--> statement-breakpoint
CREATE INDEX `org_team_player_team_id_idx` ON `org_team_player` (`org_team_id`);--> statement-breakpoint
CREATE INDEX `org_team_player_player_id_idx` ON `org_team_player` (`player_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `player_organization_user_uidx` ON `player` (`organization_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `player_organization_id_idx` ON `player` (`organization_id`);--> statement-breakpoint
CREATE INDEX `player_user_id_idx` ON `player` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `player_achievement_player_type_uidx` ON `player_achievement` (`player_id`,`type`);--> statement-breakpoint
CREATE INDEX `player_achievement_player_id_idx` ON `player_achievement` (`player_id`);