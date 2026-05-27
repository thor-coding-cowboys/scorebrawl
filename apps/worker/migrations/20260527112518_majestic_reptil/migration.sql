CREATE TABLE `mcp_auth_code` (
	`code` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`organization_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`consumed_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer,
	CONSTRAINT `fk_mcp_auth_code_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade,
	CONSTRAINT `fk_mcp_auth_code_organization_id_league_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `league`(`id`) ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `mcp_token` (
	`id` text PRIMARY KEY,
	`token_hash` text NOT NULL UNIQUE,
	`user_id` text NOT NULL,
	`organization_id` text NOT NULL,
	`last_used_at` integer,
	`revoked_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer,
	CONSTRAINT `fk_mcp_token_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade,
	CONSTRAINT `fk_mcp_token_organization_id_league_id_fk` FOREIGN KEY (`organization_id`) REFERENCES `league`(`id`) ON DELETE cascade
);
