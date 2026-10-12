CREATE TABLE `apikey` (
	`id` text PRIMARY KEY,
	`config_id` text DEFAULT 'default' NOT NULL,
	`name` text,
	`start` text,
	`reference_id` text NOT NULL,
	`prefix` text,
	`key` text NOT NULL,
	`refill_interval` integer,
	`refill_amount` integer,
	`last_refill_at` integer,
	`enabled` integer DEFAULT true,
	`rate_limit_enabled` integer DEFAULT true,
	`rate_limit_time_window` integer DEFAULT 86400000,
	`rate_limit_max` integer DEFAULT 10,
	`request_count` integer DEFAULT 0,
	`remaining` integer,
	`last_request` integer,
	`expires_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`permissions` text,
	`metadata` text
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_oauth_client` (
	`id` text PRIMARY KEY,
	`client_id` text NOT NULL UNIQUE,
	`client_secret` text,
	`client_discovery_id` text,
	`disabled` integer DEFAULT false,
	`skip_consent` integer,
	`enable_end_session` integer,
	`subject_type` text,
	`scopes` text,
	`client_credentials_scopes` text DEFAULT '[]',
	`user_id` text,
	`created_at` integer,
	`updated_at` integer,
	`name` text,
	`uri` text,
	`icon` text,
	`contacts` text,
	`tos` text,
	`policy` text,
	`software_id` text,
	`software_version` text,
	`software_statement` text,
	`redirect_uris` text NOT NULL,
	`post_logout_redirect_uris` text,
	`backchannel_logout_uri` text,
	`backchannel_logout_session_required` integer,
	`token_endpoint_auth_method` text,
	`application_type` text,
	`jwks` text,
	`jwks_uri` text,
	`grant_types` text,
	`response_types` text,
	`require_pkce` integer,
	`dpop_bound_access_tokens` integer DEFAULT false,
	`reference_id` text,
	`metadata` text,
	CONSTRAINT `fk_oauth_client_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
INSERT INTO `__new_oauth_client`(`id`, `client_id`, `client_secret`, `client_discovery_id`, `disabled`, `skip_consent`, `enable_end_session`, `subject_type`, `scopes`, `client_credentials_scopes`, `user_id`, `created_at`, `updated_at`, `name`, `uri`, `icon`, `contacts`, `tos`, `policy`, `software_id`, `software_version`, `software_statement`, `redirect_uris`, `post_logout_redirect_uris`, `backchannel_logout_uri`, `backchannel_logout_session_required`, `token_endpoint_auth_method`, `application_type`, `jwks`, `jwks_uri`, `grant_types`, `response_types`, `require_pkce`, `dpop_bound_access_tokens`, `reference_id`, `metadata`) SELECT `id`, `client_id`, `client_secret`, `client_discovery_id`, `disabled`, `skip_consent`, `enable_end_session`, `subject_type`, `scopes`, `client_credentials_scopes`, `user_id`, `created_at`, `updated_at`, `name`, `uri`, `icon`, `contacts`, `tos`, `policy`, `software_id`, `software_version`, `software_statement`, `redirect_uris`, `post_logout_redirect_uris`, `backchannel_logout_uri`, `backchannel_logout_session_required`, `token_endpoint_auth_method`, `application_type`, `jwks`, `jwks_uri`, `grant_types`, `response_types`, `require_pkce`, `dpop_bound_access_tokens`, `reference_id`, `metadata` FROM `oauth_client`;--> statement-breakpoint
DROP TABLE `oauth_client`;--> statement-breakpoint
ALTER TABLE `__new_oauth_client` RENAME TO `oauth_client`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `oauthClient_userId_idx` ON `oauth_client` (`user_id`);--> statement-breakpoint
CREATE INDEX `apikey_configId_idx` ON `apikey` (`config_id`);--> statement-breakpoint
CREATE INDEX `apikey_referenceId_idx` ON `apikey` (`reference_id`);--> statement-breakpoint
CREATE INDEX `apikey_key_idx` ON `apikey` (`key`);