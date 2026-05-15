-- ============================================================
-- Formosan Echoes — Supabase Schema
-- Run this in the Supabase SQL editor (once, on a fresh project)
-- ============================================================

-- ── Artists ──────────────────────────────────────────────────

CREATE TABLE artists (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id       TEXT UNIQUE,          -- art-001 etc, migration bridge
  name_display    TEXT NOT NULL,
  ethnic_group    TEXT,
  language        TEXT,
  dialect         TEXT,
  is_group        BOOLEAN NOT NULL DEFAULT FALSE,
  active_years    TEXT,
  bio_zh          TEXT,
  bio_en          TEXT,
  bio_ycm         TEXT,                 -- future indigenous language translation
  zh_surname      TEXT,
  youtube_channel TEXT,
  wikipedia_url   TEXT,
  notes           TEXT,                 -- internal
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- All name variants per artist (Chinese, English/romanized, Aboriginal)
-- Indexed for fast alias matching during song import and linking
CREATE TABLE artist_names (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id  UUID NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  script     TEXT NOT NULL              -- 'zh' | 'en' | 'ab'
);

CREATE INDEX idx_artist_names_lower ON artist_names (LOWER(name));
CREATE INDEX idx_artist_names_artist ON artist_names (artist_id);

-- ── Songs ────────────────────────────────────────────────────

CREATE TABLE songs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id           TEXT UNIQUE,      -- sof-00001 etc, migration bridge
  title_original      TEXT,             -- primary title (indigenous script or common name)
  title_zh            TEXT,
  title_en            TEXT,
  artist_credit       TEXT,             -- raw credit string ("ABAO feat. X") — display + fallback
  yt_url              TEXT,
  yt_video_id         TEXT,
  yt_channel          TEXT,
  yt_channel_id       TEXT,
  yt_upload_date      DATE,
  yt_views            INTEGER,          -- snapshot at time of addition
  yt_duration         INTEGER,          -- seconds
  yt_thumbnail_url    TEXT,
  yt_description      TEXT,
  url                 TEXT,             -- non-YouTube source URL
  album               TEXT,
  year                TEXT,
  language            TEXT,
  ethnic_group        TEXT,             -- cultural tradition of the song (≠ artist's ethnic group)
  region              TEXT,
  location            TEXT,
  genre               TEXT,
  description         TEXT,             -- public-facing context shown to visitors
  notes               TEXT,             -- internal admin/curation notes
  verification_status TEXT NOT NULL DEFAULT 'candidate',  -- candidate | checked | approved | rejected
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_songs_language           ON songs (language);
CREATE INDEX idx_songs_ethnic_group       ON songs (ethnic_group);
CREATE INDEX idx_songs_verification       ON songs (verification_status);
CREATE INDEX idx_songs_yt_video_id        ON songs (yt_video_id);

-- Full-text search across all title fields and artist credit
CREATE INDEX idx_songs_fts ON songs USING GIN (
  to_tsvector('simple',
    COALESCE(title_original, '') || ' ' ||
    COALESCE(title_zh, '') || ' ' ||
    COALESCE(title_en, '') || ' ' ||
    COALESCE(artist_credit, '')
  )
);

-- ── Song ↔ Artist ─────────────────────────────────────────────

CREATE TABLE song_artists (
  song_id    UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  artist_id  UUID NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  PRIMARY KEY (song_id, artist_id)
);

CREATE INDEX idx_song_artists_artist ON song_artists (artist_id);

-- ── Tags ─────────────────────────────────────────────────────

CREATE TABLE tags (
  id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  value  TEXT NOT NULL UNIQUE,
  label  TEXT NOT NULL
);

CREATE TABLE song_tags (
  song_id  UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  tag_id   UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (song_id, tag_id)
);

CREATE INDEX idx_song_tags_tag ON song_tags (tag_id);

-- Seed tags from controlled vocabulary
INSERT INTO tags (value, label) VALUES
  ('amis',        'Amis'),
  ('bunun',       'Bunun'),
  ('paiwan',      'Paiwan'),
  ('seediq',      'Seediq'),
  ('tao',         'Tao / Yami'),
  ('folk',        'Folk'),
  ('traditional', 'Traditional'),
  ('gospel',      'Gospel'),
  ('choral',      'Choral'),
  ('film-ost',    'Film OST'),
  ('folk-pop',    'Folk-Pop'),
  ('spiritual',   'Spiritual'),
  ('matrilineal', 'Matrilineal'),
  ('archive',     'Archive'),
  ('unverified',  'Unverified');

-- ── Lyrics ───────────────────────────────────────────────────

CREATE TABLE lyrics (
  song_id          UUID PRIMARY KEY REFERENCES songs(id) ON DELETE CASCADE,
  lyrics_original  TEXT,
  lyrics_zh        TEXT,
  lyrics_en        TEXT,
  source           TEXT,
  show_publicly    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
