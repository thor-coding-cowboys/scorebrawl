ALTER TABLE `org_team` RENAME TO `league_team`;--> statement-breakpoint
ALTER TABLE `org_team_player` RENAME TO `league_team_player`;--> statement-breakpoint
ALTER TABLE `league_team_player` RENAME COLUMN `org_team_id` TO `league_team_id`;--> statement-breakpoint
ALTER TABLE `season_team` RENAME COLUMN `org_team_id` TO `league_team_id`;--> statement-breakpoint
DROP INDEX IF EXISTS `org_team_organization_id_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `org_team_player_team_player_uidx`;--> statement-breakpoint
DROP INDEX IF EXISTS `org_team_player_player_id_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `season_team_org_team_id_idx`;--> statement-breakpoint
CREATE INDEX `league_team_league_id_idx` ON `league_team` (`league_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `league_team_player_team_player_uidx` ON `league_team_player` (`league_team_id`,`player_id`);--> statement-breakpoint
CREATE INDEX `league_team_player_player_id_idx` ON `league_team_player` (`player_id`);--> statement-breakpoint
CREATE INDEX `season_team_league_team_id_idx` ON `season_team` (`league_team_id`);