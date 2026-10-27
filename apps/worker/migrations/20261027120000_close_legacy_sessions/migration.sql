-- Sessions created before auto-expiry existed have no auto_ends_at, so they never
-- auto-close and block starting a new session for the season. Close them once.
UPDATE `game_session`
SET `status` = 'ended', `ended_at` = COALESCE(`ended_at`, unixepoch()), `updated_at` = unixepoch()
WHERE `status` = 'active' AND `auto_ends_at` IS NULL;
