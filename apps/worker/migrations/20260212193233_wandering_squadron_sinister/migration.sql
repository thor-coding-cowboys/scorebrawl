CREATE TABLE `apikey` (
	`id` text PRIMARY KEY,
	`name` text,
	`start` text,
	`prefix` text,
	`key` text NOT NULL,
	`user_id` text NOT NULL,
	`refill_interval` integer,
	`refill_amount` integer,
	`last_refill_at` integer,
	`enabled` integer DEFAULT 1 NOT NULL,
	`rate_limit_enabled` integer DEFAULT 1 NOT NULL,
	`rate_limit_time_window` integer,
	`rate_limit_max` integer,
	`request_count` integer DEFAULT 0 NOT NULL,
	`remaining` integer,
	`last_request` integer,
	`expires_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`permissions` text,
	`metadata` text,
	CONSTRAINT `fk_apikey_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `apikey_userId_idx` ON `apikey` (`user_id`);