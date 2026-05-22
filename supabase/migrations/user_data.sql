-- User-specific data tables for authenticated public users.
-- Run in Supabase SQL editor after enabling Google OAuth provider.

CREATE TABLE user_favorites (
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  song_id    UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, song_id)
);

CREATE TABLE user_playlists (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE user_playlist_songs (
  playlist_id UUID    NOT NULL REFERENCES user_playlists(id) ON DELETE CASCADE,
  song_id     UUID    NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (playlist_id, song_id)
);

ALTER TABLE user_favorites      ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_playlists      ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_playlist_songs ENABLE ROW LEVEL SECURITY;

-- Each user can only read and write their own rows
CREATE POLICY "own_favorites"      ON user_favorites      FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own_playlists"      ON user_playlists      FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own_playlist_songs" ON user_playlist_songs FOR ALL TO authenticated
  USING (playlist_id IN (SELECT id FROM user_playlists WHERE user_id = auth.uid()));
