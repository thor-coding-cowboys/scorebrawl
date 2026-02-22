CREATE TABLE `guest` (
	`id` text PRIMARY KEY,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
ALTER TABLE `player` ADD `guest_id` text REFERENCES guest(id);--> statement-breakpoint
CREATE INDEX `guest_email_idx` ON `guest` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `player_organization_guest_uidx` ON `player` (`league_id`,`guest_id`) WHERE "player"."guest_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX `player_guest_id_idx` ON `player` (`guest_id`);