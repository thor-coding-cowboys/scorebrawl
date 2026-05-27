ALTER TABLE `mcp_token` ADD `expires_at` integer NOT NULL;--> statement-breakpoint
DROP INDEX IF EXISTS `ai_conversation_user_league_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `ai_message_conversation_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `ai_user_settings_user_idx`;--> statement-breakpoint
DROP TABLE `ai_conversation`;--> statement-breakpoint
DROP TABLE `ai_message`;--> statement-breakpoint
DROP TABLE `ai_user_settings`;