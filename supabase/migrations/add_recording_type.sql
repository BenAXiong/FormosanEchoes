ALTER TABLE songs ADD COLUMN IF NOT EXISTS recording_type TEXT;

COMMENT ON COLUMN songs.recording_type IS
  'How the recording was made: Studio | Live | Home Recording | Field Recording';
