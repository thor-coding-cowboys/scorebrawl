DROP INDEX IF EXISTS `member_organizationId_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `match_season_id_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `match_created_at_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `match_player_season_player_id_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `org_team_player_team_id_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `player_organization_id_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `player_achievement_player_id_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `season_organization_id_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `season_player_season_id_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `season_team_season_id_idx`;--> statement-breakpoint
CREATE UNIQUE INDEX `member_org_user_uidx` ON `member` (`organization_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `match_season_created_idx` ON `match` (`season_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `match_player_season_player_result_idx` ON `match_player` (`season_player_id`,`result`);--> statement-breakpoint
CREATE INDEX `match_player_season_player_created_idx` ON `match_player` (`season_player_id`,`created_at`);