/**
 * One-time migration: data/artists.json + data/songs.json → Supabase
 * Idempotent — safe to re-run (upserts on legacy_id).
 *
 * Run after schema.sql has been executed in the Supabase SQL editor:
 *   node --env-file=.env.local scripts/migrate-to-supabase.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import ws from 'ws';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { realtime: { transport: ws } }
);

// ── Helpers ──────────────────────────────────────────────────

function getYouTubeId(url) {
  if (!url) return null;
  const w = url.match(/youtube\.com\/watch\?v=([^&]+)/);
  if (w) return w[1];
  const s = url.match(/youtu\.be\/([^?]+)/);
  if (s) return s[1];
  return null;
}

function mapStatus(s) {
  if (s === 'approved_public' || s === 'approved_private') return 'approved';
  if (s === 'needs_review' || s === 'duplicate') return 'candidate';
  return s ?? 'candidate'; // candidate | checked | rejected pass through
}

function hasCJK(str) {
  return /[一-鿿㐀-䶿]/.test(str ?? '');
}

function inferScript(name) {
  return hasCJK(name) ? 'zh' : 'ab';
}

function toLabel(value) {
  return value.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ── Step 1: Artists ──────────────────────────────────────────

async function migrateArtists() {
  const artists = JSON.parse(readFileSync(join(root, 'data/artists.json'), 'utf8'));
  const legacyToUUID = new Map();
  let ok = 0, fail = 0;

  for (const a of artists) {
    const { data, error } = await supabase
      .from('artists')
      .upsert({
        legacy_id:       a.id,
        name_display:    a.name_display,
        ethnic_group:    a.ethnic_group   ?? null,
        language:        a.language       ?? null,
        is_group:        a.is_group       ?? false,
        active_years:    a.active_years   ?? null,
        bio_zh:          a.bio_zh         ?? null,
        bio_en:          a.bio_en         ?? null,
        zh_surname:      a.zh_surname     ?? null,
        youtube_channel: a.youtube_channel ?? null,
        wikipedia_url:   a.wikipedia_url  ?? null,
        notes:           a.notes          ?? null,
      }, { onConflict: 'legacy_id' })
      .select('id')
      .single();

    if (error) { console.error(`  ✗ artist ${a.id}:`, error.message); fail++; continue; }

    legacyToUUID.set(a.id, data.id);
    ok++;

    // Name variants — delete + re-insert for idempotency
    const names = [];
    for (const n of a.names_zh        ?? []) names.push({ artist_id: data.id, name: n, script: 'zh' });
    for (const n of a.names_rom       ?? []) names.push({ artist_id: data.id, name: n, script: 'ab' });
    for (const n of a.names_indigenous ?? []) names.push({ artist_id: data.id, name: n, script: 'ab' });
    // name_display itself as a searchable alias
    if (a.name_display) {
      names.push({ artist_id: data.id, name: a.name_display, script: inferScript(a.name_display) });
    }

    if (names.length > 0) {
      await supabase.from('artist_names').delete().eq('artist_id', data.id);
      const { error: ne } = await supabase.from('artist_names').insert(names);
      if (ne) console.error(`  ✗ names for ${a.id}:`, ne.message);
    }
  }

  console.log(`  artists: ${ok} ok, ${fail} failed`);
  return legacyToUUID;
}

// ── Step 2: Tags ─────────────────────────────────────────────

async function seedTags() {
  const songs = JSON.parse(readFileSync(join(root, 'data/songs.json'), 'utf8'));
  const unique = [...new Set(songs.flatMap(s => s.tags ?? []))];

  for (const value of unique) {
    const { error } = await supabase
      .from('tags')
      .upsert({ value, label: toLabel(value) }, { onConflict: 'value' });
    if (error) console.error(`  ✗ tag "${value}":`, error.message);
  }

  const { data: rows, error } = await supabase.from('tags').select('id, value');
  if (error) throw new Error('Could not fetch tags: ' + error.message);

  console.log(`  tags: ${rows.length} total`);
  return new Map(rows.map(t => [t.value, t.id]));
}

// ── Step 3: Songs ─────────────────────────────────────────────

async function migrateSongs(artistMap, tagMap) {
  const songs = JSON.parse(readFileSync(join(root, 'data/songs.json'), 'utf8'));
  let ok = 0, fail = 0, unlinkedArtists = 0, unlinkedTags = 0;

  for (const s of songs) {
    // Merge verification_notes + source_snippets into notes
    const notes = [s.verification_notes, s.source_snippets]
      .filter(Boolean).join('\n\n') || null;

    const { data, error } = await supabase
      .from('songs')
      .upsert({
        legacy_id:           s.id,
        title_original:      s.title_original  ?? null,
        title_zh:            s.title_chinese   ?? null,
        title_en:            null,
        artist_credit:       s.artist          ?? null,
        yt_url:              s.youtube_url     ?? null,
        yt_video_id:         getYouTubeId(s.youtube_url),
        url:                 s.url             ?? null,
        album:               s.album_or_source ?? null,
        year:                s.year != null ? String(s.year) : null,
        language:            s.language_claimed    ?? null,
        ethnic_group:        s.ethnic_group_claimed ?? null,
        region:              s.region          ?? null,
        location:            s.location_claimed ?? null,
        genre:               s.genre           ?? null,
        notes,
        verification_status: mapStatus(s.verification_status),
      }, { onConflict: 'legacy_id' })
      .select('id')
      .single();

    if (error) { console.error(`  ✗ song ${s.id}:`, error.message); fail++; continue; }

    const songUUID = data.id;
    ok++;

    // song_artists
    const artistLinks = (s.artist_ids ?? [])
      .map(aid => artistMap.get(aid))
      .filter(Boolean)
      .map(artistUUID => ({ song_id: songUUID, artist_id: artistUUID }));

    if (artistLinks.length > 0) {
      await supabase.from('song_artists').delete().eq('song_id', songUUID);
      const { error: ae } = await supabase.from('song_artists').insert(artistLinks);
      if (ae) console.error(`  ✗ song_artists for ${s.id}:`, ae.message);
    } else if ((s.artist_ids ?? []).length > 0) {
      unlinkedArtists++;
    }

    // song_tags
    const tagLinks = (s.tags ?? [])
      .map(tv => tagMap.get(tv))
      .filter(id => { if (!id) unlinkedTags++; return id; })
      .map(tagUUID => ({ song_id: songUUID, tag_id: tagUUID }));

    if (tagLinks.length > 0) {
      await supabase.from('song_tags').delete().eq('song_id', songUUID);
      const { error: te } = await supabase.from('song_tags').insert(tagLinks);
      if (te) console.error(`  ✗ song_tags for ${s.id}:`, te.message);
    }

    // lyrics
    if (s.lyrics) {
      const { error: le } = await supabase.from('lyrics').upsert({
        song_id:         songUUID,
        lyrics_original: s.lyrics.lyrics_original        ?? null,
        lyrics_zh:       s.lyrics.lyrics_translation_zh  ?? null,
        lyrics_en:       s.lyrics.lyrics_translation_en  ?? null,
        source:          s.lyrics.lyrics_source          ?? null,
        show_publicly:   s.lyrics.show_publicly          ?? false,
      }, { onConflict: 'song_id' });
      if (le) console.error(`  ✗ lyrics for ${s.id}:`, le.message);
    }
  }

  console.log(`  songs: ${ok} ok, ${fail} failed`);
  if (unlinkedArtists > 0) console.log(`  ⚠ ${unlinkedArtists} songs had artist_ids with no matching artist UUID`);
  if (unlinkedTags > 0)    console.log(`  ⚠ ${unlinkedTags} tag values had no match in tags table`);
}

// ── Main ─────────────────────────────────────────────────────

async function main() {
  console.log('🔗 Connecting to', process.env.NEXT_PUBLIC_SUPABASE_URL);

  console.log('\n① Migrating artists…');
  const artistMap = await migrateArtists();

  console.log('\n② Seeding tags…');
  const tagMap = await seedTags();

  console.log('\n③ Migrating songs…');
  await migrateSongs(artistMap, tagMap);

  console.log('\n✓ Migration complete.');
}

main().catch(err => { console.error(err); process.exit(1); });
