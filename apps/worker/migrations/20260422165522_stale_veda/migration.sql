CREATE TABLE `ai_conversation` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`league_id` text NOT NULL,
	`title` text DEFAULT 'New conversation' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer,
	CONSTRAINT `fk_ai_conversation_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade,
	CONSTRAINT `fk_ai_conversation_league_id_league_id_fk` FOREIGN KEY (`league_id`) REFERENCES `league`(`id`) ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `ai_message` (
	`id` text PRIMARY KEY,
	`conversation_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`tool_name` text,
	`tool_args` text,
	`tool_result` text,
	`tool_call_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer,
	CONSTRAINT `fk_ai_message_conversation_id_ai_conversation_id_fk` FOREIGN KEY (`conversation_id`) REFERENCES `ai_conversation`(`id`) ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `ai_user_settings` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`encrypted_api_key` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer,
	CONSTRAINT `fk_ai_user_settings_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ai_conversation_user_league_idx` ON `ai_conversation` (`user_id`,`league_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `ai_message_conversation_idx` ON `ai_message` (`conversation_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `ai_user_settings_user_idx` ON `ai_user_settings` (`user_id`);