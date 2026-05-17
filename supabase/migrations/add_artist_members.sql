-- Migration: add artist_members table
-- Run once in the Supabase SQL editor

CREATE TABLE IF NOT EXISTS artist_members (
  group_artist_id  UUID NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  member_artist_id UUID NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  PRIMARY KEY (group_artist_id, member_artist_id)
);

CREATE INDEX IF NOT EXISTS idx_artist_members_member ON artist_members (member_artist_id);
