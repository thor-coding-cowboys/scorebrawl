ALTER TABLE `session` ADD `impersonated_by` text;--> statement-breakpoint
ALTER TABLE `user` ADD `role` text;--> statement-breakpoint
ALTER TABLE `user` ADD `banned` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `user` ADD `ban_reason` text;--> statement-breakpoint
ALTER TABLE `user` ADD `ban_expires` integer;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_apikey` (
	`id` text PRIMARY KEY,
	`name` text,
	`start` text,
	`prefix` text,
	`key` text NOT NULL,
	`user_id` text NOT NULL,
	`refill_interval` integer,
	`refill_amount` integer,
	`last_refill_at` integer,
	`enabled` integer DEFAULT 1,
	`rate_limit_enabled` integer DEFAULT 1,
	`rate_limit_time_window` integer DEFAULT 86400000,
	`rate_limit_max` integer DEFAULT 10000,
	`request_count` integer DEFAULT 0,
	`remaining` integer,
	`last_request` integer,
	`expires_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`permissions` text,
	`metadata` text,
	CONSTRAINT `fk_apikey_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_apikey`(`id`, `name`, `start`, `prefix`, `key`, `user_id`, `refill_interval`, `refill_amount`, `last_refill_at`, `enabled`, `rate_limit_enabled`, `rate_limit_time_window`, `rate_limit_max`, `request_count`, `remaining`, `last_request`, `expires_at`, `created_at`, `updated_at`, `permissions`, `metadata`) SELECT `id`, `name`, `start`, `prefix`, `key`, `user_id`, `refill_interval`, `refill_amount`, `last_refill_at`, `enabled`, `rate_limit_enabled`, `rate_limit_time_window`, `rate_limit_max`, `request_count`, `remaining`, `last_request`, `expires_at`, `created_at`, `updated_at`, `permissions`, `metadata` FROM `apikey`;--> statement-breakpoint
DROP TABLE `apikey`;--> statement-breakpoint
ALTER TABLE `__new_apikey` RENAME TO `apikey`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
DROP INDEX IF EXISTS `member_org_user_uidx`;--> statement-breakpoint
CREATE INDEX `apikey_key_idx` ON `apikey` (`key`);--> statement-breakpoint
CREATE INDEX `apikey_userId_idx` ON `apikey` (`user_id`);--> statement-breakpoint
CREATE INDEX `member_organizationId_idx` ON `member` (`organization_id`);