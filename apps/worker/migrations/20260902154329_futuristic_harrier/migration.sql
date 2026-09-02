UPDATE `game_session` SET `randomizer_type` = 'off' WHERE `auto_randomize` = 0;--> statement-breakpoint
ALTER TABLE `game_session` DROP COLUMN `auto_randomize`;