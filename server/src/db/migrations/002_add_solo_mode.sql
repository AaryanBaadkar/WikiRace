-- Drop the old mode check constraint and add one that includes 'solo'
ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_mode_check;
ALTER TABLE matches ADD CONSTRAINT matches_mode_check CHECK (mode IN ('bot', 'pvp', 'solo'));
