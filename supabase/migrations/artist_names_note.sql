ALTER TABLE artist_names ADD COLUMN IF NOT EXISTS note TEXT;

COMMENT ON COLUMN artist_names.note IS 'Optional curation note, e.g. "approximate spelling from YouTube era". Names with a note are kept for search/linking but suppressed in public display.';
