ALTER TABLE `account` ADD `issuer` text DEFAULT 'local:credential' NOT NULL;--> statement-breakpoint
UPDATE `account` SET `issuer` = CASE
	WHEN `provider_id` = 'google' THEN 'https://accounts.google.com'
	WHEN `provider_id` = 'credential' THEN 'local:credential'
	ELSE 'local:oauth:' || `provider_id`
END;
