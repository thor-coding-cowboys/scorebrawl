DROP INDEX IF EXISTS `team_organizationId_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `teamMember_teamId_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `teamMember_userId_idx`;--> statement-breakpoint
DROP TABLE `team`;--> statement-breakpoint
DROP TABLE `team_member`;--> statement-breakpoint
ALTER TABLE `invitation` DROP COLUMN `team_id`;--> statement-breakpoint
ALTER TABLE `session` DROP COLUMN `active_team_id`;