ALTER TABLE `account` ADD `issuer` text DEFAULT 'local:credential' NOT NULL;--> statement-breakpoint
UPDATE `account` SET `issuer` = 'local:oauth:' || `provider_id` WHERE `provider_id` <> 'credential';
