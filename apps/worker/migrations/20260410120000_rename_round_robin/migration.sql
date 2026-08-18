-- Rename round-robin to sequential in rotation_mode enum
UPDATE `game_session` SET `rotation_mode` = 'sequential' WHERE `rotation_mode` = 'round-robin';
