ALTER TABLE artists ADD COLUMN IF NOT EXISTS researched_fields TEXT[] DEFAULT '{}';

COMMENT ON COLUMN artists.researched_fields IS 'Missing-badge keys confirmed as N/A after research (e.g. ["no_links", "no_bio"]). Filtered out of the missing array in all-artists API.';
