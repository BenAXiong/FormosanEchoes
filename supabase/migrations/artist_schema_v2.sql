-- Artist schema v2: ethnic_groups array, photo_url, sources, names script fix
-- Run in Supabase SQL editor

-- 1. New columns on artists
ALTER TABLE artists ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE artists ADD COLUMN IF NOT EXISTS sources TEXT[] DEFAULT '{}';
ALTER TABLE artists ADD COLUMN IF NOT EXISTS ethnic_groups TEXT[] DEFAULT '{}';

-- 2. Migrate existing single ethnic_group value into the new array column
UPDATE artists
SET ethnic_groups = ARRAY[ethnic_group]
WHERE ethnic_group IS NOT NULL AND ethnic_groups = '{}';

-- 3. Drop old single-value column
ALTER TABLE artists DROP COLUMN IF EXISTS ethnic_group;

-- 4. Rename mislabelled 'ab' romanized names to 'en'
--    ('ab' is now reserved for indigenous-script orthography only)
UPDATE artist_names SET script = 'en' WHERE script = 'ab';
