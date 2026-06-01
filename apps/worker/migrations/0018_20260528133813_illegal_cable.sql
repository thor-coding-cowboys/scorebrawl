CREATE TABLE `device_code` (
	`id` text PRIMARY KEY,
	`device_code` text NOT NULL,
	`user_code` text NOT NULL,
	`user_id` text,
	`expires_at` integer NOT NULL,
	`status` text NOT NULL,
	`last_polled_at` integer,
	`polling_interval` real,
	`client_id` text,
	`scope` text
);
