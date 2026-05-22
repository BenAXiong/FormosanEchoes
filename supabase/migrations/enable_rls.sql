-- Enable Row-Level Security on all public tables.
-- Service role (used by all server-side API routes) bypasses RLS by default — no write policies needed.
-- anon + authenticated both get read-only access; lyrics are filtered to show_publicly = true only.

ALTER TABLE artists         ENABLE ROW LEVEL SECURITY;
ALTER TABLE artist_names    ENABLE ROW LEVEL SECURITY;
ALTER TABLE artist_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE songs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE song_artists    ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags            ENABLE ROW LEVEL SECURITY;
ALTER TABLE song_tags       ENABLE ROW LEVEL SECURITY;
ALTER TABLE lyrics          ENABLE ROW LEVEL SECURITY;

-- Public read on all tables (unrestricted rows)
CREATE POLICY "public_select" ON artists        FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public_select" ON artist_names   FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public_select" ON artist_members FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public_select" ON songs          FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public_select" ON song_artists   FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public_select" ON tags           FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public_select" ON song_tags      FOR SELECT TO anon, authenticated USING (true);

-- Lyrics: enforce show_publicly gate at the database level
CREATE POLICY "public_select" ON lyrics         FOR SELECT TO anon, authenticated USING (show_publicly = true);
